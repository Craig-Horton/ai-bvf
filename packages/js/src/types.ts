export type Industry =
  | 'universal' | 'creative' | 'education' | 'energy' | 'financial'
  | 'healthcare' | 'logistics' | 'manufacturing' | 'nonprofit'
  | 'professional' | 'public_sector' | 'real_estate' | 'retail' | 'technology';

export type FunctionId = 'finance' | 'hr' | 'sales' | 'supply' | 'cx' | 'risk' | 'it' | 'rd';
export type AiTier = 'gen1' | 'gen2' | 'gen3';
export type Readiness = 'agile' | 'traditional' | 'siloed';
export type Classification = 'Accelerate' | 'Fix' | 'Stop';
export type Bucket = 'Agent-Proof' | 'Agent-Augmented' | 'Agent-Replaceable';
export type ComplianceFramework = 'eu_ai_act' | 'dora' | 'csrd' | 'gdpr_ai';

export interface PillarScore {
  value: number;
  confidence?: number;
  evidence?: string[];
}

export interface FourPillarScore {
  strategic_alignment: PillarScore;
  financial_return: PillarScore;
  change_enablement: PillarScore;
  governance_risk: PillarScore;
}

export interface Initiative {
  id: string;
  name: string;
  function: FunctionId;
  ai_tier: AiTier;
  bucket?: Bucket;
  scores: FourPillarScore;
  classification?: Classification;
  decision_confidence?: number;
  compliance?: ComplianceFramework[];
}

export interface Portfolio {
  bvf_version: '1.0';
  generated_at?: string;
  organization: {
    name: string;
    industry: Industry;
    region?: string;
    revenue_eur?: number;
    headcount?: number;
  };
  initiatives: Initiative[];
}

/** The four pillars, fully resolved (every pillar carries a number). */
export interface PillarScores {
  strategic_alignment: number;
  financial_return: number;
  change_enablement: number;
  governance_risk: number;
}

/** Where each resolved pillar value came from. */
export type PillarBasis = Record<keyof PillarScores, 'given' | 'estimated'>;

export interface ScoreInput {
  industry: Industry;
  revenue_eur: number;
  function: FunctionId;
  ai_tier: AiTier;
  readiness: Readiness;
  /**
   * Optional, and each pillar inside it is optional. Give the pillars you
   * have evidence for; any missing pillar is estimated deterministically
   * from readiness, tier, function and disclosed AI BVF planning assumptions, the result
   * reports which were estimated via pillar_basis, and a fully-estimated
   * pass can never return Accelerate.
   */
  scores?: Partial<PillarScores>;
  /**
   * Optional 0–1. How grounded the four pillar scores are in real evidence
   * versus estimated from context. When omitted it defaults from the count
   * of pillars actually given (all four = 1, none = 0.5), which haircuts
   * decision confidence and attaches a caveat on soft inputs. Mirrors
   * diagnose_process's signal_completeness.
   */
  signal_completeness?: number;
  /** Evidence that the work around the AI has been redesigned, not only the technology. */
  work_architecture?: WorkArchitectureInput;
}

export interface WorkArchitectureInput {
  /** The end-to-end workflow has been redesigned around the proposed AI and retained human judgement. */
  workflow_redesigned?: boolean;
  /** Affected roles, accountabilities and capability expectations have been rewritten. */
  roles_redesigned?: boolean;
  /** Decision, override and escalation rights have named human owners. */
  decision_rights_defined?: boolean;
  /** Performance measures and incentives reflect the redesigned work. */
  measures_updated?: boolean;
}

export type WorkArchitectureStatus = 'unknown' | 'partial' | 'gap' | 'ready';

export interface WorkArchitectureCheck {
  id: keyof WorkArchitectureInput;
  label: string;
  status: 'met' | 'gap' | 'unknown';
}

export interface WorkArchitectureAssessment {
  status: WorkArchitectureStatus;
  blocks_accelerate: boolean;
  checks: WorkArchitectureCheck[];
  gaps: string[];
  unknowns: string[];
  next_question?: string;
  gate: string;
}

/** Reproducibility record attached to every scoring call. Deterministic: no timestamps. */
export interface AuditRecord {
  engine: string;
  engine_version: string;
  bvf_version: string;
  /** The rules that actually fired, in order, e.g. estimation, gates, classification. */
  rules_fired: string[];
  /** The resolved inputs the result was computed on. */
  inputs_used: Record<string, unknown>;
  note: string;
}

/** What moves the verdict: deterministic perturbations of the same call. */
export interface ScoreSensitivity {
  /** Null when readiness is already siloed. */
  readiness_one_notch_down: null | {
    readiness: Readiness;
    classification: Classification;
    net_value_eur: { low: number; high: number };
    decision_confidence: number;
  };
  revenue_minus_20pct: { net_value_eur: { low: number; high: number } };
  /** The nearest single-pillar movements that change the verdict, in plain language. */
  verdict_flips: string[];
}

export interface ScoreResult {
  classification: Classification;
  reason: string;
  gross_low_eur: number;
  gross_high_eur: number;
  net_low_eur: number;
  net_high_eur: number;
  confidence: number;
  multipliers: { industry: number; tier: number; capture_low: number; capture_high: number };
  drivers: string[];
  source: string;
  applied_modules: string[];
  /** The four pillar values the verdict was computed on, given or estimated. */
  scores_used: PillarScores;
  /** Which pillars were given by the caller and which were estimated by the engine. */
  pillar_basis: PillarBasis;
  sensitivity: ScoreSensitivity;
  audit: AuditRecord;
  /** Whether workflows, roles, decision rights and measures have been redesigned for the initiative. */
  work_architecture: WorkArchitectureAssessment;
  /** Present when signal_completeness is low or any pillar was estimated: warns the verdict rests on soft inputs. */
  caveat?: string;
}

/** What kind of resistance sits behind a low change-enablement score. */
export type ResistanceType = 'will' | 'skill';
/** What kind of exposure sits behind a high governance-risk score. */
export type RiskType = 'regulatory' | 'reputational' | 'operational';

export interface RecommendInput extends ScoreInput {
  /** Optional. Whether people do not WANT the change (will) or cannot yet DO it (skill). Sharpens the change plan; inferred from readiness when absent. */
  resistance_type?: ResistanceType;
  /** Optional. The nature of the governance exposure. Sharpens the change plan; inferred from tier, function and industry when absent. */
  risk_type?: RiskType;
}

export interface Recommendation {
  pillar: 'strategic_alignment' | 'financial_return' | 'change_enablement' | 'governance_risk';
  current: number;
  target: number;
  delta: number;
  action: string;
  rationale: string;
}

/** One move at one altitude: the organisation (Kotter) or the person (ADKAR). */
export interface ChangeMove {
  method: string;
  action: string;
}

/** A named, context-selected change play. The unit of advice in the change plan. */
export interface ChangePlay {
  id: string;
  pillar: Recommendation['pillar'] | 'pace_gap';
  diagnosis: string;
  org_move: ChangeMove;
  person_move: ChangeMove;
  steps: string[];
  diagnostic_questions: string[];
  owner: string;
  timeline_weeks: [number, number];
  /** Present when the honest escalation from this play is Stop, and under what condition. */
  stop_condition?: string;
  /** True when the play was inferred from context rather than told via resistance_type / risk_type. */
  provisional: boolean;
  source: string;
}

export interface RescoreGate {
  clears_when: string;
  deadline_weeks: number;
}

/** The change-leader layer: a specific, sequenced route from Fix or Stop toward Go. */
export interface ChangePlan {
  binding_constraint: string;
  position: 'near_go' | 'contested' | 'near_stop';
  position_detail: string;
  plays: ChangePlay[];
  cost_of_waiting_eur: { low: number; high: number };
  cost_of_waiting: string;
  rescore_gate: RescoreGate;
  /** Present when the truthful call is Stop rather than Fix. */
  honest_stop?: string;
}

export interface RecommendResult {
  current_classification: Classification;
  target_classification: Classification;
  feasible: boolean;
  recommendations: Recommendation[];
  projected_confidence: number;
  notes: string[];
  /** Absent when the initiative is already Accelerate. */
  change_plan?: ChangePlan;
  audit: AuditRecord;
}

/** Input for infer_readiness: measured process signals, at least two required. */
export interface InferReadinessInput {
  function: FunctionId;
  handoffs?: number;
  rework_rate?: number;
  touch_ratio?: number;
  automation_level?: number;
  cycle_time_days?: number;
  /** Optional. What the organisation says about itself; the measured result is compared against it and the gap reported as a finding. */
  claimed_readiness?: Readiness;
}

/** One measured signal and the readiness it points toward. */
export interface SignalRead {
  signal: string;
  value: number;
  leans: Readiness;
  note: string;
}

export interface InferReadinessResult {
  readiness: Readiness;
  /** Always 'measured': this classification came from process data, not self-report. */
  readiness_basis: 'measured';
  confidence: number;
  signals_used: number;
  signal_reads: SignalRead[];
  /** Present when the signals point in opposing directions. */
  disagreement?: string;
  /** Echo of claimed_readiness when supplied. */
  claimed_readiness?: Readiness;
  /** Ordinal distance between claimed and measured: positive means the organisation claims better than it measures. */
  readiness_gap?: number;
  /** Present when claimed and measured differ: the gap read as a change-readiness finding. */
  gap_finding?: string;
  guidance: string;
  audit: AuditRecord;
}

export interface PaceLayerInput {
  revenue_eur: number;
  ai_tier: AiTier;
  readiness: Readiness;
  industry?: Industry;
}

export interface PaceLayerResult {
  annual_drag_eur_low: number;
  annual_drag_eur_high: number;
  drag_rate_low: number;
  drag_rate_high: number;
  pace_gap: 'minimal' | 'moderate' | 'severe';
  drivers: string[];
  source: string;
}

export interface ValidationError {
  path: string;
  msg: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ── Advisor Brain (docs/brain-spec.md + docs/evidence-table.md) ───────────

export type Intervention =
  | 'Automate'
  | 'Consolidate & re-sequence'
  | 'Quality controls'
  | 'Eliminate / insource';

export type EvidenceMaturity = 'High' | 'Medium' | 'Low';

/** Source-agnostic process signals the agent extracts from digital exhaust. */
export interface ProcessSignals {
  process_id: string;
  function: FunctionId;
  instances_per_year: number;
  fte_hours_per_instance: number;
  loaded_hourly_rate_eur: number;
  cycle_time_days: number;
  touch_ratio: number;          // 0..1 (touch ÷ cycle; rest is wait)
  handoffs: number;
  rework_rate: number;          // 0..1
  automation_level: number;     // 0..1
  direct_spend_eur: number;
  signal_completeness?: number; // 0..1; how much was measured vs defaulted (default 0.7)
  readiness?: Readiness;        // org capture context; default 'traditional'
}

export interface DragDecomposition {
  manual: number;
  handoffs: number;
  wait: number;
  rework: number;
  cycle: number;
}

/** The Brain's verdict on one process — both the proposal and the one-pager. */
export interface BrainVerdict {
  process_id: string;
  function: FunctionId;
  baseline_cost_eur: number;
  heaviness: number;            // 0..100
  drag_decomposition: DragDecomposition;
  intervention: Intervention;
  net_saving_low_eur: number;
  net_saving_high_eur: number;
  efficiency_gain_pct: number;
  verdict: Classification;      // Accelerate | Fix | Stop (on the intervention)
  decision_confidence: number;  // 0..1
  assumptions: string[];
  offer_to_execute: boolean;
  evidence_maturity: EvidenceMaturity;
  brain_version: string;
  disclaimer: string;
}

/** One initiative inside a sequencing request (flat pillar numbers). */
export interface SequenceInitiative {
  id: string;
  name: string;
  function: FunctionId;
  ai_tier: AiTier;
  scores: PillarScores;
}

export interface SequenceConstraints {
  /** Max initiatives landing on one business function per wave. Default 2. */
  max_parallel_per_function?: number;
  /** Planning horizon in days. Default 90 (three 30-day waves). */
  horizon_days?: number;
}

export interface SequenceInput {
  organization: { name?: string; industry: Industry; revenue_eur: number };
  initiatives: SequenceInitiative[];
  readiness: Readiness;
  constraints?: SequenceConstraints;
}

export interface SequencedItem {
  id: string;
  name: string;
  function: FunctionId;
  ai_tier: AiTier;
  classification: Classification;
  action: string;
  reason: string;
  net_value_eur: { low: number; high: number };
  decision_confidence: number;
}

export interface SequenceWave {
  wave: number;
  window_days: [number, number];
  theme: string;
  rationale: string;
  initiatives: SequencedItem[];
  gate_to_next: string | null;
}

export interface CapacityConflict {
  function: FunctionId;
  wave: number;
  overflow: string[];
  resolution: string;
}

export interface SequenceResult {
  waves: SequenceWave[];
  capacity_conflicts: CapacityConflict[];
  deferred_beyond_horizon: SequencedItem[];
  skipped: Array<{ id: string; name: string; reason: string }>;
  totals: { stopped: number; quick_wins: number; complex_or_fix: number; deferred: number };
  aggregate_accelerate_value_eur: { low: number; high: number };
  sequencing_principles: string[];
  audit: AuditRecord;
}

/** The context the front door needs before it can ask its questions. */
export type AssessField = 'industry' | 'function' | 'ai_tier' | 'employees';
/** Which wording the questions use. The rules are the same for both. */
export type AssessTrack = 'smaller_firm' | 'enterprise';
export type AssessQuestionId = keyof PillarScores | 'work_architecture';
/** a to d are the four everyday answers, weakest to strongest. unknown leaves the question open. */
export type AssessChoiceId = 'a' | 'b' | 'c' | 'd' | 'unknown';

export interface AssessContext {
  industry?: Industry;
  function?: FunctionId;
  ai_tier?: AiTier;
  /** Number of people in the organisation. */
  employees?: number;
  /** Set once employees is known: under 250 is smaller_firm. */
  track?: AssessTrack;
}

/** Plain-English front door for one proposed AI investment. */
/** Words an agent found, and where it found them. */
export interface AssessEvidence {
  /** The words as written in the source, quoted exactly. */
  quote: string;
  /** Where the words were found: the document, message or record, with its date where known. */
  source: string;
}

/** Who chose the answers: a person, or an agent working alone from evidence it can quote. */
export type AssessAnsweredBy = 'owner' | 'evidence';

/** What happened to an initiative after its last verdict, as one of five fixed answers. */
export type AssessReviewOutcome = 'delivering' | 'falling_short' | 'fixed_then_went_ahead' | 'paused_or_stopped' | 'no_decision';

export interface AssessReview {
  /**
   * The brief link the earlier verdict came with. The answers and quotes travel
   * inside it, so the result can say which answers changed since and which
   * change moved the verdict. Nothing is stored.
   */
  previous_brief?: string;
  /** The verdict the initiative received at its last assessment. Read from previous_brief when that is passed. */
  previous_verdict?: Classification;
  /** What happened since that verdict. Needed unless previous_brief is passed. */
  outcome?: AssessReviewOutcome;
  /** In evidence mode: the words that show the outcome, and where they were found. */
  evidence?: AssessEvidence;
}

export interface AssessInitiativeInput {
  proposal: string;
  industry?: string;
  function?: string;
  ai_tier?: string;
  employees?: number;
  /** True once the user has confirmed how the proposal was read. */
  confirmed?: boolean;
  /** The answers to the guided questions, by question id. */
  answers?: Partial<Record<AssessQuestionId, AssessChoiceId>>;
  /**
   * Who chose the answers. Omit it, or pass 'owner', when a person answered.
   * Pass 'evidence' when an agent working alone answered from evidence it can quote.
   */
  answered_by?: AssessAnsweredBy;
  /**
   * Evidence by question id. In evidence mode an answer of a to d counts only
   * with its quote and source. Without them the answer is counted as not known.
   * An answer that rests on more than one document takes a list of up to three
   * quotes, each with its own source.
   */
  evidence?: Partial<Record<AssessQuestionId, AssessEvidence | AssessEvidence[]>>;
  /**
   * Evidence mode: words in another record that say otherwise than the answer,
   * by question id, each with its own source. Where an answer has any, the two
   * records disagree: the answer is counted as not known and both sets of quotes
   * come back in conflicts, for the owner to say which record applies today.
   */
  evidence_against?: Partial<Record<AssessQuestionId, AssessEvidence | AssessEvidence[]>>;
  /**
   * At a review: the earlier verdict and what happened since. It never changes
   * the verdict. With previous_brief, the result says what changed since.
   */
  review?: AssessReview;
  /**
   * The funding record: what is asked for the next stage, the alternative, and
   * the results agreed to release more money. It sits beside the verdict and
   * never changes it. Every figure is the organisation's own.
   */
  funding?: AssessFundingInput;
  /** For callers that already hold 0 to 100 pillar scores. A supplied score takes precedence over an answer. */
  scores?: Partial<PillarScores>;
  signal_completeness?: number;
  work_architecture?: WorkArchitectureInput;
  /** Accepted for compatibility and ignored: the front door verdict does not use revenue. */
  revenue_eur?: number;
  /** Accepted for compatibility and ignored: the front door verdict does not use the operating-model label. */
  readiness?: string;
}

export interface AssessChoice {
  id: string;
  label: string;
}

/** The one thing to ask the user next, with its answer choices where there are any. */
export interface AssessQuestion {
  id: AssessField | AssessQuestionId | 'confirmation';
  question: string;
  why?: string;
  choices?: AssessChoice[];
  /** The input field that carries the answer on the next call. */
  answer_in: string;
  /** Guided questions only: where the answer is usually written down. */
  where_to_look?: string;
  /** Guided questions only: position in the sequence. */
  number?: number;
  of_at_most?: number;
}

/** One thing the user has to answer before the initiative can be judged. */
export interface AssessDecider {
  id: AssessQuestionId;
  /** The question in everyday words. */
  question: string;
  /** Why the answer decides the outcome. */
  why: string;
  /** The input field that carries the answer on the next call. */
  answer_in: string;
  /** Where the answer is usually written down. */
  where_to_look: string;
}

/** Evidence mode: a question still without an answer, with the choices to answer it from. */
export interface AssessOpenQuestion extends AssessDecider {
  choices: AssessChoice[];
}

/** What the user answered, with the published score the answer carries. */
export interface AssessAnswer {
  choice: Exclude<AssessChoiceId, 'unknown'>;
  label: string;
  /** Absent for work_architecture, which is four checks and carries no score. */
  score?: number;
  /** Evidence mode only: the words the answer rests on, and where they were found. One entry per quote. */
  evidence?: AssessEvidence[];
}

/** One answer that keeps the initiative from a go-ahead. */
export interface AssessHoldingBack {
  id: AssessQuestionId;
  /** A short name for the question, for lists. */
  short: string;
  /** The question as it was asked. */
  question: string;
  /** What the user answered. */
  answer: string;
  /** What the answer has to become to clear the bar. */
  needed: string;
  /** Present when the proposal or the evidence contradicts this answer: the words as written. */
  proposal_words?: string;
  /** Evidence mode only: the words this answer rests on, and where they were found. One entry per quote. */
  evidence?: AssessEvidence[];
}

/**
 * Words in the proposal that contradict a favourable answer. A contradiction
 * holds the verdict at Fix until the proposal and the answer agree.
 */
export interface AssessContradiction {
  id: AssessQuestionId;
  /** The published phrase rule that fired. */
  rule: string;
  /** The words as written in the proposal, or in the evidence given for this answer. */
  proposal_words: string;
  /** What those words say about the initiative. */
  proposal_says: string;
  /** What the user answered. */
  answer: string;
  /** Where the words were found. Absent means the proposal. */
  found_in?: 'proposal' | 'evidence';
}

/**
 * The front-door verdict. It rests only on what the user supplied: no pillar
 * is filled in by the engine and no euro figure is returned.
 */
export interface AssessVerdict {
  classification: Classification;
  /** The outcome in one or two plain sentences. A Stop quotes its cause. Show this to the user. */
  summary: string;
  /** The answers that keep the initiative from a go-ahead, most decisive first. Empty for Accelerate. */
  holding_back: AssessHoldingBack[];
  /** The one thing to do first. */
  first_step: string;
  /** Where the proposal's own words contradict a favourable answer. Empty when they agree. */
  contradictions: AssessContradiction[];
  /** The rule that produced the classification, in framework terms. */
  reason: string;
  /** The pillar scores the verdict rests on, from answers or supplied scores. Nothing here was estimated. */
  scores_supplied: Partial<PillarScores>;
  /** The guided answers behind those scores, where the user answered a question. */
  answers_given: Partial<Record<AssessQuestionId, AssessAnswer>>;
  /** Present only when all four pillars were supplied. */
  confidence?: number;
  /** Present only when all four pillars were supplied. */
  verdict_flips?: string[];
  work_architecture: WorkArchitectureAssessment;
  audit: AuditRecord;
  /** Why no euro figure is given. */
  value_note: string;
  /** Evidence mode only: who answered, in one plain sentence to show beside the verdict. */
  provenance?: AssessProvenance;
}

export interface AssessProvenance {
  answered_by: 'evidence';
  /** Say this with the verdict. */
  statement: string;
  /** How many answers carried a quote and a source. */
  answers_with_evidence: number;
}

/**
 * needs_input: a piece of context is unresolved, ask question.
 * needs_confirmation: the context was read from the wording; the user confirms or corrects it.
 * not_enough_to_judge: the user has not yet supplied what a verdict rests on; question is the next one to ask.
 * verdict: Accelerate, Fix or Stop, from the user's answers only.
 */
export interface AssessInitiativeResult {
  status: 'needs_input' | 'needs_confirmation' | 'not_enough_to_judge' | 'verdict';
  proposal: string;
  resolved_inputs: AssessContext;
  resolutions: string[];
  missing_fields: AssessField[];
  /** The next thing to ask, as one sentence. Absent when status is verdict. */
  next_question?: string;
  /** The same question in structured form, with its answer choices. */
  question?: AssessQuestion;
  suggestions?: string[];
  /** Fields whose wording pointed to more than one value, with the competing values. */
  ambiguous_fields?: Partial<Record<AssessField, string[]>>;
  /** Fields read from the wording of the proposal instead of an explicit answer. */
  inferred_fields: AssessField[];
  /** Plain statement of how the proposal was read, for the user to correct. */
  understood: string;
  /** not_enough_to_judge only: up to three things still to answer, most decisive first. */
  decides?: AssessDecider[];
  /** not_enough_to_judge only: anything else still open after the three in decides. */
  also_open?: AssessQuestionId[];
  /** Questions the user answered with "I do not know yet". A verdict waits on these. */
  to_find_out?: AssessDecider[];
  /** Present when the context carries a condition the user must meet first. */
  warning?: string;
  verdict?: AssessVerdict;
  /** Echoed when an agent answered from evidence. */
  answered_by?: 'evidence';
  /** Evidence mode only: answers that came without a quote and a source. Each was counted as not known. */
  evidence_missing?: AssessQuestionId[];
  /**
   * Evidence mode only: every guided question still without an answer, each with
   * its choices, so an agent can answer them all in one call. On a verdict,
   * nothing waits on them.
   */
  open_questions?: AssessOpenQuestion[];
  /**
   * Evidence mode only: answers where two records disagree. Each was counted as
   * not known. Put ask to the owner, with both sets of quotes beside it.
   */
  conflicts?: AssessConflict[];
  /** Present when a review was passed: the earlier verdict and what happened since. */
  review?: AssessReviewRecord;
  /** Present when a funding record was passed, or the earlier brief carried one. It never changes the verdict. */
  funding?: AssessFunding;
}

/** The stage the money is for. */
export type FundingStage = 'pilot' | 'rollout';
/** How a figure is known: counted from records, estimated, or not known. */
export type FundingKind = 'measured' | 'estimate' | 'unknown';
/** What the owner decided at a review. Recorded as one of three words, with no amount. */
export type FundingDecision = 'released' | 'deferred' | 'withdrew';

/** One result the owner agrees would release more money, written down before the work starts. */
export interface AssessFundingThresholdInput {
  /** What is measured, for example "Cost per resolved ticket". */
  measure: string;
  /** The unit, for example euros or percent. */
  unit?: string;
  /** at_most when lower is better, at_least when higher is better. */
  direction: 'at_most' | 'at_least';
  target: number;
  /** Today's figure. */
  baseline?: number;
  /** measured when today's figure was counted from records. Otherwise it is an estimate. */
  baseline_kind?: 'measured' | 'estimate';
  /** Evidence mode: the words that record the agreement, and where they were found. */
  evidence?: AssessEvidence;
}

export interface AssessFundingInput {
  stage?: FundingStage;
  /** What is asked for the next stage, in euros. */
  ask?: { amount_eur?: number; evidence?: AssessEvidence };
  /** The cheapest credible other route, including fixing the process as it is. */
  alternative?: { description: string; amount_eur?: number; evidence?: AssessEvidence };
  /** Up to three results that would release more money. */
  thresholds?: AssessFundingThresholdInput[];
  /** At a review: what was measured, by the name of the agreed result. */
  results?: { measure: string; value: number; kind?: 'measured' | 'estimate'; evidence?: AssessEvidence }[];
  /** At a review: what the person who holds the budget decided. */
  decision?: FundingDecision;
}

export interface AssessFundingThreshold {
  measure: string;
  unit?: string;
  direction: 'at_most' | 'at_least';
  target: number;
  baseline?: number;
  baseline_kind: FundingKind;
  evidence?: AssessEvidence;
  /** At a review: what was measured. */
  result?: number;
  result_kind?: 'measured' | 'estimate';
  result_evidence?: AssessEvidence;
  /** At a review: whether the result is on the agreed side of the target. */
  met?: boolean;
  /** The agreed result in one sentence, with today's figure or the result. */
  line: string;
}

/** The funding record as the engine keeps it. No figure in it was worked out by the engine. */
export interface AssessFunding {
  stage?: FundingStage;
  ask?: { amount_eur: number; evidence?: AssessEvidence };
  alternative?: { description: string; amount_eur?: number; evidence?: AssessEvidence };
  thresholds: AssessFundingThreshold[];
  /** What the person who holds the budget still does not know, most important first. */
  gaps: string[];
  /** Present once a result is in: how many agreed results are met. */
  review?: { met: number; of: number; statement: string };
  /** True when results passed today differ from those the earlier brief carried. The earlier ones are used. */
  agreement_changed?: true;
  decision?: FundingDecision;
  /** Say this with the verdict. */
  statement: string;
  /** Whose figures these are, and that the decision is not the engine's. */
  note: string;
}

/** One answer on which two records disagree. No rule picks a winner: the owner says which record applies today. */
export interface AssessConflict {
  id: AssessQuestionId;
  /** A short name for the question, for lists. */
  short: string;
  /** The question as it was asked. */
  question: string;
  /** The answer the first record supports. */
  answer: string;
  /** The words that support that answer, each with its source. */
  evidence: AssessEvidence[];
  /** The words in another record that say otherwise, each with its source. */
  against: AssessEvidence[];
  /** The question to put to the owner. */
  ask: string;
}

export interface AssessReviewRecord {
  /** The verdict the initiative received at its last assessment. */
  previous_verdict: Classification;
  /** What happened since that verdict, when it was given. */
  outcome?: AssessReviewOutcome;
  /** In evidence mode: the words that show the outcome, and where they were found. */
  evidence?: AssessEvidence;
  /** False when an agent gave an outcome with no evidence. An outcome without evidence is not kept. */
  accepted: boolean;
  note: string;
  /** Present when previous_brief was passed: which answers changed since the earlier verdict, and which change moved it. */
  since_last?: AssessSinceLast;
}

/** An answer as it stood at one assessment. */
export interface AssessAnswerAt {
  /** a to d, unknown, or unanswered when the question had not been put. */
  choice: AssessChoiceId | 'unanswered';
  label: string;
  /** Evidence mode: the words the answer rested on. */
  evidence?: AssessEvidence[];
}

/** One answer that differs between the earlier verdict and this one. */
export interface AssessAnswerChange {
  id: AssessQuestionId;
  short: string;
  question: string;
  from: AssessAnswerAt;
  to: AssessAnswerAt;
  /** True when putting this one answer back gives a different outcome from today's. */
  moved_verdict: boolean;
  /** The change in one sentence. */
  line: string;
}

/** What changed between the earlier verdict and this one. Built from the earlier brief link and today's answers. */
export interface AssessSinceLast {
  previous_verdict: Classification;
  /** The date of the earlier verdict, written YYYY-MM-DD. */
  previous_date: string;
  /** Today's outcome. */
  now: Classification | 'Not enough to judge yet';
  verdict_changed: boolean;
  changes: AssessAnswerChange[];
  /** How many of the five answers are the same as before. */
  unchanged: number;
  /** Present when the earlier brief was for another industry, function, AI type or size. */
  context_changed?: AssessField[];
  /** Say this with the verdict. */
  statement: string;
}

/** Result of mapping free text onto the canonical taxonomy. */
export interface TaxonomyMatch {
  input: string;
  resolved: string | null;
  matched_on?: string;
  /** Present when the wording pointed to more than one value: the competing values. */
  candidates?: string[];
  suggestions?: string[];
}

export interface MapTaxonomyResult {
  industry?: TaxonomyMatch;
  function?: TaxonomyMatch;
  ai_tier?: TaxonomyMatch;
  readiness?: TaxonomyMatch;
  guidance: string;
}
