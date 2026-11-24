/**
 * assemble_portfolio: agents arrive with initiative names, plain-language
 * functions and half the pillar scores, then hand-build the portfolio JSON
 * and get the shape wrong. This assembles the canonical BVF v1.0 document
 * from loose inputs deterministically: aliases resolved through the same
 * taxonomy mapping as map_to_taxonomy, ids generated from names, missing
 * pillars estimated with provenance reported, and the finished document
 * validated before it is returned. Pure function, no state, nothing stored.
 */
import type {
  AuditRecord, Bucket, ComplianceFramework, FourPillarScore, Initiative,
  PillarScores, Portfolio, Readiness, ValidationResult,
} from './types.js';
import { mapToTaxonomy } from './aliases.js';
import { estimatePillars } from './score.js';
import { validate } from './validate.js';
import { buildAudit } from './audit.js';

const PILLARS = ['strategic_alignment', 'financial_return', 'change_enablement', 'governance_risk'] as const;

/** Confidence attached to pillar values the assembler estimated rather than received. */
const ESTIMATED_CONFIDENCE = 40;

export interface AssembleInitiativeInput {
  /** Required. Plain name, used to generate the id when none is given. */
  name: string;
  /** Optional slug (lowercase letters, digits, hyphens). Generated from the name when absent. */
  id?: string;
  /** Business function, canonical or plain language ("customer service" resolves to cx). */
  function: string;
  /** AI tier, canonical or plain language ("agentic" resolves to gen3). */
  ai_tier: string;
  /** The pillar scores you have evidence for, as bare numbers 0 to 100. Missing pillars are estimated and reported. */
  scores?: Partial<PillarScores>;
  bucket?: Bucket;
  compliance?: ComplianceFramework[];
}

export interface AssembleInput {
  organization: {
    name: string;
    /** Canonical or plain language ("banking" resolves to financial). */
    industry: string;
    revenue_eur?: number;
    region?: string;
    headcount?: number;
  };
  initiatives: AssembleInitiativeInput[];
  /** Organisational readiness, canonical or plain language. Drives pillar estimation. Defaults to traditional. */
  readiness?: string;
}

export interface AssembleIssue {
  path: string;
  msg: string;
  suggestions?: string[];
  /** Set where a client can act on the kind of issue: duplicate_suspected. */
  code?: 'duplicate_suspected';
}

export interface AssembleResult {
  /** The assembled BVF v1.0 document, or null when a required field could not be resolved. */
  portfolio: Portfolio | null;
  /** Plain-language notes on every alias resolution the assembler performed. */
  resolutions: string[];
  /** Initiative id to the pillars the assembler estimated, so scoring can haircut honestly. */
  estimated_pillars: Record<string, string[]>;
  /** Every default the assembler applied, in plain language. No hidden judgements: what was not given is named here. */
  assumptions: string[];
  /** Unresolved or invalid inputs, each with suggestions where the taxonomy has them. */
  issues: AssembleIssue[];
  /** validate() run on the assembled document. Null when assembly failed. */
  validation: ValidationResult | null;
  /** The readiness used for estimation, resolved or defaulted. */
  readiness_used: Readiness;
  guidance: string;
  audit: AuditRecord;
}

function slugify(name: string): string {
  // Input is uncontrolled tool input: cap it before any regex work, and trim
  // hyphen runs with index arithmetic rather than unanchored regexes, which
  // backtrack polynomially on adversarial strings of repeated separators.
  const slug = name.slice(0, 240).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64);
  let start = 0, end = slug.length;
  while (start < end && slug[start] === '-') start++;
  while (end > start && slug[end - 1] === '-') end--;
  return slug.slice(start, end) || 'initiative';
}

export function assemblePortfolio(input: AssembleInput): AssembleResult {
  const issues: AssembleIssue[] = [];
  const resolutions: string[] = [];
  const assumptions: string[] = [];
  const estimated: Record<string, string[]> = {};
  const rules: string[] = [];

  const orgIn = input?.organization;
  const list = input?.initiatives;
  if (!orgIn || typeof orgIn.name !== 'string' || !orgIn.name) {
    issues.push({ path: 'organization.name', msg: 'Required. The organisation the portfolio belongs to.' });
  }
  if (!Array.isArray(list) || list.length === 0) {
    issues.push({ path: 'initiatives', msg: 'Required. At least one initiative to assemble.' });
  }

  // Readiness: resolved from plain language, defaulted when absent or unresolvable.
  let readiness: Readiness = 'traditional';
  if (input?.readiness) {
    const m = mapToTaxonomy({ readiness: input.readiness }).readiness;
    if (m?.resolved) {
      readiness = m.resolved as Readiness;
      if (m.matched_on !== 'exact') { resolutions.push(`readiness: ${input.readiness} resolved to ${readiness}`); rules.push('alias:readiness'); }
    } else {
      issues.push({ path: 'readiness', msg: `Could not resolve "${input.readiness}". Defaulted to traditional.`, suggestions: m?.suggestions });
      assumptions.push('Readiness defaulted to traditional because the given value did not resolve. Estimated pillars lean on it.');
      rules.push('default:readiness');
    }
  } else {
    assumptions.push('Readiness was not given: defaulted to traditional. Estimated pillars lean on it, so confirm it or measure it with infer_readiness.');
    rules.push('default:readiness');
  }

  // Industry: required, resolved through the same aliases as map_to_taxonomy.
  let industry: string | null = null;
  if (orgIn && typeof orgIn.industry === 'string' && orgIn.industry) {
    const m = mapToTaxonomy({ industry: orgIn.industry }).industry;
    if (m?.resolved) {
      industry = m.resolved;
      if (m.matched_on !== 'exact') { resolutions.push(`industry: ${orgIn.industry} resolved to ${industry}`); rules.push('alias:industry'); }
    } else {
      issues.push({ path: 'organization.industry', msg: `Could not resolve "${orgIn.industry}" to a canonical industry.`, suggestions: m?.suggestions });
    }
  } else {
    issues.push({ path: 'organization.industry', msg: 'Required. Canonical id or plain language.' });
  }

  const usedIds = new Set<string>();
  const initiatives: Initiative[] = [];
  // The same name, function and tier twice is most likely one initiative entered twice.
  const seen = new Map<string, { index: number; id: string }>();

  (Array.isArray(list) ? list : []).forEach((raw, i) => {
    const base = `initiatives[${i}]`;
    if (!raw || typeof raw.name !== 'string' || !raw.name) {
      issues.push({ path: `${base}.name`, msg: 'Required. Every initiative needs a name.' });
      return;
    }

    const fn = typeof raw.function === 'string' && raw.function ? mapToTaxonomy({ function: raw.function }).function : undefined;
    if (!fn?.resolved) {
      issues.push({ path: `${base}.function`, msg: `Could not resolve "${raw?.function ?? ''}" to a canonical function.`, suggestions: fn?.suggestions });
      return;
    }
    if (fn.matched_on !== 'exact') { resolutions.push(`${raw.name}: function ${raw.function} resolved to ${fn.resolved}`); rules.push('alias:function'); }

    const tier = typeof raw.ai_tier === 'string' && raw.ai_tier ? mapToTaxonomy({ ai_tier: raw.ai_tier }).ai_tier : undefined;
    if (!tier?.resolved) {
      issues.push({ path: `${base}.ai_tier`, msg: `Could not resolve "${raw?.ai_tier ?? ''}" to a canonical tier.`, suggestions: tier?.suggestions });
      return;
    }
    if (tier.matched_on !== 'exact') { resolutions.push(`${raw.name}: ai_tier ${raw.ai_tier} resolved to ${tier.resolved}`); rules.push('alias:ai_tier'); }

    // Id: given and kept, or generated from the name, deduplicated deterministically.
    let id = typeof raw.id === 'string' && /^[a-z0-9-]{1,64}$/.test(raw.id) ? raw.id : slugify(raw.name);
    if (raw.id && id !== raw.id) issues.push({ path: `${base}.id`, msg: `Given id "${raw.id}" is not a valid slug. Replaced with "${id}".` });
    // Dedupe with the suffix given room inside the 64-char cap: appending
    // and then truncating back would reproduce the same string on ids
    // already at the cap, and the loop would never terminate.
    let candidate = id, n = 2;
    while (usedIds.has(candidate)) {
      const suffix = `-${n++}`;
      candidate = id.slice(0, 64 - suffix.length) + suffix;
    }
    if (candidate !== id) rules.push('dedupe:id');
    usedIds.add(candidate);
    id = candidate;

    // Both are kept: the assembler does not decide which one is real. It says so,
    // because score_portfolio adds the value of every initiative it is given.
    const twin = `${raw.name.trim().toLowerCase()}|${fn.resolved}|${tier.resolved}`;
    const first = seen.get(twin);
    if (first) {
      issues.push({ path: base, code: 'duplicate_suspected', msg: `Same name, function and tier as initiatives[${first.index}] ("${first.id}"). Both are kept, this one as "${id}". If they are one initiative, remove one: a portfolio total counts each entry.` });
      rules.push('duplicate_suspected');
    } else {
      seen.set(twin, { index: i, id });
    }

    // Pillars: given values pass through as bare numbers; missing ones are
    // estimated from taxonomy and readiness, carry a low confidence in the
    // document, and are reported so downstream scoring can haircut honestly.
    const est = estimatePillars({
      industry: (industry ?? 'universal') as Portfolio['organization']['industry'],
      function: fn.resolved as Initiative['function'],
      ai_tier: tier.resolved as Initiative['ai_tier'],
      readiness,
    });
    const scores = {} as FourPillarScore;
    const estHere: string[] = [];
    for (const p of PILLARS) {
      const given = raw.scores?.[p];
      if (typeof given === 'number') {
        (scores as unknown as Record<string, unknown>)[p] = given;
      } else {
        // Marked estimated in the document itself, so that no later tool can read it as given.
        (scores as unknown as Record<string, unknown>)[p] = { value: est[p], confidence: ESTIMATED_CONFIDENCE, basis: 'estimated' };
        estHere.push(p);
      }
    }
    if (estHere.length) {
      estimated[id] = estHere;
      assumptions.push(`${raw.name}: ${estHere.join(', ')} estimated from readiness, tier, function and disclosed AI BVF planning assumptions at confidence ${ESTIMATED_CONFIDENCE}. Structure, not evidence.`);
      rules.push('estimate:pillars');
    }

    const init: Initiative = { id, name: raw.name, function: fn.resolved as Initiative['function'], ai_tier: tier.resolved as Initiative['ai_tier'], scores };
    if (raw.bucket) init.bucket = raw.bucket;
    if (raw.compliance) init.compliance = raw.compliance;
    initiatives.push(init);
  });

  const blocked = !industry || !orgIn?.name || initiatives.length === 0;
  const portfolio: Portfolio | null = blocked ? null : {
    bvf_version: '1.0',
    organization: {
      name: orgIn.name,
      industry: industry as Portfolio['organization']['industry'],
      ...(typeof orgIn.revenue_eur === 'number' ? { revenue_eur: orgIn.revenue_eur } : {}),
      ...(typeof orgIn.region === 'string' && orgIn.region ? { region: orgIn.region } : {}),
      ...(typeof orgIn.headcount === 'number' ? { headcount: orgIn.headcount } : {}),
    },
    initiatives,
  };

  const validation = portfolio ? validate(portfolio) : null;
  const estimatedCount = Object.keys(estimated).length;

  const guidance = portfolio
    ? (estimatedCount
        ? 'The document is assembled and validated. Estimated pillars carry low confidence in the document and are listed in estimated_pillars: gather real evidence for them, or expect scoring to haircut decision confidence on those initiatives.'
        : 'The document is assembled and validated. Pass it to validate_portfolio, score_portfolio or sequence_portfolio as it stands.')
    : 'Assembly is blocked on the issues listed. Resolve each one, the suggestions name the nearest canonical values, and call again.';

  return {
    portfolio,
    resolutions,
    assumptions,
    estimated_pillars: estimated,
    issues,
    validation,
    readiness_used: readiness,
    guidance,
    audit: buildAudit(
      rules.filter((r, i, a) => a.indexOf(r) === i),
      { organization: orgIn?.name ?? null, industry, initiatives: Array.isArray(list) ? list.length : 0, readiness },
    ),
  };
}
