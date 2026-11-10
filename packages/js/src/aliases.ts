/**
 * map_to_taxonomy: senior users say "customer service", "procurement" and
 * "legal", not cx, supply and risk. This maps everyday business language
 * onto the canonical enums deterministically, so callers stop passing the
 * wrong function.
 *
 * Matching order: exact canonical id, exact alias, then whole-word phrase
 * match. A phrase never matches inside another word, the longest phrase
 * wins, and two phrases that point to different values return no value and
 * name both candidates. An unresolved field is a question for the user.
 */
import type { MapTaxonomyResult, TaxonomyMatch } from './types.js';
import { INDUSTRIES, FUNCTIONS, AI_TIERS, READINESS } from './taxonomy.js';

/**
 * strong: specific enough to trust inside a full proposal.
 * weak: ordinary words ("people", "support", "any") that carry the meaning
 * only as a short direct answer, never inside a longer description.
 */
interface AliasGroup { strong: string[]; weak?: string[] }

/** A direct answer is at most this many words; weak aliases apply only then. */
const SHORT_ANSWER_WORDS = 4;

const FUNCTION_ALIASES: Record<string, AliasGroup> = {
  cx: {
    strong: ['customer service', 'customer support', 'customer care', 'service desk', 'contact centre', 'contact center', 'customer experience', 'call centre', 'call center', 'helpdesk', 'help desk', 'client service', 'customer complaints', 'complaints handling', 'support team', 'cx'],
    weak: ['support', 'complaints'],
  },
  supply: {
    strong: ['procurement', 'supply chain', 'manufacturing ops', 'warehouse', 'warehousing', 'inventory', 'sourcing', 'fulfilment', 'fulfillment', 'purchasing'],
    weak: ['logistics', 'operations', 'ops', 'supply'],
  },
  rd: {
    strong: ['r&d', 'research and development', 'product development', 'product engineering', 'product team', 'engineering team'],
    weak: ['research', 'product', 'engineering', 'innovation', 'design', 'development'],
  },
  risk: {
    strong: ['legal', 'compliance', 'risk management', 'regulatory', 'fraud', 'internal audit', 'legal team', 'risk team'],
    weak: ['audit', 'governance', 'controls', 'risk'],
  },
  hr: {
    strong: ['recruiting', 'recruitment', 'human resources', 'people operations', 'l&d', 'learning and development', 'hr', 'hr team', 'onboarding', 'hiring'],
    weak: ['people', 'talent', 'workforce'],
  },
  sales: {
    strong: ['sales', 'sales team', 'marketing', 'business development', 'crm', 'account management', 'lead generation'],
    weak: ['revenue', 'commercial', 'growth', 'pipeline', 'pricing'],
  },
  it: {
    strong: ['it team', 'it department', 'it support', 'it helpdesk', 'it help desk', 'it service desk', 'it operations', 'it ops', 'devops', 'service management', 'itsm', 'security operations', 'it infrastructure', 'platform operations'],
    weak: ['technology', 'infrastructure', 'platform', 'cloud'],
  },
  finance: {
    strong: ['finance', 'finance team', 'accounting', 'bookkeeping', 'month end', 'fp&a', 'treasury', 'controlling', 'financial planning', 'financial reporting', 'billing', 'invoicing', 'accounts payable', 'accounts receivable', 'fpa'],
  },
};

const INDUSTRY_ALIASES: Record<string, AliasGroup> = {
  retail: {
    strong: ['retail', 'retailer', 'ecommerce', 'e-commerce', 'consumer goods', 'fmcg', 'grocery', 'fashion retail'],
    weak: ['fashion', 'shops'],
  },
  financial: {
    strong: ['financial services', 'banking', 'bank', 'retail bank', 'retail banking', 'insurance', 'insurer', 'fintech', 'asset management', 'wealth management', 'credit union', 'building society'],
    weak: ['financial', 'payments'],
  },
  healthcare: {
    strong: ['healthcare', 'health care', 'hospital', 'pharma', 'pharmaceutical', 'medtech', 'life sciences', 'clinic', 'care home', 'gp practice'],
    weak: ['clinical', 'health'],
  },
  manufacturing: {
    strong: ['manufacturing', 'manufacturer', 'automotive', 'factory', 'engineering company'],
    weak: ['industrial', 'production'],
  },
  technology: {
    strong: ['software', 'saas', 'it services', 'telecom', 'telecommunications', 'msp', 'managed service provider', 'managed services provider', 'technology company', 'tech company', 'tech startup', 'software company'],
    weak: ['technology', 'tech'],
  },
  logistics: {
    strong: ['logistics', 'shipping', 'freight', 'haulage', 'postal', 'logistics company', 'transport company'],
    weak: ['transport', 'distribution'],
  },
  energy: {
    strong: ['energy', 'utilities', 'utility', 'oil and gas', 'renewables', 'power company', 'power station'],
    weak: ['power'],
  },
  public_sector: {
    strong: ['public sector', 'government', 'municipality', 'public services', 'civil service', 'defence', 'defense', 'local authority', 'council'],
  },
  professional: {
    strong: ['professional services', 'consulting', 'consultancy', 'law firm', 'accounting firm', 'accountancy', 'accountancy firm', 'accountancy practice', 'accounting practice', 'accountants', 'bookkeeping firm', 'architecture practice', 'recruitment agency'],
    weak: ['agency'],
  },
  education: {
    strong: ['education', 'university', 'edtech', 'training provider', 'college'],
    weak: ['school'],
  },
  real_estate: {
    strong: ['real estate', 'housing association', 'construction', 'proptech', 'property management', 'property company', 'estate agency'],
    weak: ['property', 'housing'],
  },
  creative: {
    strong: ['creative agency', 'entertainment', 'publishing', 'advertising', 'design studio', 'design agency', 'media company', 'marketing agency'],
    weak: ['creative', 'media', 'gaming'],
  },
  nonprofit: {
    strong: ['nonprofit', 'ngo', 'charity', 'not for profit', 'non-profit'],
    weak: ['foundation'],
  },
  universal: {
    strong: ['cross-industry', 'general business'],
    weak: ['general', 'any', 'other'],
  },
};

const TIER_ALIASES: Record<string, AliasGroup> = {
  gen1: {
    strong: ['rpa', 'automation', 'scripted', 'rules based', 'workflow automation', 'macros', 'classic ml'],
  },
  gen2: {
    strong: ['genai', 'gen ai', 'generative ai', 'llm', 'copilot', 'chatbot', 'ai assistant', 'gpt', 'chatgpt', 'claude', 'gemini', 'summarisation', 'summarization', 'drafting'],
    weak: ['assistant'],
  },
  gen3: {
    strong: ['agentic', 'ai agent', 'autonomous', 'autonomous agent', 'multi-agent', 'auto-pilot', 'autopilot', 'self-directed'],
    weak: ['agent'],
  },
};

const READINESS_ALIASES: Record<string, AliasGroup> = {
  agile: {
    strong: ['agile', 'cross-functional', 'startup', 'product-led', 'fast-moving', 'empowered teams', 'change-ready'],
    weak: ['collaborative'],
  },
  traditional: {
    strong: ['traditional', 'hierarchy', 'hierarchical', 'an established'],
    weak: ['functional', 'corporate', 'committee', 'matrix', 'established'],
  },
  siloed: {
    strong: ['siloed', 'silo', 'bureaucratic', 'territorial', 'legacy culture', 'work separately'],
    weak: ['rigid', 'slow', 'political', 'fragmented'],
  },
};

/** Lowercase words; hyphens, slashes and underscores separate, "&" stays ("r&d"). */
function words(value: string): string[] {
  return value.toLowerCase().replace(/[_\-/]+/g, ' ').replace(/[^a-z0-9&\s]/g, ' ').split(/\s+/).filter(Boolean);
}

interface Hit { canon: string; alias: string; start: number; end: number }

/** Every place an alias appears as whole words. A plural "s" on the last word is tolerated. */
function findHits(tokens: string[], canon: string, alias: string): Hit[] {
  const a = words(alias);
  const hits: Hit[] = [];
  if (!a.length) return hits;
  for (let i = 0; i + a.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < a.length && ok; j++) {
      const t = tokens[i + j];
      const last = j === a.length - 1;
      ok = t === a[j] || (last && a[j].length > 2 && t === `${a[j]}s`);
    }
    if (ok) hits.push({ canon, alias, start: i, end: i + a.length });
  }
  return hits;
}

/**
 * Removes every hit that lies inside a strictly longer hit. One ordered sweep,
 * so a proposal that repeats a phrase thousands of times stays fast: comparing
 * every hit with every other hit is quadratic in the length of the input.
 */
function dropContained(hits: Hit[]): Hit[] {
  const ordered = [...hits].sort((x, y) => x.start - y.start || y.end - x.end);
  const kept: Hit[] = [];
  let endBefore = -1;   // furthest end among hits that start earlier
  let groupStart = -1;  // start shared by the current group of hits
  let groupEnd = -1;    // furthest end within that group, which sorts first
  for (const hit of ordered) {
    if (hit.start !== groupStart) {
      endBefore = Math.max(endBefore, groupEnd);
      groupStart = hit.start;
      groupEnd = hit.end;
    }
    const insideEarlier = endBefore >= hit.end;
    const insideSameStart = groupEnd > hit.end;
    if (!insideEarlier && !insideSameStart) kept.push(hit);
  }
  return kept;
}

function matchOne(
  input: string,
  canon: readonly string[],
  aliases: Record<string, AliasGroup>,
): TaxonomyMatch {
  const tokens = words(input);
  const norm = tokens.join(' ');
  const compact = tokens.join('');

  for (const c of canon) {
    if (compact === c.toLowerCase().replace(/[_\s]+/g, '')) return { input, resolved: c, matched_on: 'exact' };
  }
  for (const [c, group] of Object.entries(aliases)) {
    for (const a of [...group.strong, ...(group.weak ?? [])]) {
      if (norm === words(a).join(' ')) return { input, resolved: c, matched_on: a };
    }
  }

  const short = tokens.length <= SHORT_ANSWER_WORDS;
  const all: Hit[] = [];
  for (const [c, group] of Object.entries(aliases)) {
    for (const a of short ? [...group.strong, ...(group.weak ?? [])] : group.strong) {
      for (const hit of findHits(tokens, c, a)) all.push(hit);
    }
  }
  // A phrase that sits inside a longer matched phrase gives way to it:
  // "retail" inside "retail bank" does not compete with it.
  const kept = dropContained(all);
  const candidates = [...new Set(kept.map((h) => h.canon))];
  if (candidates.length === 1) {
    const best = kept.reduce((a, b) => ((b.end - b.start) > (a.end - a.start) ? b : a));
    return { input, resolved: best.canon, matched_on: best.alias };
  }
  if (candidates.length > 1) {
    // Order the candidates as the canonical list does, so the result is stable.
    const ordered = canon.filter((c) => candidates.includes(c));
    return { input, resolved: null, candidates: ordered, suggestions: [...canon] };
  }
  return { input, resolved: null, suggestions: [...canon] };
}

export function mapToTaxonomy(input: {
  industry?: string;
  function?: string;
  ai_tier?: string;
  readiness?: string;
}): MapTaxonomyResult {
  const out: MapTaxonomyResult = {
    guidance: 'Pass the resolved values to score_initiative, score_portfolio, sequence_portfolio, recommend_improvements, calculate_pace_layer_drag, get_benchmark or infer_readiness. A null resolution means no confident match: ask the user to choose. When candidates are present the wording pointed to more than one value, so ask the user to pick between those candidates.',
  };
  if (input.industry !== undefined) out.industry = matchOne(input.industry, INDUSTRIES, INDUSTRY_ALIASES);
  if (input.function !== undefined) out.function = matchOne(input.function, FUNCTIONS, FUNCTION_ALIASES);
  if (input.ai_tier !== undefined) out.ai_tier = matchOne(input.ai_tier, AI_TIERS, TIER_ALIASES);
  if (input.readiness !== undefined) out.readiness = matchOne(input.readiness, READINESS, READINESS_ALIASES);
  return out;
}
