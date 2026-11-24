import { READINESS_CAPTURE } from './score.js';
import type {
  ProcessSignals, BrainVerdict, Intervention, DragDecomposition,
  FunctionId, Classification, Readiness, EvidenceMaturity, ConfidenceBand,
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

/**
 * The confidence in words. One scale, written once, so that no report maps it
 * its own way. The engine returns confidence from 0 to 1 and the connector
 * returns the same figure from 0 to 100. Both carry `confidence_band`.
 */
export const CONFIDENCE_HIGH = 0.75;
export const CONFIDENCE_MEDIUM = 0.5;
export function confidenceBand(confidence: number): ConfidenceBand {
  return confidence >= CONFIDENCE_HIGH ? 'high' : confidence >= CONFIDENCE_MEDIUM ? 'medium' : 'low';
}

/**
 * The smallest log that supports a judgement. Below either floor a report
 * counts the process and judges nothing: no yearly volume, no intervention,
 * no saving. One case seen on one day is not 365 a year. The engine takes
 * yearly signals and cannot see the log, so the code that counts a log
 * applies the floors. They are judgement, not a benchmark.
 */
export const MIN_CASES_TO_JUDGE = 30;   // cases of one process in the log
export const MIN_DAYS_TO_PROJECT = 28;  // days the log covers, first step to last

/** Two drag factors this close, as shares of the drag, are a close call. The verdict says so. */
export const CLOSE_CALL = 0.02;

type Factor = keyof DragDecomposition;
const FACTORS: Factor[] = ['manual', 'handoffs', 'wait', 'rework', 'cycle'];

function bandFor(fn: FunctionId, iv: Intervention): Band {
  return EVIDENCE[fn]?.[iv] ?? CROSS_CUTTING[iv];
}

/** The move each drag factor points to. */
function moveFor(factor: Factor): Intervention {
  return factor === 'manual' ? 'Automate' : factor === 'rework' ? 'Quality controls' : 'Consolidate & re-sequence';
}

const whole = (x: number) => Math.round(x).toLocaleString('en-GB');
const pct = (x: number) => Math.round(x * 100);
const tenth = (x: number) => (Math.round(x * 1000) / 10).toFixed(1);

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

  // The shares as counted. The rule below reads these, never the rounded ones:
  // two factors that round to the same figure are still told apart.
  const share = (part: number) => (heavySum > 0 ? part / heavySum : 0);
  const shares: Record<Factor, number> = {
    manual: share(weighted.manual), handoffs: share(weighted.handoffs), wait: share(weighted.wait),
    rework: share(weighted.rework), cycle: share(weighted.cycle),
  };
  const drag_decomposition: DragDecomposition = {
    manual: round2(shares.manual), handoffs: round2(shares.handoffs), wait: round2(shares.wait),
    rework: round2(shares.rework), cycle: round2(shares.cycle),
  };

  // ── 3.3 intervention selector + addressable fraction ──
  const labour_fraction = clamp01(labour_cost / ((labour_cost + s.direct_spend_eur) || 1));
  let intervention: Intervention;
  let addressable: number;

  let chosen_by: string;
  let reach: string;
  let close_call: string | undefined;

  if (s.instances_per_year < ELIMINATE_VOLUME && heaviness >= 50) {
    intervention = 'Eliminate / insource';
    addressable = 1.0;
    reach = 'the whole process';
    chosen_by = `rare and heavy: under ${ELIMINATE_VOLUME} a year and heaviness of 50 or more`;
  } else if (s.rework_rate >= REWORK_FLOOR) {
    intervention = 'Quality controls';
    addressable = clamp01(s.rework_rate);
    reach = 'the share of cases that come back';
    chosen_by = `comes back: ${Math.round(REWORK_FLOOR * 100)} percent of cases or more are reworked`;
  } else if (s.fte_hours_per_instance <= SHORT_WORK_HOURS && s.handoffs <= 1 && s.instances_per_year >= REPEAT_VOLUME) {
    intervention = 'Automate';
    addressable = labour_fraction;
    reach = 'the share that is labour';
    chosen_by = `short and repeated: ${Math.round(SHORT_WORK_HOURS * 60)} minutes of work or less, one person at most, ${REPEAT_VOLUME} a year or more`;
  } else {
    // Largest first. Equal shares keep the order of FACTORS.
    const ranked = [...FACTORS].sort((a, b) => shares[b] - shares[a]);
    const dominant = ranked[0];
    chosen_by = `largest drag factor: ${dominant}`;
    intervention = moveFor(dominant);
    addressable = dominant === 'rework' ? clamp01(s.rework_rate) : labour_fraction;
    reach = dominant === 'rework' ? 'the share of cases that come back' : 'the share that is labour';
    // The nearest factor that points to another move. Within the margin, a small change in the counts changes the move.
    const rival = ranked.slice(1).find((factor) => moveFor(factor) !== intervention);
    if (rival && shares[dominant] - shares[rival] <= CLOSE_CALL) {
      close_call = `close call: ${dominant} is ${tenth(shares[dominant])} percent of the drag and ${rival} is ${tenth(shares[rival])} percent. A small change in the counts would choose ${moveFor(rival)}`;
    }
  }

  const band = bandFor(fn, intervention);

  // ── 3.4 savings quantifier ──
  const gross_low  = baseline_cost_eur * addressable * band.lo;
  const gross_high = baseline_cost_eur * addressable * band.hi;
  const net_saving_low_eur  = Math.round(gross_low  * cap.low);
  const net_saving_high_eur = Math.round(gross_high * cap.high);
  const eff_mid = (band.lo + band.hi) / 2;
  // Before the share kept. The euro range is after it: net_saving_*_pct says what share of today's cost that range is.
  const efficiency_gain_pct = Math.round(eff_mid * addressable * 100);
  const net_saving_low_pct = Math.round(100 * net_saving_low_eur / baseline_cost_eur);
  const net_saving_high_pct = Math.round(100 * net_saving_high_eur / baseline_cost_eur);

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

  // Everything the figure rests on, in words a report can print as they are.
  // The first line names the rule that chose. The rest rebuild the saving:
  // yearly cost, times reach, times saving band, times share kept.
  const assumptions = [
    `intervention chosen by ${chosen_by}`,
    ...(close_call ? [close_call] : []),
    `yearly cost today: €${whole(baseline_cost_eur)}. That is ${whole(s.instances_per_year)} cases a year, ${s.fte_hours_per_instance} hours of work each, at €${s.loaded_hourly_rate_eur} an hour, plus €${whole(s.direct_spend_eur)} of spend on tools`,
    `reach: ${pct(addressable)} percent of the yearly cost, ${reach}`,
    `saving band for ${intervention}: ${pct(band.lo)} to ${pct(band.hi)} percent of what the change reaches. Evidence ${band.maturity}. The band is a draft, set from published vendor and analyst figures and cut back. It was not measured on these cases`,
    `share kept: ${pct(cap.low)} to ${pct(cap.high)} percent of that saving, the band for ${readiness} readiness to change. ${s.readiness ? 'Readiness was given' : 'No readiness was given, so this is the default'}`,
    `signals counted: ${pct(signal_completeness)} percent${s.signal_completeness === undefined ? ', the default when none is given' : ''}`,
    'the weights and medians that set heaviness are a draft and not yet calibrated',
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
    net_saving_low_pct,
    net_saving_high_pct,
    efficiency_gain_pct,
    verdict,
    decision_confidence,
    confidence_band: confidenceBand(decision_confidence),
    assumptions,
    offer_to_execute: verdict === 'Accelerate',
    evidence_maturity: band.maturity,
    brain_version: BRAIN_VERSION,
    disclaimer: 'Directional decision aid, not an audited figure.',
  };
}
