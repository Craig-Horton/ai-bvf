export { validate } from './validate.js';
export {
  score,
  recommendImprovements,
  calculatePaceLayerDrag,
  estimatePillars, resolvePillars,
  BASE_RATES, BENCHMARK_EVIDENCE_REGISTER, IND_MULT, TIER_ADJ, READINESS_CAPTURE, PACE_DRAG_RATE,
} from './score.js';
export {
  diagnoseProcess, confidenceBand,
  BRAIN_VERSION, EVIDENCE, FUNCTION_MEDIANS,
  CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, MIN_CASES_TO_JUDGE, MIN_DAYS_TO_PROJECT, CLOSE_CALL,
} from './diagnose.js';
export { buildChangePlan } from './changePlan.js';
export { inferReadiness } from './inferReadiness.js';
export { sequencePortfolio } from './sequencePortfolio.js';
export { assemblePortfolio } from './assemblePortfolio.js';
export { mapToTaxonomy } from './aliases.js';
export {
  assessInitiative, extractEmployees, extractRevenueEur, CONTEXT_CHOICES,
  CONFLICT_LABEL, EVIDENCE_STATEMENT, REVIEW_OUTCOMES, REVIEW_OUTCOME_LABEL, UNANSWERED_LABEL,
} from './assessInitiative.js';
export {
  CHOICE_SCORES, FIRST_STEP, QUESTION_SHORT, QUESTION_WHY, SMALLER_FIRM_BELOW, UNKNOWN_LABEL, WORDING,
  WORK_ARCHITECTURE_CHOICES, WORK_PART_WORDING,
} from './guidedQuestions.js';
export { assessWorkArchitecture } from './workArchitecture.js';
export { buildAudit, CORE_VERSION } from './audit.js';
export { bvfSchema } from './schema.js';
export { INDUSTRIES, FUNCTIONS, AI_TIERS, READINESS, INDUSTRY_LABEL, FUNCTION_LABEL, TIER_LABEL } from './taxonomy.js';
export type * from './types.js';

export const BVF_VERSION = '1.0';
export { readProposal, PROPOSAL_RULES } from './proposalReading.js';
export type { ProposalFinding, ProposalRule } from './proposalReading.js';
export { CONTRADICTION_NEEDED, EVIDENCE_CONTRADICTION_NEEDED, contradictionStep } from './plainResult.js';
export {
  AGENT_RISK_FIRST_STEP, AGENT_RISK_WHERE_TO_LOOK, AGENT_RISK_WHY, AGENT_RISK_WORDING, WHERE_TO_LOOK,
  firstStepFor, whereToLookFor, whyFor, wordingFor,
} from './guidedQuestions.js';
export { AGENT_BRIEF, AGENT_BRIEF_VERSION, AGENT_CONNECTOR_URL } from './agentBrief.js';
export { BRIEF_BASE, assessInputFromBrief, briefUrl, briefUrlFor, readBriefLink } from './briefLink.js';
export type { BriefConflict, BriefLinkInput, BriefPrevious } from './briefLink.js';
export { FUNDING_DECISIONS, FUNDING_DECISION_LABEL, FUNDING_NOTE, FUNDING_STAGES, FUNDING_THRESHOLDS_MAX, fundingRecord, plainNumber, withUnit } from './funding.js';
