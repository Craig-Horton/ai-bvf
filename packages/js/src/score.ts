import type {
  ScoreInput, ScoreResult, Classification,
  RecommendInput, RecommendResult, Recommendation,
  PaceLayerInput, PaceLayerResult,
  PillarScores, PillarBasis, ScoreSensitivity,
  Industry, FunctionId, AiTier, Readiness,
} from './types.js';
import { REGULATED_FUNCTIONS, REGULATED_INDUSTRIES } from './taxonomy.js';
import { buildAudit } from './audit.js';
// Deferred-access import: buildChangePlan is only called inside
// recommendImprovements, so the score <-> changePlan module cycle is safe.
import { buildChangePlan } from './changePlan.js';
import { assessWorkArchitecture } from './workArchitecture.js';

interface BaseRate {
  rev: { lo: number; hi: number };
  cost: { lo: number; hi: number };
  drivers: string[];
  source: string;
  evidence_status: 'modelled_planning_assumption';
  reviewed_at: string;
  use_guidance: string;
}

export const BENCHMARK_EVIDENCE_REGISTER = [
  {
    title: 'McKinsey, The state of AI 2025',
    url: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai/',
    finding: '88% reported regular AI use in at least one function; 39% reported enterprise-level EBIT impact.',
    boundary: 'Survey context only; it does not publish the AI BVF function rates.',
  },
  {
    title: 'Deloitte, AI ROI 2025',
    url: 'https://www.deloitte.com/global/en/issues/generative-ai/ai-roi-the-paradox-of-rising-investment-and-elusive-returns.html',
    finding: 'Most respondents reported satisfactory ROI in two to four years; 6% reported payback inside one year.',
    boundary: 'Survey context only; it does not publish AI BVF tier payback values.',
  },
  {
    title: 'Gartner, GenAI project failure 2026',
    url: 'https://www.gartner.com/en/articles/genai-project-failure',
    finding: 'At least 50% of GenAI projects had been abandoned after proof of concept because of data quality, risk controls, cost or unclear value.',
    boundary: 'Diagnostic context only; it does not define an AI BVF change-funding percentage.',
  },
  {
    title: 'Prosci, How to budget for change management',
    url: 'https://www.prosci.com/blog/how-to-budget-for-change-management',
    finding: '10% was the most common allocation for adoption and change management.',
    boundary: 'A planning reference to tailor to the work, not a minimum, compliance test or outcome guarantee.',
  },
  {
    title: 'EY and Oxford Saïd, Humans at the centre of transformation',
    url: 'https://www.ey.com/en_uk/insights/consulting/how-transformations-with-humans-at-the-center-can-double-your-success',
    finding: 'Above-average practice across six human factors increased the predicted likelihood of transformation success from 28% to 73% in the study.',
    boundary: 'Supports the six diagnostic questions; it does not validate AI BVF weights, drag rates or financial ranges.',
  },
] as const;

/**
 * Deterministic planning ranges, by business function.
 * Rates are fractions of annual revenue (lo/hi). Published research informs
 * the shape of the model, but does not publish these function-specific rates.
 * Keep them visible as assumptions until organisation evidence replaces them.
 */
const PLANNING_SOURCE = 'AI BVF modelled planning range; external research provides context but does not publish this function-specific rate.';
const PLANNING_GUIDANCE = 'Use for an initial hypothesis only. Replace the range with measured baseline, addressable volume, unit economics and an explicit capture rate before committing budget.';
const REVIEWED_AT = '2026-08-23';

function planningRate(
  rev: { lo: number; hi: number },
  cost: { lo: number; hi: number },
  drivers: string[],
): BaseRate {
  return {
    rev,
    cost,
    drivers,
    source: PLANNING_SOURCE,
    evidence_status: 'modelled_planning_assumption',
    reviewed_at: REVIEWED_AT,
    use_guidance: PLANNING_GUIDANCE,
  };
}

export const BASE_RATES: Record<string, BaseRate> = {
  finance: planningRate({ lo: 0.010, hi: 0.030 }, { lo: 0.030, hi: 0.060 }, ['Close cycle reduction','FP&A and forecasting','Anomaly detection and write-off prevention']),
  hr:      planningRate({ lo: 0.005, hi: 0.015 }, { lo: 0.020, hi: 0.040 }, ['Attrition and replacement cost','HR service operations','Skills-based workforce deployment']),
  sales:   planningRate({ lo: 0.030, hi: 0.080 }, { lo: 0.010, hi: 0.025 }, ['Personalisation','Lead and pipeline quality','Deal coaching and sales operations']),
  supply:  planningRate({ lo: 0.005, hi: 0.015 }, { lo: 0.040, hi: 0.090 }, ['Unplanned downtime','Inventory holding cost','Quality, rework and service levels']),
  cx:      planningRate({ lo: 0.020, hi: 0.050 }, { lo: 0.020, hi: 0.050 }, ['Self-service and containment','Handling time and first-contact resolution','Retention and customer lifetime value']),
  risk:    planningRate({ lo: 0.005, hi: 0.010 }, { lo: 0.020, hi: 0.040 }, ['False positives and case handling','Regulatory reporting effort','Continuous control monitoring']),
  it:      planningRate({ lo: 0.005, hi: 0.015 }, { lo: 0.030, hi: 0.070 }, ['Incident volume and resolution time','AIOps prevention','Service automation and platform throughput']),
  rd:      planningRate({ lo: 0.010, hi: 0.040 }, { lo: 0.010, hi: 0.030 }, ['Development cycle time','Design and simulation','Research and IP analysis']),
};

/**
 * Industry-by-function multipliers. Values < 1 mean below-average uplift; > 1 above-average.
 */
export const IND_MULT: Record<string, Record<string, number>> = {
  universal:     { finance: 1.0, hr: 1.0, sales: 1.0, supply: 1.0, cx: 1.0, risk: 1.0, it: 1.0, rd: 1.0 },
  creative:      { finance: 1.0, hr: 1.0, sales: 1.3, supply: 1.0, cx: 1.3, risk: 1.0, it: 1.0, rd: 1.2 },
  education:     { finance: 1.0, hr: 1.2, sales: 1.0, supply: 1.0, cx: 1.0, risk: 1.0, it: 1.2, rd: 1.4 },
  energy:        { finance: 1.0, hr: 1.0, sales: 1.0, supply: 1.4, cx: 1.0, risk: 1.3, it: 1.3, rd: 1.0 },
  financial:     { finance: 1.4, hr: 1.1, sales: 1.2, supply: 0.7, cx: 1.3, risk: 1.5, it: 1.1, rd: 0.8 },
  healthcare:    { finance: 1.1, hr: 1.1, sales: 1.0, supply: 0.8, cx: 1.1, risk: 1.4, it: 1.0, rd: 1.5 },
  logistics:     { finance: 1.2, hr: 1.0, sales: 1.0, supply: 1.5, cx: 1.0, risk: 1.0, it: 1.3, rd: 1.0 },
  manufacturing: { finance: 1.0, hr: 1.0, sales: 0.9, supply: 1.4, cx: 0.9, risk: 1.1, it: 1.3, rd: 1.1 },
  nonprofit:     { finance: 1.1, hr: 1.2, sales: 1.0, supply: 1.0, cx: 1.2, risk: 1.0, it: 1.0, rd: 1.0 },
  professional:  { finance: 1.0, hr: 1.2, sales: 1.4, supply: 1.0, cx: 1.3, risk: 1.0, it: 1.0, rd: 1.0 },
  public_sector: { finance: 1.0, hr: 1.2, sales: 1.0, supply: 1.0, cx: 1.0, risk: 1.3, it: 1.2, rd: 1.0 },
  real_estate:   { finance: 1.3, hr: 1.0, sales: 1.2, supply: 1.2, cx: 1.0, risk: 1.0, it: 1.0, rd: 1.0 },
  retail:        { finance: 1.0, hr: 1.0, sales: 1.4, supply: 1.2, cx: 1.4, risk: 0.9, it: 1.0, rd: 0.8 },
  technology:    { finance: 1.0, hr: 1.1, sales: 1.2, supply: 0.8, cx: 1.1, risk: 1.0, it: 1.4, rd: 1.4 },
};

export const TIER_ADJ = { gen1: 0.55, gen2: 1.00, gen3: 1.35 } as const;

export const READINESS_CAPTURE = {
  agile:       { low: 0.85, high: 1.00, label: 'Agile & Collaborative' },
  traditional: { low: 0.50, high: 0.70, label: 'Traditional Hierarchy' },
  siloed:      { low: 0.25, high: 0.40, label: 'Siloed & Bureaucratic' },
} as const;

/**
 * Pace Layer Diagnostic. Annual Organisational Drag Cost expressed as a
 * fraction of revenue, driven by misalignment between the AI tier an
 * organisation is deploying and the organisational operating model it
 * actually runs. Grounded in the EY/Oxford six-drivers research on change
 * success and BCG/MIT work on pace-layer misalignment. Numbers are
 * directional, not audited — the tool is a decision aid, not a GL entry.
 */
export const PACE_DRAG_RATE: Record<AiTier, Record<Readiness, { lo: number; hi: number }>> = {
  gen1: { agile: { lo: 0.001, hi: 0.003 }, traditional: { lo: 0.003, hi: 0.008 }, siloed:      { lo: 0.008, hi: 0.015 } },
  gen2: { agile: { lo: 0.002, hi: 0.005 }, traditional: { lo: 0.010, hi: 0.020 }, siloed:      { lo: 0.020, hi: 0.035 } },
  gen3: { agile: { lo: 0.005, hi: 0.010 }, traditional: { lo: 0.025, hi: 0.045 }, siloed:      { lo: 0.045, hi: 0.080 } },
};

const PACE_DRAG_DRIVERS: Record<Readiness, string[]> = {
  agile:       ['Minimal drag: governance cadence roughly matches deployment cadence', 'Residual drag from cross-team handoffs', 'Incremental cost from over-governing low-risk use cases'],
  traditional: ['Approval cycles outrun deployment cycles', 'Budget re-allocation friction (annual cycles vs weekly change)', 'Skills gap between model risk oversight and delivery teams'],
  siloed:      ['Functional ownership blocks horizontal data flow', 'Shadow AI proliferates outside governance', 'Duplicated spend across silos on overlapping models', 'Change-management budget absent or symbolic'],
};

const PACE_DRAG_SOURCE = 'AI BVF pace-layer planning model. External research informs the questions, but does not publish or validate these drag rates.';

function classify(sa: number, fr: number, ce: number, gr: number): { label: Classification; reason: string } {
  if (gr >= 70 || fr <= 20) {
    return { label: 'Stop', reason: gr >= 70 ? 'Governance risk above the safe threshold.' : 'Financial return too thin to justify scope.' };
  }
  if (sa >= 60 && fr >= 60 && ce >= 60 && gr <= 40) {
    return { label: 'Accelerate', reason: 'All four pillars clear, governance contained.' };
  }
  const gaps: string[] = [];
  if (sa < 60) gaps.push('strategic alignment is weak');
  if (fr < 60) gaps.push('financial return is thin');
  if (ce < 60) gaps.push('change enablement is a risk');
  if (gr > 40) gaps.push('governance exposure is real');
  return { label: 'Fix', reason: `Workable, but ${gaps.join('; ')}. Close the gap before scaling.` };
}

/**
 * Returns the list of BVF modules that were applied to this scoring run.
 * Always includes the base four-pillar scorer and the readiness capture
 * adjustment; adds vertical modules when the industry triggers them.
 */
function appliedModules(industry: Industry, fn: FunctionId, readiness: Readiness): string[] {
  const mods: string[] = ['four_pillar_base', `readiness_capture_${readiness}`];
  if (industry === 'healthcare') {
    mods.push('healthcare_clinical_validation', 'healthcare_regulatory_overhead');
    if (fn === 'risk') mods.push('healthcare_hipaa_module');
  }
  if (industry === 'financial') {
    mods.push('financial_model_risk_overhead');
    if (fn === 'risk') mods.push('financial_dora_module');
  }
  if (industry === 'public_sector') mods.push('public_sector_procurement_module');
  if (industry === 'energy') mods.push('energy_critical_infrastructure_module');
  return mods;
}

/** Below this signal_completeness, score() attaches a soft-inputs caveat. */
const SIGNAL_CAVEAT_THRESHOLD = 0.7;

/**
 * Deterministic pillar estimation for callers who do not have measured
 * pillar scores. Every prior is anchored to something the engine already
 * knows, and every estimated value sits in unproven territory by design:
 * an estimate can force caution (a Stop) but can never hand out the
 * evidence-cleared scores an Accelerate requires.
 *
 * - strategic_alignment: flat 50. Alignment to a board KPI cannot be read
 *   from industry or function; 50 means unproven, ask the board-anchor
 *   question.
 * - financial_return: anchored to the AI BVF planning-range upside for the
 *   function (BASE_RATES). Strong upside estimates 52, mid 46, thin 40.
 *   Never above 60 (an unmodelled case is unproven), never at or below 20
 *   (no evidence of a bad case either).
 * - change_enablement: from readiness, the engine's change-capability
 *   proxy. agile 55, traditional 45, siloed 32.
 * - governance_risk: from tier plus regulated context. gen1 30, gen2 42,
 *   gen3 55, +10 in a regulated function, +8 in a regulated industry.
 *   Agentic AI in a regulated function and industry estimates at 73,
 *   which forces a Stop until governance evidence exists — deliberate.
 */
export function estimatePillars(
  input: Pick<ScoreInput, 'industry' | 'function' | 'ai_tier' | 'readiness'>,
): PillarScores {
  const base = BASE_RATES[input.function];
  const upside = base ? base.rev.hi + base.cost.hi : 0;
  const financial_return = upside >= 0.10 ? 52 : upside >= 0.07 ? 46 : 40;

  const CE_BY_READINESS: Record<string, number> = { agile: 55, traditional: 45, siloed: 32 };
  const change_enablement = CE_BY_READINESS[input.readiness] ?? 45;

  const GR_BY_TIER: Record<string, number> = { gen1: 30, gen2: 42, gen3: 55 };
  let governance_risk = GR_BY_TIER[input.ai_tier] ?? 42;
  if (REGULATED_FUNCTIONS.has(input.function)) governance_risk += 10;
  if (input.industry && REGULATED_INDUSTRIES.has(input.industry)) governance_risk += 8;
  governance_risk = Math.min(100, governance_risk);

  return { strategic_alignment: 50, financial_return, change_enablement, governance_risk };
}

const PILLAR_IDS = ['strategic_alignment', 'financial_return', 'change_enablement', 'governance_risk'] as const;

/**
 * Resolve given + estimated pillars into a full set, with provenance.
 *
 * A pillar arrives as a bare number or as { value, confidence, basis }.
 * A pillar marked estimated, in the object or in pillar_basis, is never
 * counted as given: the engine uses its own estimate and says so. That
 * keeps an estimate an estimate when a document passes from tool to tool.
 *
 * `supported` is the signal the pillars themselves support: the default
 * from how many were given, lowered by any confidence the caller reported.
 */
export function resolvePillars(input: ScoreInput): {
  scores: PillarScores;
  basis: PillarBasis;
  givenCount: number;
  supported: number;
} {
  const est = estimatePillars(input);
  const given = (input.scores ?? {}) as Record<string, unknown>;
  const scores = {} as PillarScores;
  const basis = {} as PillarBasis;
  const qualities: number[] = [];
  let givenCount = 0;
  for (const p of PILLAR_IDS) {
    const raw = given[p] as any;
    const marked = input.pillar_basis?.[p] ?? (raw && typeof raw === 'object' ? raw.basis : undefined);
    if (marked !== undefined && marked !== 'given' && marked !== 'estimated') throw new Error(`pillar basis for ${p} must be given or estimated.`);
    const value = typeof raw === 'number' ? raw : raw && typeof raw === 'object' && typeof raw.value === 'number' ? raw.value : undefined;
    if (value !== undefined && !(Number.isFinite(value) && value >= 0 && value <= 100)) throw new Error(`scores.${p} must be a number from 0 to 100.`);
    const estimated = marked === 'estimated' || value === undefined;
    if (estimated) { scores[p] = est[p]; basis[p] = 'estimated'; }
    else { scores[p] = value as number; basis[p] = 'given'; givenCount++; }
    const reported = raw && typeof raw === 'object' && typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence / 100)) : undefined;
    qualities.push(reported ?? (estimated ? 0.5 : 1));
  }
  // All four given = 1, none = 0.5. Reported confidence can only lower it.
  const defaultSignal = 0.5 + 0.125 * givenCount;
  const reportedSignal = qualities.reduce((sum, quality) => sum + quality, 0) / PILLAR_IDS.length;
  // Four places: an average of four qualities is otherwise 0.5499999999999999 where 0.55 is meant.
  return { scores, basis, givenCount, supported: Math.round(Math.min(defaultSignal, reportedSignal) * 10000) / 10000 };
}

const NOTCH_DOWN: Record<string, string | null> = { agile: 'traditional', traditional: 'siloed', siloed: null };

/** The nearest single-pillar movements that change the verdict, in plain language. */
function verdictFlips(sa: number, fr: number, ce: number, gr: number, label: Classification): string[] {
  const flips: string[] = [];
  if (label === 'Accelerate') {
    const raw: Array<[string, number]> = [
      [`governance_risk +${41 - gr} (to 41) drops this to Fix`, 41 - gr],
      [`strategic_alignment -${sa - 59} (to 59) drops this to Fix`, sa - 59],
      [`financial_return -${fr - 59} (to 59) drops this to Fix`, fr - 59],
      [`change_enablement -${ce - 59} (to 59) drops this to Fix`, ce - 59],
    ];
    const margins = raw.filter(([, d]) => d > 0);
    margins.sort((a, b) => a[1] - b[1]);
    flips.push(...margins.slice(0, 2).map(m => m[0]));
  } else if (label === 'Stop') {
    if (gr >= 70) flips.push(`governance_risk -${gr - 69} (to 69) lifts the Stop gate`);
    if (fr <= 20) flips.push(`financial_return +${21 - fr} (to 21) lifts the Stop gate`);
  } else {
    const gaps: string[] = [];
    if (sa < 60) gaps.push(`strategic_alignment +${60 - sa}`);
    if (fr < 60) gaps.push(`financial_return +${60 - fr}`);
    if (ce < 60) gaps.push(`change_enablement +${60 - ce}`);
    if (gr > 40) gaps.push(`governance_risk -${gr - 40}`);
    if (gaps.length) flips.push(`to Accelerate: ${gaps.join(', ')}`);
    const toStop: Array<[string, number]> = [];
    if (gr < 70) toStop.push([`governance_risk +${70 - gr} (to 70) forces Stop`, 70 - gr]);
    if (fr > 20) toStop.push([`financial_return -${fr - 20} (to 20) forces Stop`, fr - 20]);
    toStop.sort((a, b) => a[1] - b[1]);
    if (toStop.length) flips.push(`nearest Stop: ${toStop[0][0]}`);
  }
  return flips;
}

/**
 * Score an initiative according to AI BVF v1.0.
 * Deterministic. No network. No dependencies.
 */
export function score(input: ScoreInput): ScoreResult {
  const { industry, revenue_eur, function: fn, ai_tier, readiness } = input;
  const base = BASE_RATES[fn];
  if (!base) throw new Error(`Unknown function: ${fn}`);
  const mult = (IND_MULT[industry] ?? IND_MULT.universal)[fn] ?? 1;
  const tAdj = TIER_ADJ[ai_tier];
  if (tAdj === undefined) throw new Error(`Unknown ai_tier: ${ai_tier}`);
  const cap = READINESS_CAPTURE[readiness];
  if (!cap) throw new Error(`Unknown readiness: ${readiness}`);

  const { scores: resolved, basis, givenCount, supported } = resolvePillars(input);
  const { strategic_alignment: sa, financial_return: fr, change_enablement: ce, governance_risk: gr } = resolved;
  const allEstimated = givenCount === 0;
  const anyEstimated = givenCount < 4;
  const workArchitecture = assessWorkArchitecture(input.work_architecture);
  const workArchitectureBlockers = [
    ...workArchitecture.gaps,
    ...workArchitecture.unknowns.map(item => `${item} not evidenced`),
  ];

  const grossLo = Math.round(revenue_eur * (base.rev.lo + base.cost.lo) * mult * tAdj);
  const grossHi = Math.round(revenue_eur * (base.rev.hi + base.cost.hi) * mult * tAdj);
  const netLo = Math.round(grossLo * cap.low);
  const netHi = Math.round(grossHi * cap.high);

  let cls = classify(sa, fr, ce, gr);
  // Stop-first invariant: a fully-estimated pass can never hand out a green
  // light. The priors already make this structurally impossible (estimated
  // strategic_alignment is 50), this guard keeps the promise even if the
  // priors ever change.
  if (allEstimated && cls.label === 'Accelerate') {
    cls = { label: 'Fix', reason: 'Clears the Accelerate thresholds on estimated pillars only. Confirm the four pillar scores with evidence to unlock the Go.' };
  }
  if (workArchitecture.blocks_accelerate && cls.label === 'Accelerate') {
    cls = {
      label: 'Fix',
      reason: `The four pillars clear, but the work architecture does not: ${workArchitectureBlockers.join('; ')}. Complete and evidence the work design before scaling.`,
    };
  }

  // Base confidence from the pillar scores themselves.
  const baseConfidence = (sa + fr + ce + (100 - gr)) / 4;
  // Input-quality haircut. The pillars supplied support a signal: all four
  // given = 1, none = 0.5, lowered by any confidence the caller reported.
  // signal_completeness is an upper limit only. A caller can lower the
  // signal, and can never raise it above what the pillars support: with no
  // pillars at all, a signal of 1 used to lift the score from 38 to 51.
  const explicit = input.signal_completeness;
  if (explicit !== undefined && !(typeof explicit === 'number' && Number.isFinite(explicit))) throw new Error('signal_completeness must be a number from 0 to 1.');
  const asked = explicit === undefined ? undefined : Math.max(0, Math.min(1, explicit));
  const signal = Math.max(0, Math.min(1, asked === undefined ? supported : Math.min(asked, supported)));
  const capped = asked !== undefined && asked > supported;
  const confidence = Math.round(baseConfidence * (0.5 + 0.5 * signal));

  const caveatParts: string[] = [];
  if (anyEstimated) {
    const estimated = (Object.keys(basis) as Array<keyof PillarBasis>).filter(k => basis[k] === 'estimated');
    caveatParts.push(`Estimated pillars: ${estimated.join(', ')} (deterministic AI BVF priors from readiness, tier and function, see pillar_basis). Confirm them with evidence before committing budget.`);
  }
  if (capped) {
    caveatParts.push(`signal_completeness ${asked} was given. The pillars supplied support ${signal}, so ${signal} is used: a caller can lower the signal and cannot raise it.`);
  }
  if (signal < SIGNAL_CAVEAT_THRESHOLD) {
    caveatParts.push(`Verdict rests on soft inputs (signal_completeness ${signal}). Decision confidence has been reduced accordingly; treat this as directional.`);
  }
  const caveat = caveatParts.length ? caveatParts.join(' ') : undefined;

  // Sensitivity: what moves this verdict, computed deterministically.
  const notch = NOTCH_DOWN[readiness];
  let readinessDown: ScoreSensitivity['readiness_one_notch_down'] = null;
  if (notch) {
    const capDown = READINESS_CAPTURE[notch as Readiness];
    const clsDownBase = classify(sa, fr, ce, gr); // pillars unchanged; readiness moves value + confidence context
    const clsDown = workArchitecture.blocks_accelerate && clsDownBase.label === 'Accelerate'
      ? { ...clsDownBase, label: 'Fix' as Classification }
      : clsDownBase;
    readinessDown = {
      readiness: notch as Readiness,
      classification: clsDown.label,
      net_value_eur: { low: Math.round(grossLo * capDown.low), high: Math.round(grossHi * capDown.high) },
      decision_confidence: confidence,
    };
  }
  const sensitivity: ScoreSensitivity = {
    readiness_one_notch_down: readinessDown,
    revenue_minus_20pct: { net_value_eur: { low: Math.round(netLo * 0.8), high: Math.round(netHi * 0.8) } },
    verdict_flips: verdictFlips(sa, fr, ce, gr, cls.label),
  };
  if (workArchitecture.blocks_accelerate && cls.label === 'Fix') {
    sensitivity.verdict_flips.unshift(`to Accelerate: resolve the work architecture gate: ${workArchitectureBlockers.join(', ')}`);
  }

  const estimated = (Object.keys(basis) as Array<keyof PillarBasis>).filter(k => basis[k] === 'estimated');
  const rules = [
    ...(estimated.length ? [`estimate:${estimated.join(',')}`] : []),
    `signal_completeness:${signal}${asked === undefined ? '(defaulted)' : capped ? `(given ${asked}, capped at what the pillars support)` : '(given)'}`,
    `classify:${cls.label}`,
    `work_architecture:${workArchitecture.status}`,
    ...(workArchitecture.blocks_accelerate ? ['gate:work_architecture_gap'] : []),
    ...(allEstimated && cls.label === 'Fix' && sa >= 60 && fr >= 60 && ce >= 60 && gr <= 40 ? ['downgrade:estimated_accelerate_to_fix'] : []),
    `value:BASE_RATES[${fn}] x IND_MULT[${industry}]=${mult} x TIER_ADJ[${ai_tier}]=${tAdj} x CAPTURE[${readiness}]=${cap.low}-${cap.high}`,
  ];

  return {
    classification: cls.label,
    reason: cls.reason,
    gross_low_eur: grossLo,
    gross_high_eur: grossHi,
    net_low_eur: netLo,
    net_high_eur: netHi,
    confidence,
    multipliers: { industry: mult, tier: tAdj, capture_low: cap.low, capture_high: cap.high },
    drivers: base.drivers,
    source: base.source,
    applied_modules: [...appliedModules(industry, fn, readiness), 'work_architecture_gate'],
    scores_used: resolved,
    pillar_basis: basis,
    sensitivity,
    work_architecture: workArchitecture,
    audit: buildAudit(rules, { industry, revenue_eur, function: fn, ai_tier, readiness, scores: resolved, pillar_basis: basis, signal_completeness: { used: signal, supported, ...(asked === undefined ? {} : { given: asked }) }, work_architecture: input.work_architecture ?? null }),
    ...(caveat ? { caveat } : {}),
  };
}

const PILLAR_ACTIONS: Record<Recommendation['pillar'], { action: string; rationale: string }> = {
  strategic_alignment: {
    action: 'Tie this initiative to a named board-level KPI with a written success metric and a single accountable executive owner.',
    rationale: 'The initiative has no named KPI and owner, so the value case cannot yet be governed. Name both and test them before funding.',
  },
  financial_return: {
    action: 'Rebuild the business case with itemised gross benefit (revenue uplift + cost take-out), a change cost line, and a capture rate tied to current readiness.',
    rationale: 'Weak financial return almost always means the capture rate has been assumed away. Re-running the case with the honest capture rate either reveals a real benefit or kills a vanity project.',
  },
  change_enablement: {
    action: 'Fund a dedicated change-management budget at 15 to 25 percent of total initiative spend, and assign a named product owner with capacity.',
    rationale: 'Funding alone does not prove readiness. Name the owner, cost the change work and replace this planning assumption with adoption evidence before funding.',
  },
  governance_risk: {
    action: 'Commission a pre-deployment governance review covering data lineage, model risk, EU AI Act classification, and human-in-the-loop design.',
    rationale: 'High governance exposure is not an argument for stopping by default; it is an argument for paying the governance cost up front rather than during a regulatory incident.',
  },
};

const RAISE_TARGET = 65;
const GOV_LOWER_TARGET = 35;

/**
 * Recommend concrete improvements to flip a Stop or Fix result toward Accelerate.
 * The logic is deterministic: for each weak pillar, propose a target score that
 * would satisfy the classify() thresholds, and attach a specific action and a
 * rationale. Returns feasible=false when governance risk is structurally too
 * high to recover.
 */
export function recommendImprovements(input: RecommendInput): RecommendResult {
  const { scores: resolved, basis, givenCount } = resolvePillars(input);
  const { strategic_alignment: sa, financial_return: fr, change_enablement: ce, governance_risk: gr } = resolved;

  const workArchitecture = assessWorkArchitecture(input.work_architecture);
  const workArchitectureBlockers = [
    ...workArchitecture.gaps,
    ...workArchitecture.unknowns.map(item => `${item} not evidenced`),
  ];
  let current = classify(sa, fr, ce, gr).label;
  // Same Stop-first invariant as score(): fully-estimated pillars never
  // produce an Accelerate, they produce a Fix pending confirmation.
  if (givenCount === 0 && current === 'Accelerate') current = 'Fix';
  if (workArchitecture.blocks_accelerate && current === 'Accelerate') current = 'Fix';
  const recs: Recommendation[] = [];
  const notes: string[] = [];
  if (givenCount < 4) {
    const estimated = (Object.keys(basis) as Array<keyof PillarBasis>).filter(k => basis[k] === 'estimated');
    notes.push(`Estimated pillars: ${estimated.join(', ')} (deterministic AI BVF priors from readiness, tier and function). The plan below is provisional on those pillars; confirm them with evidence and re-run.`);
  }
  if (workArchitecture.status !== 'ready') {
    notes.push(workArchitecture.blocks_accelerate
      ? `Work architecture blockers: ${workArchitectureBlockers.join(', ')}. These must be resolved before Accelerate.`
      : `Work architecture evidence is ${workArchitecture.status}. ${workArchitecture.next_question}`);
  }

  if (current === 'Accelerate') {
    return {
      current_classification: current,
      target_classification: current,
      feasible: true,
      recommendations: [],
      projected_confidence: Math.round((sa + fr + ce + (100 - gr)) / 4),
      notes: ['Initiative is already classified Accelerate. No flip required.'],
      audit: buildAudit(['classify:Accelerate', `work_architecture:${workArchitecture.status}`, 'no_flip_required'], { function: input.function, ai_tier: input.ai_tier, readiness: input.readiness, scores: resolved, work_architecture: input.work_architecture ?? null }),
    };
  }

  if (sa < 60) recs.push({ pillar: 'strategic_alignment', current: sa, target: RAISE_TARGET, delta: RAISE_TARGET - sa, ...PILLAR_ACTIONS.strategic_alignment });
  if (fr < 60) recs.push({ pillar: 'financial_return',    current: fr, target: RAISE_TARGET, delta: RAISE_TARGET - fr, ...PILLAR_ACTIONS.financial_return });
  if (ce < 60) recs.push({ pillar: 'change_enablement',   current: ce, target: RAISE_TARGET, delta: RAISE_TARGET - ce, ...PILLAR_ACTIONS.change_enablement });
  if (gr > 40) recs.push({ pillar: 'governance_risk',     current: gr, target: GOV_LOWER_TARGET, delta: GOV_LOWER_TARGET - gr, ...PILLAR_ACTIONS.governance_risk });

  const feasible = !(gr >= 70 && Math.abs(GOV_LOWER_TARGET - gr) > 40) && !(fr <= 20 && RAISE_TARGET - fr > 50);
  if (!feasible) {
    notes.push('Gaps are structurally too wide to close without redesigning the initiative. Scope a different use case rather than patching this one.');
  }

  const projectedSa = Math.max(sa, sa < 60 ? RAISE_TARGET : sa);
  const projectedFr = Math.max(fr, fr < 60 ? RAISE_TARGET : fr);
  const projectedCe = Math.max(ce, ce < 60 ? RAISE_TARGET : ce);
  const projectedGr = Math.min(gr, gr > 40 ? GOV_LOWER_TARGET : gr);
  const projectedConfidence = Math.round((projectedSa + projectedFr + projectedCe + (100 - projectedGr)) / 4);
  const projectedClass = classify(projectedSa, projectedFr, projectedCe, projectedGr).label;

  return {
    current_classification: current,
    target_classification: projectedClass,
    feasible,
    recommendations: recs,
    projected_confidence: projectedConfidence,
    notes,
    change_plan: buildChangePlan(input, resolved, recs, feasible),
    audit: buildAudit(
      [
        `classify:${current}`,
        `work_architecture:${workArchitecture.status}`,
        ...(workArchitecture.blocks_accelerate ? ['gate:work_architecture_gap'] : []),
        `feasible:${feasible}`,
        ...recs.map(r => `gap:${r.pillar}:${r.current}->${r.target}`),
      ],
      { industry: input.industry, revenue_eur: input.revenue_eur, function: input.function, ai_tier: input.ai_tier, readiness: input.readiness, scores: resolved, work_architecture: input.work_architecture ?? null },
    ),
  };
}

/**
 * Pace Layer Diagnostic.
 * Returns annual Organisational Drag Cost in EUR, based on the misalignment
 * between the AI tier being deployed and the organisational readiness. This
 * is the cost of structural friction, not the cost of the AI build.
 */
export function calculatePaceLayerDrag(input: PaceLayerInput): PaceLayerResult {
  const { revenue_eur, ai_tier, readiness } = input;
  const tier = PACE_DRAG_RATE[ai_tier];
  if (!tier) throw new Error(`Unknown ai_tier: ${ai_tier}`);
  const rate = tier[readiness];
  if (!rate) throw new Error(`Unknown readiness: ${readiness}`);

  const annual_drag_eur_low = Math.round(revenue_eur * rate.lo);
  const annual_drag_eur_high = Math.round(revenue_eur * rate.hi);

  let pace_gap: PaceLayerResult['pace_gap'] = 'minimal';
  if (ai_tier === 'gen3' && readiness !== 'agile') pace_gap = 'severe';
  else if (ai_tier === 'gen2' && readiness === 'siloed') pace_gap = 'severe';
  else if (readiness !== 'agile') pace_gap = 'moderate';

  return {
    annual_drag_eur_low,
    annual_drag_eur_high,
    drag_rate_low: rate.lo,
    drag_rate_high: rate.hi,
    pace_gap,
    drivers: PACE_DRAG_DRIVERS[readiness],
    source: PACE_DRAG_SOURCE,
  };
}
