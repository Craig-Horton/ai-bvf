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

export type AssessField = 'industry' | 'revenue_eur' | 'function' | 'ai_tier' | 'readiness';

/** Plain-English front door for one proposed AI investment. */
export interface AssessInitiativeInput {
  proposal: string;
  industry?: string;
  revenue_eur?: number;
  function?: string;
  ai_tier?: string;
  readiness?: string;
  scores?: Partial<PillarScores>;
  signal_completeness?: number;
  work_architecture?: WorkArchitectureInput;
}

/** Either the next question needed to score, or the deterministic verdict. */
export interface AssessInitiativeResult {
  status: 'needs_input' | 'verdict';
  proposal: string;
  resolved_inputs: Partial<ScoreInput>;
  resolutions: string[];
  missing_fields: AssessField[];
  next_question?: string;
  suggestions?: string[];
  /** Fields whose wording pointed to more than one value, with the competing values. */
  ambiguous_fields?: Partial<Record<AssessField, string[]>>;
  /** Fields read from the wording of the proposal instead of an explicit answer. */
  inferred_fields: AssessField[];
  /** Plain statement of how the proposal was read, for the user to correct. */
  understood: string;
  verdict?: ScoreResult;
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
