/**
 * The front door for one AI investment decision, written for a regular user.
 *
 * 1. Read the context from the proposal: industry, business function, AI type
 *    and headcount. Anything unread is asked for, one item at a time.
 * 2. Read it back. The user confirms or corrects it before any question.
 * 3. Ask at most five plain questions, one at a time, each with everyday
 *    answers that carry a fixed, published score.
 * 4. Return Accelerate, Fix or Stop from those answers only. Nothing is
 *    filled in and no euro figure is given.
 */
import { mapToTaxonomy } from './aliases.js';
import { score } from './score.js';
import { buildAudit } from './audit.js';
import { assessWorkArchitecture } from './workArchitecture.js';
import { REGULATED_FUNCTIONS, REGULATED_INDUSTRIES } from './taxonomy.js';
import { plainResult } from './plainResult.js';
import {
  CHOICE_SCORES, QUESTION_WHY, SMALLER_FIRM_BELOW, UNKNOWN_LABEL, WORDING,
  WORK_ARCHITECTURE_CHOICES, trackFor,
} from './guidedQuestions.js';
import type {
  AiTier, AssessAnswer, AssessChoice, AssessChoiceId, AssessContext, AssessDecider, AssessField,
  AssessInitiativeInput, AssessInitiativeResult, AssessQuestion, AssessQuestionId, AssessTrack,
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

function guidedChoices(track: AssessTrack, id: AssessQuestionId): AssessChoice[] {
  const w = WORDING[track][id];
  return [
    { id: 'a', label: w.a }, { id: 'b', label: w.b }, { id: 'c', label: w.c }, { id: 'd', label: w.d },
    { id: 'unknown', label: UNKNOWN_LABEL },
  ];
}

function decider(track: AssessTrack, id: AssessQuestionId): AssessDecider {
  return { id, question: WORDING[track][id].question, why: QUESTION_WHY[track][id], answer_in: ANSWER_IN[id] };
}

export function assessInitiative(input: AssessInitiativeInput): AssessInitiativeResult {
  const proposal = input.proposal?.trim();
  if (!proposal) throw new Error('proposal must be a plain-English description of the AI initiative.');

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
  const rules: string[] = [`track:${track}`];

  const answerFor = (id: AssessQuestionId): AssessChoiceId | undefined => {
    const choice = input.answers?.[id];
    if (choice === undefined) return undefined;
    if (!['a', 'b', 'c', 'd', 'unknown'].includes(choice)) throw new Error(`answers.${id} must be one of a, b, c, d or unknown.`);
    return choice;
  };

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
      answersGiven[pillar] = { choice, label: WORDING[track][pillar][choice], score: value };
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
    answersGiven.work_architecture = { choice: workChoice, label: WORDING[track].work_architecture[workChoice] };
    rules.push(`answer:work_architecture=${workChoice}`);
  }
  const workArchitecture = assessWorkArchitecture(workInput);

  const auditInputs = {
    industry: resolved.industry, function: resolved.function, ai_tier: resolved.ai_tier,
    employees: resolved.employees, track, scores: supplied, answers: input.answers ?? null,
    work_architecture: workInput ?? null,
  };
  const suppliedCount = Object.keys(supplied).length;
  const regulatedAgentic = resolved.ai_tier === 'gen3'
    && (REGULATED_INDUSTRIES.has(resolved.industry!) || REGULATED_FUNCTIONS.has(resolved.function!));
  const judged = { ...base, missing_fields: [] as AssessField[] };

  // ── 4. Judge ───────────────────────────────────────────────────────────
  // One answer can stop the initiative on its own. Nothing else is needed for that.
  const stopOnGovernance = supplied.governance_risk !== undefined && supplied.governance_risk >= 70;
  const stopOnReturn = supplied.financial_return !== undefined && supplied.financial_return <= 20;
  if (suppliedCount < 4 && (stopOnGovernance || stopOnReturn)) {
    const verdict: AssessVerdict = {
      classification: 'Stop',
      ...plainResult({ track, classification: 'Stop', supplied, answers: answersGiven, work: workArchitecture, workAnswered, workUnknown: unknown.includes('work_architecture') }),
      reason: stopOnGovernance ? 'Governance risk above the safe threshold.' : 'Financial return too thin to justify scope.',
      scores_supplied: supplied,
      answers_given: answersGiven,
      work_architecture: workArchitecture,
      audit: buildAudit([...rules, 'classify:Stop', `work_architecture:${workArchitecture.status}`, 'front_door:value_withheld'], auditInputs),
      value_note: VALUE_NOTE,
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
    const verdict: AssessVerdict = {
      classification: full.classification,
      ...plainResult({ track, classification: full.classification, supplied, answers: answersGiven, work: full.work_architecture, workAnswered, workUnknown: unknown.includes('work_architecture') }),
      reason: full.reason,
      scores_supplied: supplied,
      answers_given: answersGiven,
      confidence: full.confidence,
      verdict_flips: full.sensitivity.verdict_flips,
      work_architecture: full.work_architecture,
      audit: buildAudit([...rules, ...kept, 'front_door:value_withheld'], auditInputs),
      value_note: VALUE_NOTE,
    };
    return { status: 'verdict', ...judged, verdict };
  }

  // Not enough to judge yet. Ask the next question: the two that can stop the
  // initiative first, then the two Accelerate needs, then the work redesign.
  const order: AssessQuestionId[] = regulatedAgentic
    ? ['governance_risk', 'financial_return', 'strategic_alignment', 'change_enablement', 'work_architecture']
    : ['financial_return', 'governance_risk', 'strategic_alignment', 'change_enablement', 'work_architecture'];
  const open = order.filter((id) => !unknown.includes(id) && (id === 'work_architecture'
    ? !workAnswered
    : supplied[id] === undefined));
  const toFindOut = order.filter((id) => unknown.includes(id)).map((id) => decider(track, id));
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
  const w = WORDING[track][next];
  const question: AssessQuestion = {
    id: next, question: w.question, why: QUESTION_WHY[track][next], choices: guidedChoices(track, next),
    answer_in: ANSWER_IN[next], number, of_at_most: MAX_QUESTIONS,
  };
  const decides = open.slice(0, 3).map((id) => decider(track, id));
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
