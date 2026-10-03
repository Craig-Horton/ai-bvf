import { mapToTaxonomy } from './aliases.js';
import { score } from './score.js';
import type {
  AiTier, AssessField, AssessInitiativeInput, AssessInitiativeResult,
  FunctionId, Industry, Readiness, ScoreInput, TaxonomyMatch,
} from './types.js';

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

function nextQuestion(missing: AssessField[]): string {
  if (missing.length === 1) return QUESTIONS[missing[0]];
  const parts = missing.map((field) => QUESTION_PARTS[field]);
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
  const projectRevenueBefore = /\b(?:project|pilot|incremental|additional|projected|expected|potential|target)\s+(?:annual\s+)?(?:revenue|turnover)\s*(?:(?:of|is|was|at|around|about|approximately|approx\.?|equals)\s*)?[:=]?\s*$/i;
  const projectRevenueAfter = /^\s*(?:(?:in|of)\s+)?(?:incremental|additional|projected|expected|potential|target)\s+(?:annual\s+)?(?:revenue|turnover)\b/i;
  const companyAfter = /^\s*(?:(?:global|international|European)\s+)?(?:retailer|company|business|bank|manufacturer|organisation|organization|hospital|insurer|enterprise|non-profit|nonprofit)\b/i;
  const rangeAfter = new RegExp(String.raw`^\s*(?:[-–—/]|to\b|through\b|or\b)\s*(?:(?:${CURRENCY})\s*)?[0-9]`, 'i');
  const foreignSuffix = /^\s*(?:[A-Z]{3}\b|dollars?\b|pounds?\b|yen\b|yuan\b|renminbi\b|rupees?\b)/;
  const revenues: number[] = [];
  const otherAmounts: number[] = [];
  let unresolved = false;

  for (const match of text.matchAll(monetaryAmount)) {
    const { before: currencyBefore, after: currencyAfter, value, scale } = match.groups!;
    const before = text.slice(0, match.index).slice(-100);
    const after = text.slice(match.index! + match[0].length, match.index! + match[0].length + 100);
    const labelled = revenueBefore.test(before) || revenueAfter.test(after);
    if (projectRevenueBefore.test(before) || projectRevenueAfter.test(after)) continue;
    if (!labelled && (nonRevenueBefore.test(before) || nonRevenueAfter.test(after))) continue;
    const currencies = [currencyBefore, currencyAfter].filter(Boolean);
    const euro = currencies.length > 0 && currencies.every((currency) => /^(?:EUR|euros?|€)$/i.test(currency));
    const companySize = euro && companyAfter.test(after);
    if (!labelled && !companySize && !currencies.length) continue;
    const parsed = amount(value, scale);
    if ((currencies.length && !euro) || /[-−]\s*$/.test(before) || parsed === undefined
        || rangeAfter.test(after) || /^\s*[0-9]/.test(after)
        || (!currencies.length && foreignSuffix.test(after))) {
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

function proposalFor(field: Exclude<AssessField, 'revenue_eur'>, proposal: string): string {
  if (field !== 'function') return proposal;
  return proposal.replace(/(?:annual\s+)?(?:revenue|turnover)\s*(?:of|is|around|about|approximately|approx\.?|:)?\s*(?:EUR|€)?\s*[0-9]+(?:[,.][0-9]+)?\s*(?:k|thousand|m|mn|million|b|bn|billion)?/gi, '');
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

  for (const field of ['industry', 'function', 'ai_tier', 'readiness'] as const) {
    const provided = input[field]?.trim();
    const source = provided || proposalFor(field, proposal);
    const match = taxonomyMatch(field, source);
    if (match?.resolved) {
      setResolved(resolved, field, match.resolved);
      const origin = provided ? 'provided value' : 'proposal';
      resolutions.push(`${field} resolved as ${match.resolved} from ${origin}, matched on "${match.matched_on}".`);
    } else if (provided && match?.suggestions && !firstSuggestions) {
      firstSuggestions = match.suggestions;
    }
  }

  const revenue = input.revenue_eur ?? extractRevenueEur(proposal);
  if (typeof revenue === 'number' && Number.isFinite(revenue) && revenue >= 0) {
    resolved.revenue_eur = Math.round(revenue);
    resolutions.push(`revenue_eur resolved as ${Math.round(revenue)} from ${input.revenue_eur !== undefined ? 'provided value' : 'proposal'}.`);
  }
  if (input.scores) resolved.scores = input.scores;
  if (input.signal_completeness !== undefined) resolved.signal_completeness = input.signal_completeness;
  if (input.work_architecture) resolved.work_architecture = input.work_architecture;

  const missing = REQUIRED_FIELDS.filter((field) => resolved[field] === undefined);
  if (missing.length) {
    return {
      status: 'needs_input', proposal, resolved_inputs: resolved, resolutions,
      missing_fields: missing, next_question: nextQuestion(missing),
      ...(firstSuggestions ? { suggestions: firstSuggestions } : {}),
    };
  }

  const scoreInput = resolved as ScoreInput;
  return {
    status: 'verdict', proposal, resolved_inputs: scoreInput,
    resolutions, missing_fields: [], verdict: score(scoreInput),
  };
}
