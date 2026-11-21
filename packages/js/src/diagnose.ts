import { READINESS_CAPTURE } from './score.js';
import type {
  ProcessSignals, BrainVerdict, Intervention, DragDecomposition,
  FunctionId, Classification, Readiness, EvidenceMaturity,
} from './types.js';

/**
 * AI BVF Advisor Brain — process diagnosis.
 *
 * Deterministic. No network. No dependencies. Implements docs/brain-spec.md
 * (the four models) calibrated by docs/evidence-table.md (the effectiveness
 * bands). Given observed process signals it returns a BrainVerdict: the
 * "this is too heavy → do X → save €Y → want me to get it done?" call, with
 * confidence governed by how much was actually measured.
 *
 * Reuses the kernel's READINESS_CAPTURE so an org that can't absorb change
 * doesn't get credited the gross saving.
 */
export const BRAIN_VERSION = '0.1';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

interface Band { lo: number; hi: number; maturity: EvidenceMaturity; }

/**
 * DRAFT per-function medians for normalising cycle time + handoffs into a
 * heaviness penalty. Pending calibration vs APQC process-cost distributions
 * (evidence-table "honest gaps"). Directional, not audited.
 */
export const FUNCTION_MEDIANS: Record<FunctionId, { cycle_days: number; handoffs: number }> = {
  finance: { cycle_days: 5,  handoffs: 4 },
  hr:      { cycle_days: 7,  handoffs: 4 },
  sales:   { cycle_days: 14, handoffs: 3 },
  supply:  { cycle_days: 10, handoffs: 5 },
  cx:      { cycle_days: 1,  handoffs: 2 },
  risk:    { cycle_days: 7,  handoffs: 4 },
  it:      { cycle_days: 2,  handoffs: 3 },
  rd:      { cycle_days: 30, handoffs: 4 },
};

/** Heaviness factor weights (sum to 1.0). brain-spec §3.2. */
const HEAVINESS_WEIGHTS = { manual: 0.25, rework: 0.20, handoffs: 0.20, wait: 0.20, cycle: 0.15 } as const;

/** Cross-cutting fallback bands (process-mining grounded). evidence-table. */
const CROSS_CUTTING: Record<Intervention, Band> = {
  'Automate':                  { lo: 0.30, hi: 0.50, maturity: 'Medium' },
  'Consolidate & re-sequence': { lo: 0.20, hi: 0.40, maturity: 'Medium' },
  'Quality controls':          { lo: 0.40, hi: 0.70, maturity: 'Medium' },
  'Eliminate / insource':      { lo: 0.60, hi: 0.90, maturity: 'Low' },
};

/**
 * Per-(function × intervention) effectiveness bands, transcribed from
 * docs/evidence-table.md. Conservative — haircut from cited headline
 * benchmarks. Cells absent here fall back to CROSS_CUTTING.
 */
export const EVIDENCE: Partial<Record<FunctionId, Partial<Record<Intervention, Band>>>> = {
  finance: {
    'Automate':                  { lo: 0.40, hi: 0.65, maturity: 'High' },
    'Quality controls':          { lo: 0.30, hi: 0.55, maturity: 'Medium' },
    'Consolidate & re-sequence': { lo: 0.20, hi: 0.35, maturity: 'Medium' },
    'Eliminate / insource':      { lo: 0.50, hi: 0.80, maturity: 'Low' },
  },
  hr: {
    'Automate':                  { lo: 0.35, hi: 0.60, maturity: 'High' },
    'Consolidate & re-sequence': { lo: 0.20, hi: 0.35, maturity: 'Medium' },
    'Quality controls':          { lo: 0.25, hi: 0.45, maturity: 'Low' },
    'Eliminate / insource':      { lo: 0.50, hi: 0.80, maturity: 'Low' },
  },
  supply: {
    'Automate':                  { lo: 0.25, hi: 0.45, maturity: 'Medium' },
    'Quality controls':          { lo: 0.30, hi: 0.55, maturity: 'Medium' },
    'Consolidate & re-sequence': { lo: 0.20, hi: 0.40, maturity: 'Medium' },
    'Eliminate / insource':      { lo: 0.60, hi: 0.90, maturity: 'Low' },
  },
  cx: {
    'Automate':                  { lo: 0.35, hi: 0.60, maturity: 'High' },
    'Quality controls':          { lo: 0.25, hi: 0.45, maturity: 'Medium' },
  },
  it: {
    'Automate':                  { lo: 0.30, hi: 0.55, maturity: 'High' },
    'Consolidate & re-sequence': { lo: 0.30, hi: 0.55, maturity: 'High' },
    'Quality controls':          { lo: 0.25, hi: 0.45, maturity: 'Medium' },
  },
  risk: {
    'Quality controls':          { lo: 0.30, hi: 0.50, maturity: 'Medium' },
    'Automate':                  { lo: 0.30, hi: 0.55, maturity: 'Medium' },
  },
  sales: {
    'Automate':                  { lo: 0.30, hi: 0.50, maturity: 'Low' },
  },
  rd: {
    'Automate':                  { lo: 0.20, hi: 0.40, maturity: 'Medium' },
  },
};

const MATURITY_EVIDENCE: Record<EvidenceMaturity, number> = { High: 0.9, Medium: 0.6, Low: 0.3 };

/** Low-volume threshold below which a heavy process is an Eliminate candidate. DRAFT. */
const ELIMINATE_VOLUME = 250;

/**
 * Two signals decide before the dominant drag factor does. In a log of cases,
 * waiting outweighs every other factor, so without these a six-minute task
 * done three thousand times a year is sent to a flow redesign, and so is a
 * process that comes back half the time. Thresholds set by Craig Horton on
 * 21 November 2026. They are judgement, not a benchmark.
 */
export const REWORK_FLOOR = 0.30;       // this share of cases comes back, or more
export const SHORT_WORK_HOURS = 0.25;   // this much work per case, or less
export const REPEAT_VOLUME = 1000;      // this many a year, or more

function bandFor(fn: FunctionId, iv: Intervention): Band {
  return EVIDENCE[fn]?.[iv] ?? CROSS_CUTTING[iv];
}

function dominantFactor(d: DragDecomposition): keyof DragDecomposition {
  return (Object.keys(d) as (keyof DragDecomposition)[]).reduce((a, b) => (d[b] > d[a] ? b : a));
}

/**
 * Saturated signals (penalty near 0 or 1) mean we are extrapolating beyond the
 * range the bands were calibrated on → lower fit. Mid-range signals → high fit.
 */
function benchmarkFit(penalties: number[]): number {
  const saturated = penalties.filter(p => p > 0.95 || p < 0.05).length;
  return clamp01(1 - saturated / penalties.length);
}

/**
 * Diagnose one process. Deterministic: same signals in, same verdict out.
 */
export function diagnoseProcess(s: ProcessSignals): BrainVerdict {
  const fn = s.function;
  const med = FUNCTION_MEDIANS[fn];
  if (!med) throw new Error(`Unknown function: ${fn}`);
  const readiness: Readiness = s.readiness ?? 'traditional';
  const cap = READINESS_CAPTURE[readiness];
  if (!cap) throw new Error(`Unknown readiness: ${readiness}`);

  // ── 3.1 baseline cost ("your current spend") ──
  const labour_cost = s.instances_per_year * s.fte_hours_per_instance * s.loaded_hourly_rate_eur;
  const baseline_cost_eur = Math.round(labour_cost + s.direct_spend_eur);
  if (baseline_cost_eur <= 0) throw new Error('baseline_cost_eur must be positive — check signal inputs');

  // ── 3.2 heaviness index + drag decomposition ──
  const cycle_penalty   = clamp01(s.cycle_time_days / (2 * med.cycle_days));
  const handoff_penalty = clamp01(s.handoffs / (2 * med.handoffs));
  const rework_penalty  = clamp01(s.rework_rate);
  const manual_penalty  = clamp01(1 - s.automation_level);
  const wait_penalty    = clamp01(1 - s.touch_ratio);

  const w = HEAVINESS_WEIGHTS;
  const weighted = {
    manual:   manual_penalty  * w.manual,
    rework:   rework_penalty  * w.rework,
    handoffs: handoff_penalty * w.handoffs,
    wait:     wait_penalty    * w.wait,
    cycle:    cycle_penalty   * w.cycle,
  };
  const heavySum = weighted.manual + weighted.rework + weighted.handoffs + weighted.wait + weighted.cycle;
  const heaviness = Math.round(100 * heavySum); // weights sum to 1, penalties 0..1 → 0..100

  const drag_decomposition: DragDecomposition = heavySum > 0 ? {
    manual:   round2(weighted.manual   / heavySum),
    handoffs: round2(weighted.handoffs / heavySum),
    wait:     round2(weighted.wait     / heavySum),
    rework:   round2(weighted.rework   / heavySum),
    cycle:    round2(weighted.cycle    / heavySum),
  } : { manual: 0, handoffs: 0, wait: 0, rework: 0, cycle: 0 };

  // ── 3.3 intervention selector + addressable fraction ──
  const labour_fraction = clamp01(labour_cost / ((labour_cost + s.direct_spend_eur) || 1));
  let intervention: Intervention;
  let addressable: number;

  let chosen_by: string;

  if (s.instances_per_year < ELIMINATE_VOLUME && heaviness >= 50) {
    intervention = 'Eliminate / insource';
    addressable = 1.0;
    chosen_by = `rare and heavy: under ${ELIMINATE_VOLUME} a year and heaviness of 50 or more`;
  } else if (s.rework_rate >= REWORK_FLOOR) {
    intervention = 'Quality controls';
    addressable = clamp01(s.rework_rate);
    chosen_by = `comes back: ${Math.round(REWORK_FLOOR * 100)} percent of cases or more are reworked`;
  } else if (s.fte_hours_per_instance <= SHORT_WORK_HOURS && s.handoffs <= 1 && s.instances_per_year >= REPEAT_VOLUME) {
    intervention = 'Automate';
    addressable = labour_fraction;
    chosen_by = `short and repeated: ${Math.round(SHORT_WORK_HOURS * 60)} minutes of work or less, one person at most, ${REPEAT_VOLUME} a year or more`;
  } else {
    const dominant = dominantFactor(drag_decomposition);
    chosen_by = `largest drag factor: ${dominant}`;
    if (dominant === 'manual') {
      intervention = 'Automate';
      addressable = labour_fraction;
    } else if (dominant === 'rework') {
      intervention = 'Quality controls';
      addressable = clamp01(s.rework_rate);
    } else { // handoffs | wait | cycle
      intervention = 'Consolidate & re-sequence';
      addressable = labour_fraction;
    }
  }

  const band = bandFor(fn, intervention);

  // ── 3.4 savings quantifier ──
  const gross_low  = baseline_cost_eur * addressable * band.lo;
  const gross_high = baseline_cost_eur * addressable * band.hi;
  const net_saving_low_eur  = Math.round(gross_low  * cap.low);
  const net_saving_high_eur = Math.round(gross_high * cap.high);
  const eff_mid = (band.lo + band.hi) / 2;
  const efficiency_gain_pct = Math.round(eff_mid * addressable * 100);

  // ── §4 decision confidence ──
  const signal_completeness = clamp01(s.signal_completeness ?? 0.7);
  const intervention_evidence = MATURITY_EVIDENCE[band.maturity];
  const benchmark_fit = benchmarkFit([cycle_penalty, handoff_penalty, rework_penalty, manual_penalty, wait_penalty]);
  const decision_confidence = round2(
    0.5 * signal_completeness + 0.4 * intervention_evidence + 0.1 * benchmark_fit,
  );

  // ── §4 verdict (on the intervention) ──
  const net_mid = (net_saving_low_eur + net_saving_high_eur) / 2;
  const saving_ratio = net_mid / baseline_cost_eur;
  let verdict: Classification;
  if (heaviness < 25 || saving_ratio < 0.02) {
    verdict = 'Stop';
  } else if (saving_ratio >= 0.05 && decision_confidence >= 0.6) {
    verdict = 'Accelerate';
  } else {
    verdict = 'Fix';
  }

  const assumptions = [
    `intervention chosen by ${chosen_by}`,
    `loaded rate €${s.loaded_hourly_rate_eur}/hr`,
    `${readiness} capture band ${cap.low}–${cap.high}`,
    `evidence ${band.maturity} (effectiveness ${band.lo}–${band.hi})`,
    `signal completeness ${signal_completeness}`,
    'heaviness bands DRAFT — pending APQC calibration',
  ];

  return {
    process_id: s.process_id,
    function: fn,
    baseline_cost_eur,
    heaviness,
    drag_decomposition,
    intervention,
    net_saving_low_eur,
    net_saving_high_eur,
    efficiency_gain_pct,
    verdict,
    decision_confidence,
    assumptions,
    offer_to_execute: verdict === 'Accelerate',
    evidence_maturity: band.maturity,
    brain_version: BRAIN_VERSION,
    disclaimer: 'Directional decision aid, not an audited figure.',
  };
}
