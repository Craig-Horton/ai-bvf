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

function amount(value: string, scale?: string): number {
  const base = Number(value.replace(/,/g, ''));
  return Math.round(base * (scale ? MULTIPLIER[scale.toLowerCase()] ?? 1 : 1));
}

/** Extracts EUR revenue only; it never converts another currency silently. */
export function extractRevenueEur(proposal: string): number | undefined {
  const text = proposal.replace(/\u00a0/g, ' ');
  const scale = '(k|thousand|m|mn|million|b|bn|billion)?';
  const value = '([0-9]+(?:[,.][0-9]+)?)';
  const patterns = [
    new RegExp(`(?:EUR|€)\\s*${value}\\s*${scale}`, 'i'),
    new RegExp(`${value}\\s*${scale}\\s*(?:EUR|euros?|euro)\\b`, 'i'),
    new RegExp(`(?:annual\\s+)?(?:revenue|turnover)\\s*(?:of|is|around|about|approximately|approx\\.?|:)??\\s*(?:EUR|€)?\\s*${value}\\s*${scale}`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return amount(match[1], match[2]);
  }
  return undefined;
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
