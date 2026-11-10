import { mapToTaxonomy } from './aliases.js';
import { score } from './score.js';
import { buildAudit } from './audit.js';
import { assessWorkArchitecture } from './workArchitecture.js';
import { REGULATED_FUNCTIONS, REGULATED_INDUSTRIES } from './taxonomy.js';
import type {
  AiTier, AssessDecider, AssessField, AssessInitiativeInput, AssessInitiativeResult,
  AssessVerdict, FunctionId, Industry, PillarScores, Readiness, ScoreInput, TaxonomyMatch,
} from './types.js';

const PILLARS = ['strategic_alignment', 'financial_return', 'change_enablement', 'governance_risk'] as const;

const VALUE_NOTE = 'No euro figure is given. A value has to be worked out from the organisation\'s own volumes, hours and costs.';

const DECIDERS: Record<AssessDecider['id'], Omit<AssessDecider, 'id'>> = {
  governance_risk: {
    question: 'What could go wrong, and who can stop or override the AI?',
    why: 'Risk that nobody controls stops the initiative on its own.',
    answer_in: 'scores.governance_risk, 0 to 100, higher means more risk',
  },
  financial_return: {
    question: 'What does it cost to build and run, and what does it return each year?',
    why: 'A return too thin for the scope stops the initiative on its own.',
    answer_in: 'scores.financial_return, 0 to 100',
  },
  strategic_alignment: {
    question: 'Which business result does this move, and by how much?',
    why: 'Accelerate needs a clear link to a result the organisation already tracks.',
    answer_in: 'scores.strategic_alignment, 0 to 100',
  },
  change_enablement: {
    question: 'Who owns the change, and are the time and budget to make it happen funded?',
    why: 'Accelerate needs a named owner and funded change work.',
    answer_in: 'scores.change_enablement, 0 to 100',
  },
  work_architecture: {
    question: 'What changes in the workflow, the roles, the decision rights and the measures before go-live?',
    why: 'Accelerate needs the work redesigned around the AI, with all four checks shown.',
    answer_in: 'work_architecture, four true or false checks',
  },
};

const REGULATED_AGENTIC_WARNING = 'Agentic AI in a regulated setting cannot proceed until its controls are shown. Answer the governance question first.';

const REQUIRED_FIELDS: AssessField[] = ['industry', 'revenue_eur', 'function', 'ai_tier', 'readiness'];

const QUESTIONS: Record<AssessField, string> = {
  industry: 'Which industry is this initiative for?',
  revenue_eur: "What is the organisation's approximate annual revenue in EUR?",
  function: 'Which business function owns this work: finance, HR, sales, supply chain, customer experience, risk, IT, or R&D?',
  ai_tier: 'Is this automation, GenAI, or an agentic system?',
  readiness: 'How does the organisation work today: agile, traditional, or siloed?',
};

const QUESTION_PARTS: Record<AssessField, string> = {
  industry: 'industry',
  revenue_eur: 'approximate annual revenue in EUR',
  function: 'owning business function',
  ai_tier: 'AI type (automation, GenAI, or agentic)',
  readiness: 'current operating model (agile, traditional, or siloed)',
};

/** Everyday names for the canonical values, used when reading a proposal back. */
const PLAIN: Record<Exclude<AssessField, 'revenue_eur'>, Record<string, string>> = {
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
  readiness: { agile: 'agile', traditional: 'traditional', siloed: 'siloed' },
};

const FIELD_NAME: Record<AssessField, string> = {
  industry: 'industry', revenue_eur: 'annual revenue', function: 'business function',
  ai_tier: 'AI type', readiness: 'way of working',
};

type Ambiguous = Partial<Record<AssessField, string[]>>;

function choices(field: AssessField, values: string[]): string {
  const names = values.map((value) => PLAIN[field as Exclude<AssessField, 'revenue_eur'>][value] ?? value);
  const final = names.pop();
  return names.length ? `${names.join(', ')} or ${final}` : `${final}`;
}

function nextQuestion(missing: AssessField[], ambiguous: Ambiguous): string {
  if (missing.length === 1) {
    const field = missing[0];
    const options = ambiguous[field];
    return options
      ? `The proposal points to more than one ${FIELD_NAME[field]}: ${choices(field, options)}. Which one applies?`
      : QUESTIONS[field];
  }
  const parts = missing.map((field) => {
    const options = ambiguous[field];
    return options ? `${FIELD_NAME[field]} (the proposal points to ${choices(field, options)})` : QUESTION_PARTS[field];
  });
  const final = parts.pop();
  return `To return a provisional verdict in one more step, what are the ${parts.join(', ')}, and ${final}?`;
}

const MULTIPLIER: Record<string, number> = {
  k: 1_000, thousand: 1_000,
  m: 1_000_000, mn: 1_000_000, million: 1_000_000,
  b: 1_000_000_000, bn: 1_000_000_000, billion: 1_000_000_000,
};

const SCALE = 'billion|million|thousand|bn|mn|[kmb]';
const CURRENCY = 'EUR|euros?|USD|dollars?|GBP|pounds?|CHF|AUD|CAD|NZD|SEK|NOK|DKK|JPY|CNY|INR|BRL|RUB|ZAR|AED|SGD|HKD|PLN|CZK|HUF|KRW|ILS|TRY|MXN|TWD|THB|MYR|PHP|IDR|[€$£¥]';

function amount(value: string, scale?: string): number | undefined {
  const compact = value.replace(/ /g, '');
  let normalized = compact;
  if (compact.includes(',') && compact.includes('.')) {
    if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(compact)) {
      normalized = compact.replace(/,/g, '');
    } else if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(compact)) {
      normalized = compact.replace(/\./g, '').replace(',', '.');
    } else return undefined;
  } else if (/[,.]/.test(compact)) {
    const parts = compact.split(/[,.]/);
    const grouped = /^\d{1,3}(?:[,.]\d{3})+$/.test(compact);
    // A scaled value such as "1,200 million" has two plausible readings.
    if (scale && grouped) return undefined;
    if (grouped) normalized = compact.replace(/[,.]/g, '');
    else if (parts.length === 2) normalized = compact.replace(',', '.');
    else return undefined;
  }
  const result = Math.round(Number(normalized) * (scale ? MULTIPLIER[scale.toLowerCase()] : 1));
  return Number.isSafeInteger(result) && result >= 0 ? result : undefined;
}

/**
 * Reads revenue-labelled amounts and explicit EUR company-size descriptions.
 * Costs, foreign currencies and conflicting amounts require a revenue answer.
 * Unmarked revenue/turnover retains the EUR default used by the assessment.
 */
export function extractRevenueEur(proposal: string): number | undefined {
  const text = proposal.replace(/[\u00a0\u202f]/g, ' ');
  const number = '(?:[0-9]{1,3}(?: [0-9]{3})+(?:[.,][0-9]+)?|[0-9]+(?:[.,][0-9]+)*)';
  const monetaryAmount = new RegExp(
    String.raw`(?<![\w.,])(?:(?<before>${CURRENCY})\s*)?(?<value>${number})\s*(?<scale>${SCALE})?(?![\w]|[.,][0-9])(?:\s*(?<after>${CURRENCY})(?!\w|\s*[0-9]))?`,
    'gi',
  );
  const revenueBefore = /\b(?:revenue|turnover)\s*(?:(?:of|is|was|at|around|about|approximately|approx\.?|equals)\s*)?[:=]?\s*$/i;
  const revenueAfter = /^\s*(?:(?:in|of)\s+)?(?:annual\s+)?(?:revenue|turnover)\b/i;
  const nonRevenueBefore = /\b(?:pilot|project|budget|costs?|spend|investment|savings?|benefits?|funding|profit|valuation)\s*(?:(?:of|is|are|was|at|around|about|approximately|approx\.?|equals)\s*)?[:=]?\s*$/i;
  const nonRevenueAfter = /^\s*(?:(?:in|of|for|annual|projected|expected|implementation|operating)\s+)*(?:pilot|project|budget|costs?|spend|investment|savings?|benefits?|funding|profit|valuation)\b/i;
  const projectRevenueBefore = /\b(?:(?:project|pilot|initiative)(?:['’]s)?|incremental|additional|projected|expected|potential|target|expect|forecast|anticipate)\s+(?:annual\s+)?(?:revenue|turnover)\s*(?:(?:of|is|was|at|around|about|approximately|approx\.?|equals)\s*)?[:=]?\s*$/i;
  const projectRevenueAfter = /^\s*(?:(?:in|of)\s+)?(?:incremental|additional|projected|expected|potential|target)\s+(?:annual\s+)?(?:revenue|turnover)\b/i;
  const projectRevenueSource = /^\s*(?:(?:in|of)\s+)?(?:(?:annual|incremental|additional|projected|expected|potential|target)\s+)?(?:(?:revenue|turnover)\s+)?(?:from|for|generated\s+by|attributable\s+to)\s+(?:(?:the|this|our|an?)\s+)?(?:pilot|project|initiative)\b/i;
  const periodicRevenueBefore = /\b(?:monthly|quarterly|weekly|daily|Q[1-4])\s+(?:(?:company|organisation|organization)\s+)?(?:revenue|turnover)\s*(?:(?:of|is|was|at|around|about|approximately|approx\.?|equals)\s*)?[:=]?\s*$/i;
  const periodicRevenueAfter = /^\s*(?:(?:in|of)\s+)?(?:(?:revenue|turnover)\s+)?(?:(?:per|a|each|every)\s+(?:month|quarter|week|day)\b|(?:monthly|quarterly|weekly|daily)\b|\/\s*(?:month|quarter|week|day)\b)/i;
  // "15m euro IT services company": up to three describing words may sit between the
  // amount and the organisation noun, but never a preposition or verb ("EUR 2m saved by the business").
  const companyAfter = /^\s*(?:(?!(?:at|for|by|in|to|from|of|on|with|per|and|or|that|which|is|was|are|will|would|saved|spent|invested|raised|paid|lost)\b)[\w&-]+\s+){0,3}?(?:retailer|company|business|bank|manufacturer|organisation|organization|hospital|insurer|enterprise|non-profit|nonprofit|firm|practice|agency|group|provider|msp|charity|startup|consultancy|partnership|council|university|school|studio|clinic)\b/i;
  const rangeAfter = new RegExp(String.raw`^\s*(?:[-–—/]|to\b|through\b|or\b)\s*(?:(?:${CURRENCY})\s*)?[0-9]`, 'i');
  const foreignCodeSuffix = /^\s*[A-Z]{3}\b/;
  const foreignSuffix = /^\s*(?:dollars?\b|pounds?\b|yen\b|yuan\b|renminbi\b|rupees?\b)/i;
  const revenues: number[] = [];
  const otherAmounts: number[] = [];
  let unresolved = false;

  for (const match of text.matchAll(monetaryAmount)) {
    const { before: currencyBefore, after: currencyAfter, value, scale } = match.groups!;
    const before = text.slice(0, match.index).slice(-100);
    const after = text.slice(match.index! + match[0].length, match.index! + match[0].length + 100);
    const labelled = revenueBefore.test(before) || revenueAfter.test(after);
    if (projectRevenueBefore.test(before) || projectRevenueAfter.test(after)
        || projectRevenueSource.test(after) || periodicRevenueBefore.test(before)
        || periodicRevenueAfter.test(after)) continue;
    if (!labelled && (nonRevenueBefore.test(before) || nonRevenueAfter.test(after))) continue;
    const currencies = [currencyBefore, currencyAfter].filter(Boolean);
    const euro = currencies.length > 0 && currencies.every((currency) => /^(?:EUR|euros?|€)$/i.test(currency));
    const companySize = euro && companyAfter.test(after);
    if (!labelled && !companySize && !currencies.length) continue;
    const parsed = amount(value, scale);
    if ((currencies.length && !euro) || /[-−]\s*$/.test(before) || parsed === undefined
        || rangeAfter.test(after) || /^\s*[0-9]/.test(after)
        || (!currencies.length && (foreignCodeSuffix.test(after) || foreignSuffix.test(after)))) {
      if (labelled || companySize) unresolved = true;
      continue;
    }
    if (labelled || companySize) revenues.push(parsed);
    else otherAmounts.push(parsed);
  }

  const distinct = new Set(revenues);
  if (unresolved || distinct.size !== 1) return undefined;
  const revenue = revenues[0];
  return otherAmounts.some((value) => value !== revenue) ? undefined : revenue;
}

/** One plain statement of how the proposal was read, so the user can correct it. */
function understoodStatement(resolved: Partial<ScoreInput>, missing: AssessField[]): string {
  const read: string[] = [];
  if (resolved.industry) read.push(`industry ${PLAIN.industry[resolved.industry]}`);
  if (resolved.function) read.push(`business function ${PLAIN.function[resolved.function]}`);
  if (resolved.ai_tier) read.push(`AI type ${PLAIN.ai_tier[resolved.ai_tier]}`);
  if (resolved.readiness) read.push(`way of working ${PLAIN.readiness[resolved.readiness]}`);
  if (resolved.revenue_eur !== undefined) read.push(`annual revenue EUR ${resolved.revenue_eur.toLocaleString('en-GB')}`);
  const open = missing.map((field) => FIELD_NAME[field]);
  const readPart = read.length ? `Read as: ${read.join('; ')}.` : 'Nothing in the proposal could be read with confidence.';
  const openPart = open.length ? ` Not yet known: ${open.join(', ')}.` : '';
  const fix = read.length ? ' Correct any item by supplying it in its own field.' : '';
  return `${readPart}${openPart}${fix}`;
}

function proposalFor(
  field: Exclude<AssessField, 'revenue_eur'>,
  proposal: string,
  industryPhrase?: string,
): string {
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

function taxonomyMatch(field: Exclude<AssessField, 'revenue_eur'>, value: string): TaxonomyMatch | undefined {
  const mapped = mapToTaxonomy({ [field]: value });
  return mapped[field];
}

function setResolved(
  resolved: Partial<ScoreInput>,
  field: Exclude<AssessField, 'revenue_eur'>,
  value: string,
): void {
  if (field === 'industry') resolved.industry = value as Industry;
  if (field === 'function') resolved.function = value as FunctionId;
  if (field === 'ai_tier') resolved.ai_tier = value as AiTier;
  if (field === 'readiness') resolved.readiness = value as Readiness;
}

export function assessInitiative(input: AssessInitiativeInput): AssessInitiativeResult {
  const proposal = input.proposal?.trim();
  if (!proposal) throw new Error('proposal must be a plain-English description of the AI initiative.');

  const resolved: Partial<ScoreInput> = {};
  const resolutions: string[] = [];
  let firstSuggestions: string[] | undefined;
  const ambiguous: Ambiguous = {};
  const inferred: AssessField[] = [];

  let industryPhrase: string | undefined;
  for (const field of ['industry', 'function', 'ai_tier', 'readiness'] as const) {
    const provided = input[field]?.trim();
    const source = provided || proposalFor(field, proposal, industryPhrase);
    const match = taxonomyMatch(field, source);
    if (field === 'industry' && !provided && match?.resolved && match.matched_on !== 'exact') industryPhrase = match.matched_on;
    if (match?.resolved) {
      setResolved(resolved, field, match.resolved);
      const origin = provided ? 'provided value' : 'proposal';
      if (!provided) inferred.push(field);
      resolutions.push(`${field} resolved as ${match.resolved} from ${origin}, matched on "${match.matched_on}".`);
    } else {
      if (match?.candidates) ambiguous[field] = match.candidates;
      if (provided && match?.suggestions && !firstSuggestions) firstSuggestions = match.suggestions;
    }
  }

  const revenue = input.revenue_eur ?? extractRevenueEur(proposal);
  if (typeof revenue === 'number' && Number.isFinite(revenue) && revenue >= 0) {
    resolved.revenue_eur = Math.round(revenue);
    resolutions.push(`revenue_eur resolved as ${Math.round(revenue)} from ${input.revenue_eur !== undefined ? 'provided value' : 'proposal'}.`);
    if (input.revenue_eur === undefined) inferred.push('revenue_eur');
  }
  if (input.scores) resolved.scores = input.scores;
  if (input.signal_completeness !== undefined) resolved.signal_completeness = input.signal_completeness;
  if (input.work_architecture) resolved.work_architecture = input.work_architecture;

  const missing = REQUIRED_FIELDS.filter((field) => resolved[field] === undefined);
  const understood = understoodStatement(resolved, missing);
  if (missing.length) {
    return {
      status: 'needs_input', proposal, resolved_inputs: resolved, resolutions,
      missing_fields: missing, next_question: nextQuestion(missing, ambiguous),
      ...(firstSuggestions ? { suggestions: firstSuggestions } : {}),
      ...(Object.keys(ambiguous).length ? { ambiguous_fields: ambiguous } : {}),
      inferred_fields: inferred, understood,
    };
  }

  const scoreInput = resolved as ScoreInput;
  const supplied: Partial<PillarScores> = {};
  for (const pillar of PILLARS) {
    const value = input.scores?.[pillar];
    if (typeof value === 'number' && Number.isFinite(value)) supplied[pillar] = value;
  }
  const suppliedCount = Object.keys(supplied).length;
  const workArchitecture = assessWorkArchitecture(input.work_architecture);
  const regulatedAgentic = scoreInput.ai_tier === 'gen3'
    && (REGULATED_INDUSTRIES.has(scoreInput.industry) || REGULATED_FUNCTIONS.has(scoreInput.function));
  const base = {
    proposal, resolved_inputs: scoreInput, resolutions,
    missing_fields: [] as AssessField[], inferred_fields: inferred, understood,
  };

  // A supplied score can stop the initiative on its own. Nothing else is needed for that.
  const stopOnGovernance = supplied.governance_risk !== undefined && supplied.governance_risk >= 70;
  const stopOnReturn = supplied.financial_return !== undefined && supplied.financial_return <= 20;
  if (suppliedCount < 4 && (stopOnGovernance || stopOnReturn)) {
    const verdict: AssessVerdict = {
      classification: 'Stop',
      reason: stopOnGovernance ? 'Governance risk above the safe threshold.' : 'Financial return too thin to justify scope.',
      scores_supplied: supplied,
      work_architecture: workArchitecture,
      audit: buildAudit(
        [`supplied:${Object.keys(supplied).join(',')}`, 'classify:Stop', `work_architecture:${workArchitecture.status}`, 'front_door:value_withheld'],
        { industry: scoreInput.industry, revenue_eur: scoreInput.revenue_eur, function: scoreInput.function, ai_tier: scoreInput.ai_tier, readiness: scoreInput.readiness, scores: supplied, work_architecture: input.work_architecture ?? null },
      ),
      value_note: VALUE_NOTE,
    };
    return { status: 'verdict', ...base, verdict };
  }

  if (suppliedCount === 4) {
    const full = score(scoreInput);
    const verdict: AssessVerdict = {
      classification: full.classification,
      reason: full.reason,
      scores_supplied: supplied,
      confidence: full.confidence,
      verdict_flips: full.sensitivity.verdict_flips,
      work_architecture: full.work_architecture,
      audit: {
        ...full.audit,
        rules_fired: [...full.audit.rules_fired.filter((rule) => !rule.startsWith('value:')), 'front_door:value_withheld'],
      },
      value_note: VALUE_NOTE,
    };
    return { status: 'verdict', ...base, verdict };
  }

  // Not enough supplied to judge. Name what decides it, most decisive first:
  // the two pillars that can stop the initiative, then the two Accelerate needs.
  const order: AssessDecider['id'][] = regulatedAgentic
    ? ['governance_risk', 'financial_return', 'strategic_alignment', 'change_enablement', 'work_architecture']
    : ['financial_return', 'governance_risk', 'strategic_alignment', 'change_enablement', 'work_architecture'];
  const open = order.filter((id) => (id === 'work_architecture'
    ? workArchitecture.status !== 'ready'
    : supplied[id] === undefined));
  const decides: AssessDecider[] = open.slice(0, 3).map((id) => ({ id, ...DECIDERS[id] }));
  const alsoOpen = open.slice(3);
  const count = ['One thing decides', 'Two things decide', 'Three things decide'][decides.length - 1];
  const decidingQuestion = `Not enough to judge yet. ${count} it. ${decides.map((d, i) => `${i + 1}. ${d.question}`).join(' ')}`;
  return {
    status: 'not_enough_to_judge', ...base,
    next_question: decidingQuestion, decides,
    ...(alsoOpen.length ? { also_open: alsoOpen } : {}),
    ...(regulatedAgentic && supplied.governance_risk === undefined ? { warning: REGULATED_AGENTIC_WARNING } : {}),
  };
}
