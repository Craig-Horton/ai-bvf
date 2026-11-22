/**
 * The front door for one AI investment decision, written for a regular user.
 *
 * 1. Read the context from the proposal: industry, business function, AI type
 *    and headcount. Anything unread is asked for, one item at a time.
 * 2. Read it back. The user confirms or corrects it before any question.
 * 3. Ask at most five plain questions, one at a time, each with everyday
 *    answers that carry a fixed, published score.
 * 4. Return Accelerate, Fix or Stop from those answers. Nothing is filled
 *    in and no euro figure is given.
 * 5. Read the proposal against the answers. Where its own words contradict a
 *    favourable answer, the verdict is held at Fix and the words are quoted.
 *
 * An agent working alone under its owner's mandate uses the same door in
 * evidence mode. There, an answer of a to d counts only with the words it
 * rests on and where they were found. An answer without them is counted as
 * not known, so the agent cannot pick an answer it cannot quote. The verdict
 * says an agent answered from evidence and that no person confirmed it.
 */
import { mapToTaxonomy } from './aliases.js';
import { score } from './score.js';
import { buildAudit } from './audit.js';
import { assessWorkArchitecture } from './workArchitecture.js';
import { REGULATED_FUNCTIONS, REGULATED_INDUSTRIES } from './taxonomy.js';
import { plainResult } from './plainResult.js';
import { readProposal } from './proposalReading.js';
import {
  CHOICE_SCORES, SMALLER_FIRM_BELOW, UNKNOWN_LABEL,
  WORK_ARCHITECTURE_CHOICES, trackFor, whereToLookFor, whyFor, wordingFor,
} from './guidedQuestions.js';
import type {
  AiTier, AssessAnswer, AssessChoice, AssessContradiction, AssessChoiceId, AssessContext, AssessDecider, AssessEvidence, AssessField, AssessOpenQuestion,
  AssessInitiativeInput, AssessInitiativeResult, AssessProvenance, AssessQuestion, AssessQuestionId, AssessReviewRecord, AssessTrack,
  AssessVerdict, FunctionId, Industry, PillarScores, TaxonomyMatch, WorkArchitectureInput,
} from './types.js';

export { extractRevenueEur } from './extractRevenue.js';

type TaxonomyField = Exclude<AssessField, 'employees'>;

const CONTEXT_FIELDS: AssessField[] = ['industry', 'function', 'ai_tier', 'employees'];
const PILLARS = ['strategic_alignment', 'financial_return', 'change_enablement', 'governance_risk'] as const;
const MAX_QUESTIONS = 5;

const VALUE_NOTE = 'No euro figure is given. A value has to be worked out from the organisation\'s own volumes, hours and costs.';
const REGULATED_AGENTIC_WARNING = 'Agentic AI in a regulated setting cannot proceed until its controls are shown. Answer the governance question first.';

/** Everyday names for the canonical values, used when reading a proposal back. */
const PLAIN: Record<TaxonomyField, Record<string, string>> = {
  industry: {
    universal: 'cross-industry', creative: 'creative and media', education: 'education',
    energy: 'energy and utilities', financial: 'financial services', healthcare: 'healthcare',
    logistics: 'logistics and transport', manufacturing: 'manufacturing', nonprofit: 'non-profit',
    professional: 'professional services', public_sector: 'public sector',
    real_estate: 'real estate and construction', retail: 'retail', technology: 'technology',
  },
  function: {
    finance: 'finance', hr: 'HR', sales: 'sales and marketing', supply: 'supply chain',
    cx: 'customer service', risk: 'risk and compliance', it: 'IT', rd: 'R&D',
  },
  ai_tier: { gen1: 'automation', gen2: 'GenAI', gen3: 'agentic AI' },
};

/** The answer choices shown when a piece of context has to be asked for. */
const CONTEXT_CHOICE_LABEL: Record<TaxonomyField, Record<string, string>> = {
  industry: PLAIN.industry,
  function: PLAIN.function,
  ai_tier: {
    gen1: 'Automation: it follows fixed rules.',
    gen2: 'GenAI: it drafts, summarises or answers, and a person acts.',
    gen3: 'Agentic AI: it takes actions on its own.',
  },
};

/**
 * The choices for each piece of context, in the order a form should show them:
 * industries and functions by name with cross-industry last, AI types from the
 * simplest to the most autonomous. A page that lets the user correct the
 * reading uses these, so its wording matches the engine's.
 */
export const CONTEXT_CHOICES: Record<TaxonomyField, AssessChoice[]> = {
  industry: Object.entries(CONTEXT_CHOICE_LABEL.industry)
    .map(([id, label]) => ({ id, label }))
    .sort((x, y) => Number(x.id === 'universal') - Number(y.id === 'universal') || x.label.localeCompare(y.label, 'en', { sensitivity: 'base' })),
  function: Object.entries(CONTEXT_CHOICE_LABEL.function)
    .map(([id, label]) => ({ id, label }))
    .sort((x, y) => x.label.localeCompare(y.label, 'en', { sensitivity: 'base' })),
  ai_tier: Object.entries(CONTEXT_CHOICE_LABEL.ai_tier).map(([id, label]) => ({ id, label })),
};

const FIELD_NAME: Record<AssessField, string> = {
  industry: 'industry', function: 'business function', ai_tier: 'AI type', employees: 'number of people',
};

const CONTEXT_QUESTION: Record<AssessField, string> = {
  industry: 'Which industry is the organisation in?',
  function: 'Which part of the business will use it?',
  ai_tier: 'What will the AI do: follow fixed rules, draft and answer for a person to act on, or take actions on its own?',
  employees: 'How many people work in the organisation?',
};

const ANSWER_IN: Record<AssessQuestionId, string> = {
  financial_return: 'answers.financial_return',
  governance_risk: 'answers.governance_risk',
  strategic_alignment: 'answers.strategic_alignment',
  change_enablement: 'answers.change_enablement',
  work_architecture: 'answers.work_architecture',
};

type Ambiguous = Partial<Record<AssessField, string[]>>;

function orList(names: string[]): string {
  const final = names[names.length - 1];
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${final}` : `${final}`;
}

/**
 * Reads headcount from descriptions of the organisation: "40-person firm",
 * "12 person MSP", "600 staff", "an agency of 25 people". A bare "40 people"
 * is not read, because it may describe the team the AI is for. Two different
 * figures resolve to nothing.
 */
export function extractEmployees(proposal: string): { value: number; matched_on: string } | undefined {
  const text = proposal.replace(/\s+/g, ' ');
  const pattern = /(?<![\w.,€$£])(\d{1,3}(?:,\d{3}){1,2}|\d{1,7})[ -]?(person|people|employees|employee|staff|ftes|fte|strong)\b/gi;
  const anchor = /(?:\bof|\bwith|\bhave|\bhas|\bemploy|\bemploys|\bemploying|\bare|\baround|\babout) $/i;
  const found = new Map<number, string>();
  for (const match of text.matchAll(pattern)) {
    const unit = match[2].toLowerCase();
    if (unit === 'people' && !anchor.test(text.slice(Math.max(0, match.index! - 12), match.index!))) continue;
    const value = Number(match[1].replace(/,/g, ''));
    if (Number.isSafeInteger(value) && value >= 1 && !found.has(value)) found.set(value, match[0]);
  }
  if (found.size !== 1) return undefined;
  const [[value, matched_on]] = [...found.entries()];
  return { value, matched_on };
}

function contextQuestion(field: AssessField, ambiguous: Ambiguous): { text: string; question: AssessQuestion } {
  if (field === 'employees') {
    return {
      text: CONTEXT_QUESTION.employees,
      question: { id: 'employees', question: CONTEXT_QUESTION.employees, answer_in: 'employees' },
    };
  }
  const labels = CONTEXT_CHOICE_LABEL[field];
  const options = ambiguous[field];
  const text = options
    ? `The proposal points to more than one ${FIELD_NAME[field]}: ${orList(options.map((id) => PLAIN[field][id] ?? id))}. Which one applies?`
    : CONTEXT_QUESTION[field];
  const choices: AssessChoice[] = options
    ? options.map((id) => ({ id, label: labels[id] ?? id }))
    : CONTEXT_CHOICES[field].map((choice) => ({ ...choice }));
  return { text, question: { id: field, question: text, choices, answer_in: field } };
}

/** One plain statement of how the proposal was read, so the user can correct it. */
function understoodStatement(resolved: AssessContext, missing: AssessField[]): string {
  const read: string[] = [];
  if (resolved.industry) read.push(`industry ${PLAIN.industry[resolved.industry]}`);
  if (resolved.function) read.push(`business function ${PLAIN.function[resolved.function]}`);
  if (resolved.ai_tier) read.push(`AI type ${PLAIN.ai_tier[resolved.ai_tier]}`);
  if (resolved.employees !== undefined) {
    const wording = resolved.track === 'smaller_firm' ? 'a smaller firm' : 'a larger organisation';
    read.push(`${resolved.employees.toLocaleString('en-GB')} people, so the questions are worded for ${wording}`);
  }
  const open = missing.map((field) => FIELD_NAME[field]);
  const readPart = read.length ? `Read as: ${read.join('; ')}.` : 'Nothing in the proposal could be read with confidence.';
  const openPart = open.length ? ` Not yet known: ${open.join(', ')}.` : '';
  const fix = read.length ? ' Correct any item that is wrong.' : '';
  return `${readPart}${openPart}${fix}`;
}

function proposalFor(field: TaxonomyField, proposal: string, industryPhrase?: string): string {
  if (field !== 'function') return proposal;
  // Whitespace runs are collapsed first so the amount pattern needs only single
  // optional spaces. Adjacent \s* groups backtrack polynomially on long runs of spaces.
  let text = proposal.replace(/\s+/g, ' ')
    .replace(/(?:annual )?(?:revenue|turnover) ?(?:of|is|around|about|approximately|approx\.?|:)? ?(?:EUR|€)? ?[0-9]+(?:[,.][0-9]+)? ?(?:k|thousand|m|mn|million|b|bn|billion)?/gi, '');
  // The words that named the industry ("marketing agency", "recruitment agency")
  // describe what the organisation is. They say nothing about which function owns the work.
  if (industryPhrase && /[\s-]/.test(industryPhrase)) {
    const pattern = industryPhrase.trim().split(/[\s_\-/]+/)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s_\\-/]+');
    text = text.replace(new RegExp(`\\b${pattern}s?\\b`, 'gi'), ' ');
  }
  return text;
}

function taxonomyMatch(field: TaxonomyField, value: string): TaxonomyMatch | undefined {
  return mapToTaxonomy({ [field]: value })[field];
}

function guidedChoices(track: AssessTrack, id: AssessQuestionId, aiTier?: string): AssessChoice[] {
  const w = wordingFor(track, id, aiTier);
  return [
    { id: 'a', label: w.a }, { id: 'b', label: w.b }, { id: 'c', label: w.c }, { id: 'd', label: w.d },
    { id: 'unknown', label: UNKNOWN_LABEL },
  ];
}

function decider(track: AssessTrack, id: AssessQuestionId, aiTier?: string): AssessDecider {
  return {
    id, question: wordingFor(track, id, aiTier).question, why: whyFor(track, id, aiTier),
    answer_in: ANSWER_IN[id], where_to_look: whereToLookFor(id, aiTier),
  };
}

// ── Evidence mode ──────────────────────────────────────────────────────────
/** Said with every verdict an agent reached on its own. */
export const EVIDENCE_STATEMENT = 'An agent answered these questions from evidence it quoted. No person has confirmed the answers.';
export const REVIEW_OUTCOMES = ['delivering', 'falling_short', 'fixed_then_went_ahead', 'paused_or_stopped', 'no_decision'] as const;
/** The five outcomes in everyday words, for a person or an agent to choose from at a review. */
export const REVIEW_OUTCOME_LABEL: Record<typeof REVIEW_OUTCOMES[number], string> = {
  delivering: 'It went ahead and is delivering what was expected.',
  falling_short: 'It went ahead and is falling short.',
  fixed_then_went_ahead: 'It was fixed first, then went ahead.',
  paused_or_stopped: 'It was paused or stopped.',
  no_decision: 'No decision has been made.',
};
const QUOTE_MIN = 8;
const QUOTE_MAX = 400;
const SOURCE_MIN = 3;
const SOURCE_MAX = 160;
/** An answer may rest on more than one document. Each quote keeps its own source. */
const QUOTES_PER_ANSWER = 3;

/** A quote and a source, trimmed and capped. Anything shorter than a few words is no evidence. */
function cleanEvidence(given: unknown): AssessEvidence | undefined {
  if (!given || typeof given !== 'object') return undefined;
  const { quote, source } = given as Record<string, unknown>;
  if (typeof quote !== 'string' || typeof source !== 'string') return undefined;
  const words = quote.replace(/\s+/g, ' ').trim();
  const where = source.replace(/\s+/g, ' ').trim();
  if (words.length < QUOTE_MIN || where.length < SOURCE_MIN) return undefined;
  return { quote: words.slice(0, QUOTE_MAX), source: where.slice(0, SOURCE_MAX) };
}

/** One quote or a list of them. Entries that are no evidence are dropped, and the list is capped. */
function cleanEvidenceList(given: unknown): AssessEvidence[] {
  const items = Array.isArray(given) ? given : [given];
  return items.map(cleanEvidence).filter((item): item is AssessEvidence => item !== undefined).slice(0, QUOTES_PER_ANSWER);
}

function reviewRecord(input: AssessInitiativeInput, byEvidence: boolean): AssessReviewRecord | undefined {
  const review = input.review;
  if (review === undefined) return undefined;
  if (!review || !['Accelerate', 'Fix', 'Stop'].includes(review.previous_verdict) || !REVIEW_OUTCOMES.includes(review.outcome)) {
    throw new Error(`review needs previous_verdict (Accelerate, Fix or Stop) and outcome (${REVIEW_OUTCOMES.join(', ')}).`);
  }
  const record = { previous_verdict: review.previous_verdict, outcome: review.outcome };
  if (!byEvidence) return { ...record, accepted: true, note: 'Kept beside the new verdict. It does not change the verdict.' };
  const evidence = cleanEvidence(review.evidence);
  return evidence
    ? { ...record, evidence, accepted: true, note: 'Kept beside the new verdict. It does not change the verdict.' }
    : { ...record, accepted: false, note: 'No evidence was given for what happened, so the outcome was not kept.' };
}

export function assessInitiative(input: AssessInitiativeInput): AssessInitiativeResult {
  const proposal = input.proposal?.trim();
  if (!proposal) throw new Error('proposal must be a plain-English description of the AI initiative.');
  if (input.answered_by !== undefined && input.answered_by !== 'owner' && input.answered_by !== 'evidence') {
    throw new Error('answered_by must be owner or evidence.');
  }
  const byEvidence = input.answered_by === 'evidence';
  if (byEvidence && (Object.keys(input.scores ?? {}).length || Object.keys(input.work_architecture ?? {}).length)) {
    throw new Error('In evidence mode, answer each question with a to d and quote the evidence for it. Numeric scores and the four work checks are not accepted: answer work_architecture in answers with a to d, and quote it in evidence.');
  }
  const review = reviewRecord(input, byEvidence);

  // ── 1. Read the context ────────────────────────────────────────────────
  const resolved: AssessContext = {};
  const resolutions: string[] = [];
  const ambiguous: Ambiguous = {};
  const inferred: AssessField[] = [];
  let firstSuggestions: string[] | undefined;
  let industryPhrase: string | undefined;

  for (const field of ['industry', 'function', 'ai_tier'] as const) {
    const provided = input[field]?.trim();
    const source = provided || proposalFor(field, proposal, industryPhrase);
    const match = taxonomyMatch(field, source);
    if (field === 'industry' && !provided && match?.resolved && match.matched_on !== 'exact') industryPhrase = match.matched_on;
    if (match?.resolved) {
      if (field === 'industry') resolved.industry = match.resolved as Industry;
      if (field === 'function') resolved.function = match.resolved as FunctionId;
      if (field === 'ai_tier') resolved.ai_tier = match.resolved as AiTier;
      if (!provided) inferred.push(field);
      resolutions.push(`${field} resolved as ${match.resolved} from ${provided ? 'provided value' : 'proposal'}, matched on "${match.matched_on}".`);
    } else {
      if (match?.candidates) ambiguous[field] = match.candidates;
      if (provided && match?.suggestions && !firstSuggestions) firstSuggestions = match.suggestions;
    }
  }

  if (input.employees !== undefined) {
    if (!Number.isFinite(input.employees) || input.employees < 1) throw new Error('employees must be a number of people, 1 or more.');
    resolved.employees = Math.round(input.employees);
    resolutions.push(`employees resolved as ${resolved.employees} from provided value.`);
  } else {
    const read = extractEmployees(proposal);
    if (read) {
      resolved.employees = read.value;
      inferred.push('employees');
      resolutions.push(`employees resolved as ${read.value} from proposal, matched on "${read.matched_on}".`);
    }
  }
  if (resolved.employees !== undefined) resolved.track = trackFor(resolved.employees);

  const missing = CONTEXT_FIELDS.filter((field) => resolved[field] === undefined);
  const understood = understoodStatement(resolved, missing);
  const base = {
    proposal, resolved_inputs: resolved, resolutions, missing_fields: missing,
    inferred_fields: inferred, understood,
    ...(byEvidence ? { answered_by: 'evidence' as const } : {}),
    ...(review ? { review } : {}),
  };

  if (missing.length) {
    const ask = contextQuestion(missing[0], ambiguous);
    return {
      status: 'needs_input', ...base,
      next_question: ask.text, question: ask.question,
      ...(firstSuggestions ? { suggestions: firstSuggestions } : {}),
      ...(Object.keys(ambiguous).length ? { ambiguous_fields: ambiguous } : {}),
    };
  }

  // ── 2. Confirm the reading before any question ─────────────────────────
  if (inferred.length && input.confirmed !== true) {
    const text = 'Is this reading right? Confirm it, or correct any item.';
    return {
      status: 'needs_confirmation', ...base,
      next_question: text,
      question: {
        id: 'confirmation', question: text, answer_in: 'confirmed',
        choices: [
          { id: 'true', label: 'Yes, that is right.' },
          { id: 'correct', label: 'No. Supply the corrected item in its own field.' },
        ],
      },
    };
  }

  // ── 3. Take the answers ────────────────────────────────────────────────
  const track = resolved.track!;
  const supplied: Partial<PillarScores> = {};
  const answersGiven: Partial<Record<AssessQuestionId, AssessAnswer>> = {};
  const unknown: AssessQuestionId[] = [];
  const rules: string[] = [`track:${track}`, ...(byEvidence ? ['answered_by:evidence'] : [])];
  const evidenceMissing: AssessQuestionId[] = [];
  const evidenceGiven: Partial<Record<AssessQuestionId, AssessEvidence[]>> = {};

  // In evidence mode an answer of a to d counts only with its quote and source.
  // Without them it is counted as not known, so nothing rests on an answer nobody can check.
  const answerFor = (id: AssessQuestionId): AssessChoiceId | undefined => {
    const choice = input.answers?.[id];
    if (choice === undefined) return undefined;
    if (!['a', 'b', 'c', 'd', 'unknown'].includes(choice)) throw new Error(`answers.${id} must be one of a, b, c, d or unknown.`);
    if (!byEvidence || choice === 'unknown') return choice;
    const evidence = cleanEvidenceList(input.evidence?.[id]);
    if (!evidence.length) {
      evidenceMissing.push(id);
      rules.push(`evidence_missing:${id}`);
      return 'unknown';
    }
    evidenceGiven[id] = evidence;
    rules.push(`evidence:${id}`);
    return choice;
  };
  const withEvidence = (id: AssessQuestionId) => (evidenceGiven[id] ? { evidence: evidenceGiven[id] } : {});

  for (const pillar of PILLARS) {
    const given = input.scores?.[pillar];
    const choice = answerFor(pillar);
    if (typeof given === 'number' && Number.isFinite(given)) {
      supplied[pillar] = given;
      rules.push(`score:${pillar}=${given}`);
    } else if (choice === 'unknown') {
      unknown.push(pillar);
    } else if (choice) {
      const value = CHOICE_SCORES[pillar][choice];
      supplied[pillar] = value;
      answersGiven[pillar] = { choice, label: wordingFor(track, pillar, resolved.ai_tier)[choice], score: value, ...withEvidence(pillar) };
      rules.push(`answer:${pillar}=${choice}(${value})`);
    }
  }

  let workInput: WorkArchitectureInput | undefined;
  let workAnswered = false;
  const workChoice = answerFor('work_architecture');
  if (input.work_architecture && Object.keys(input.work_architecture).length) {
    workInput = input.work_architecture;
    workAnswered = true;
  } else if (workChoice === 'unknown') {
    unknown.push('work_architecture');
  } else if (workChoice) {
    workInput = WORK_ARCHITECTURE_CHOICES[workChoice];
    workAnswered = true;
    answersGiven.work_architecture = { choice: workChoice, label: wordingFor(track, 'work_architecture')[workChoice], ...withEvidence('work_architecture') };
    rules.push(`answer:work_architecture=${workChoice}`);
  }
  const workArchitecture = assessWorkArchitecture(workInput);

  const auditInputs = {
    industry: resolved.industry, function: resolved.function, ai_tier: resolved.ai_tier,
    employees: resolved.employees, track, scores: supplied, answers: input.answers ?? null,
    work_architecture: workInput ?? null,
    // Evidence mode: which answers carried a quote, and which were counted as not known for want of one.
    ...(byEvidence ? { answered_by: 'evidence', evidence_sources: Object.fromEntries(Object.entries(evidenceGiven).map(([id, items]) => [id, items!.map((item) => item.source)])), evidence_missing: evidenceMissing } : {}),
  };
  const suppliedCount = Object.keys(supplied).length;
  const regulatedAgentic = resolved.ai_tier === 'gen3'
    && (REGULATED_INDUSTRIES.has(resolved.industry!) || REGULATED_FUNCTIONS.has(resolved.function!));
  // The two questions that can stop the initiative first, then the two
  // Accelerate needs, then the work redesign.
  const order: AssessQuestionId[] = regulatedAgentic
    ? ['governance_risk', 'financial_return', 'strategic_alignment', 'change_enablement', 'work_architecture']
    : ['financial_return', 'governance_risk', 'strategic_alignment', 'change_enablement', 'work_architecture'];
  // An agent working alone answers every question in one call, so it is shown
  // every question still without an answer, each with its choices. A person is
  // asked one question at a time and never sees this list.
  const openQuestions: AssessOpenQuestion[] = byEvidence
    ? order.filter((id) => (id === 'work_architecture' ? !workAnswered : supplied[id] === undefined))
      .map((id) => ({ ...decider(track, id, resolved.ai_tier), choices: guidedChoices(track, id, resolved.ai_tier) }))
    : [];
  const judged = {
    ...base, missing_fields: [] as AssessField[],
    ...(evidenceMissing.length ? { evidence_missing: evidenceMissing } : {}),
    ...(openQuestions.length ? { open_questions: openQuestions } : {}),
  };
  const provenance: { provenance?: AssessProvenance } = byEvidence
    ? { provenance: { answered_by: 'evidence', statement: EVIDENCE_STATEMENT, answers_with_evidence: Object.keys(evidenceGiven).length } }
    : {};
  const answeredBy = byEvidence ? 'evidence' as const : 'owner' as const;

  // ── 4. Read the proposal against the answers ───────────────────────────
  // A phrase counts only against an answer that clears the bar. An answer that
  // already holds the initiative back agrees with the proposal.
  const favourable = (id: AssessQuestionId): boolean => {
    if (id === 'work_architecture') return workAnswered && Object.values(workInput ?? {}).some((part) => part === true);
    const value = supplied[id];
    return value !== undefined && (id === 'governance_risk' ? value <= 40 : value >= 60);
  };
  const findings = readProposal(proposal);
  const contradictions: AssessContradiction[] = findings.filter((found) => favourable(found.question)).map((found) => ({
    id: found.question, rule: found.rule, proposal_words: found.proposal_words, proposal_says: found.says,
    answer: answersGiven[found.question]?.label
      ?? (found.question === 'work_architecture' ? 'The work is shown as redesigned.' : `A score of ${supplied[found.question as keyof PillarScores]} out of 100.`),
  }));
  // The same published phrases are read in the evidence an agent quoted. A quote
  // that says the opposite of the answer it was given for holds the verdict at Fix.
  const evidenceRules: string[] = [];
  for (const id of Object.keys(evidenceGiven) as AssessQuestionId[]) {
    const found = evidenceGiven[id]!
      .map((item) => readProposal(item.quote).find((finding) => finding.question === id))
      .find((finding) => finding !== undefined);
    if (!found) continue;
    evidenceRules.push(`evidence_read:${found.rule}`);
    if (!favourable(id) || contradictions.some((item) => item.id === id)) continue;
    contradictions.push({
      id, rule: found.rule, proposal_words: found.proposal_words, proposal_says: found.says,
      answer: answersGiven[id]!.label, found_in: 'evidence',
    });
  }
  const proposalRules = [
    ...findings.map((found) => `proposal_read:${found.rule}`),
    ...evidenceRules,
    ...contradictions.map((item) => `contradiction:${item.id}`),
  ];

  // ── 5. Judge ───────────────────────────────────────────────────────────
  // One answer can stop the initiative on its own. Nothing else is needed for that.
  const stopOnGovernance = supplied.governance_risk !== undefined && supplied.governance_risk >= 70;
  const stopOnReturn = supplied.financial_return !== undefined && supplied.financial_return <= 20;
  if (suppliedCount < 4 && (stopOnGovernance || stopOnReturn)) {
    const verdict: AssessVerdict = {
      classification: 'Stop',
      ...plainResult({ track, aiTier: resolved.ai_tier, classification: 'Stop', supplied, answers: answersGiven, work: workArchitecture, workAnswered, workUnknown: unknown.includes('work_architecture'), contradictions, answeredBy }),
      contradictions,
      reason: stopOnGovernance ? 'Governance risk above the safe threshold.' : 'Financial return too thin to justify scope.',
      scores_supplied: supplied,
      answers_given: answersGiven,
      work_architecture: workArchitecture,
      audit: buildAudit([...rules, ...proposalRules, 'classify:Stop', `work_architecture:${workArchitecture.status}`, 'front_door:value_withheld'], auditInputs),
      value_note: VALUE_NOTE,
      ...provenance,
    };
    return { status: 'verdict', ...judged, verdict };
  }

  const pillarsClear = suppliedCount === 4
    && supplied.strategic_alignment! >= 60 && supplied.financial_return! >= 60
    && supplied.change_enablement! >= 60 && supplied.governance_risk! <= 40;
  const workOpen = !workAnswered && !unknown.includes('work_architecture');

  // Work redesign only decides the outcome once the four pillars clear, so it is asked last and only then.
  if (suppliedCount === 4 && !(pillarsClear && workOpen)) {
    // Revenue and readiness feed only the planning range, which the front door withholds.
    const full = score({
      industry: resolved.industry!, function: resolved.function!, ai_tier: resolved.ai_tier!,
      revenue_eur: 0, readiness: 'traditional',
      scores: supplied as PillarScores, work_architecture: workInput,
      ...(input.signal_completeness !== undefined ? { signal_completeness: input.signal_completeness } : {}),
    });
    const kept = full.audit.rules_fired.filter((rule) => !rule.startsWith('value:'));
    // A go-ahead cannot rest on an answer the proposal itself contradicts.
    const capped = full.classification === 'Accelerate' && contradictions.length > 0;
    const classification = capped ? 'Fix' : full.classification;
    const verdict: AssessVerdict = {
      classification,
      ...plainResult({ track, aiTier: resolved.ai_tier, classification, supplied, answers: answersGiven, work: full.work_architecture, workAnswered, workUnknown: unknown.includes('work_architecture'), contradictions, answeredBy }),
      contradictions,
      reason: !capped ? full.reason
        : contradictions.every((item) => item.found_in === 'evidence') ? 'The evidence contradicts an answer the go-ahead rests on.'
        : 'The proposal contradicts an answer the go-ahead rests on.',
      scores_supplied: supplied,
      answers_given: answersGiven,
      confidence: full.confidence,
      verdict_flips: full.sensitivity.verdict_flips,
      work_architecture: full.work_architecture,
      audit: buildAudit([...rules, ...kept, ...proposalRules, ...(capped ? ['cap:Fix(contradiction)'] : []), 'front_door:value_withheld'], auditInputs),
      value_note: VALUE_NOTE,
      ...provenance,
    };
    return { status: 'verdict', ...judged, verdict };
  }

  // Not enough to judge yet. Ask the next question, in the order set above.
  const open = order.filter((id) => !unknown.includes(id) && (id === 'work_architecture'
    ? !workAnswered
    : supplied[id] === undefined));
  const toFindOut = order.filter((id) => unknown.includes(id)).map((id) => decider(track, id, resolved.ai_tier));
  const pillarsOpen = open.filter((id) => id !== 'work_architecture');
  const next = pillarsOpen[0] ?? (pillarsClear ? open[0] : undefined);
  const warning = regulatedAgentic && supplied.governance_risk === undefined ? { warning: REGULATED_AGENTIC_WARNING } : {};

  if (!next) {
    // Every question has been put. What remains is for the user to find out.
    const list = toFindOut.map((d, i) => `${i + 1}. ${d.question}`).join(' ');
    return {
      status: 'not_enough_to_judge', ...judged,
      next_question: `Not enough to judge yet. Find out and come back: ${list}`,
      to_find_out: toFindOut, ...warning,
    };
  }

  const number = order.length - open.length + 1;
  const w = wordingFor(track, next, resolved.ai_tier);
  const question: AssessQuestion = {
    id: next, question: w.question, why: whyFor(track, next, resolved.ai_tier), choices: guidedChoices(track, next, resolved.ai_tier),
    answer_in: ANSWER_IN[next], where_to_look: whereToLookFor(next, resolved.ai_tier), number, of_at_most: MAX_QUESTIONS,
  };
  const decides = open.slice(0, 3).map((id) => decider(track, id, resolved.ai_tier));
  const alsoOpen = open.slice(3);
  return {
    status: 'not_enough_to_judge', ...judged,
    // The opening line is said once, on the first question.
    next_question: `${number === 1 ? 'Not enough to judge yet. ' : ''}Question ${number} of at most ${MAX_QUESTIONS}: ${w.question}`,
    question, decides,
    ...(alsoOpen.length ? { also_open: alsoOpen } : {}),
    ...(toFindOut.length ? { to_find_out: toFindOut } : {}),
    ...warning,
  };
}

export { SMALLER_FIRM_BELOW };
