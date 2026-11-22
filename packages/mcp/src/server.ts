/**
 * aibvf-mcp server core: schemas, tool definitions and handlers, transport-
 * agnostic. Consumed by index.ts (stdio, the npx path) and by the remote
 * Streamable HTTP endpoint (api/mcp.ts on Vercel).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema, GetPromptRequestSchema, ListPromptsRequestSchema, ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Ajv } from 'ajv';
import type { ErrorObject, ValidateFunction } from 'ajv';
import {
  score, validate, recommendImprovements, calculatePaceLayerDrag, diagnoseProcess, inferReadiness,
  sequencePortfolio, mapToTaxonomy, assemblePortfolio, assessInitiative, briefUrlFor,
  AGENT_BRIEF, AGENT_BRIEF_VERSION, FUNDING_DECISIONS, REVIEW_OUTCOMES,
  BASE_RATES, BENCHMARK_EVIDENCE_REGISTER, IND_MULT,
  INDUSTRIES, FUNCTIONS, AI_TIERS, READINESS, BVF_VERSION,
} from '@aibvf/core';
import type { Classification, PillarScores, ScoreInput } from '@aibvf/core';

/** Single source of truth for the server version, shared by both transports. */
export const VERSION = '0.21.0';

export type EntryRoute = 'stdio' | 'remote' | 'unknown';
type TelemetryContext = { cohort?: string; clientId?: string };
const opaqueId = (value: unknown): string | null => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ? value.toLowerCase() : null;
const hashId = (domain: string, value: string) => createHash('sha256').update(`${domain} ${value}`).digest('hex').slice(0, 24);

function activityCohort(meta: Record<string, unknown>): string {
  if (process.env.CI === 'true' || process.env.AIBVF_TELEMETRY_COHORT === 'automated_test' || meta.cohort === 'automated_test') return 'automated_test';
  if (process.env.AIBVF_TELEMETRY_COHORT === 'internal' || meta.cohort === 'internal') return 'internal';
  if (meta.entry_route === 'stdio') {
    try { if (readFileSync(join(homedir(), '.config', 'aibvf', 'telemetry-cohort'), 'utf8').trim() === 'internal') return 'internal'; } catch { /* no local marker */ }
  }
  return 'public_unverified';
}

// ---------------------------------------------------------------------------
// Anonymous usage telemetry.
// Collects: tool name, package/protocol version, entry route, assessment stage,
// work-architecture status, taxonomy, an optional broad role and privacy-
// preserving install hashes. A role is accepted only when the local user sets
// AIBVF_USAGE_ROLE; it is never inferred from identity or proposal content.
// Never collects: proposals, scores, portfolio content, revenue or user IDs.
// Opt out with AIBVF_TELEMETRY_DISABLE=1.
// Redirect to your own backend with AIBVF_TELEMETRY_URL + AIBVF_TELEMETRY_KEY.
//
// caller_hash is sha256(installId + day), truncated. The installId is 16
// random bytes generated on first run and persisted to a dotfile, so it is
// stable per install (real distinct-install dedup) yet high-entropy — unlike a
// hostname/username fingerprint, the hash cannot be brute-forced back to a
// machine or person. The seed never leaves the machine. A separate stable
// install_hash supports cross-day local installation counts, not people counts.
// Hosted clients may opt into a random client UUID header; only its hash is
// stored. Opaque assessment IDs link continuation calls without proposal text.
// Cohort markers exclude internal/testing traffic but never certify a customer.
// ---------------------------------------------------------------------------
const TELEMETRY_DEFAULT_URL = process.env.AIBVF_TELEMETRY_URL
  ?? 'https://eomlyjtscwxibezoymxg.supabase.co/rest/v1/mcp_calls';
const TELEMETRY_DEFAULT_KEY = process.env.AIBVF_TELEMETRY_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbWx5anRzY3d4aWJlem95bXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTQ3OTcsImV4cCI6MjA5MjM3MDc5N30.OZvykkl5M17eZluX2fG98aA--5iVq5BQSPizYk3H0F4';
const TELEMETRY_DISABLED = process.env.AIBVF_TELEMETRY_DISABLE === '1';
const pendingTelemetry = new Set<Promise<void>>();
const USAGE_ROLES = new Set([
  'board_executive',
  'ai_data_leader',
  'business_function_leader',
  'transformation_change',
  'technology_delivery',
  'risk_governance',
  'finance_commercial',
  'consultant_adviser',
  'research_education',
  'other',
]);

function configuredUsageRole(): string | null {
  const role = process.env.AIBVF_USAGE_ROLE?.trim().toLowerCase();
  return role && USAGE_ROLES.has(role) ? role : null;
}

// Load the persisted install id, or create it on first run. The seed is random
// high-entropy bytes (not derivable from anything about the user), so the
// published daily hash dedupes a returning install without being reversible.
// If the dotfile can't be read or written (read-only fs, locked-down
// container), we fall back to a per-process random seed so telemetry still
// fires; that run simply counts as its own caller.
function loadOrCreateInstallId(): string {
  try {
    const dir = join(homedir(), '.config', 'aibvf');
    const file = join(dir, 'install-id');
    try {
      const existing = readFileSync(file, 'utf8').trim();
      if (existing) return existing;
    } catch { /* dotfile not created yet - fall through to create it */ }
    const id = randomBytes(16).toString('hex');
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, id, { mode: 0o600 });
    return id;
  } catch {
    return randomBytes(16).toString('hex');
  }
}
// Computed lazily on the first telemetry send, never at import. A user who
// opts out with AIBVF_TELEMETRY_DISABLE=1 short-circuits in logCall before
// callerHash runs, so the install-id dotfile is never written for them.
let installSeed: string | undefined;
const daySalt = () => new Date().toISOString().slice(0, 10);
const callerHash = () => {
  if (installSeed === undefined) installSeed = loadOrCreateInstallId();
  return createHash('sha256').update(`${installSeed} ${daySalt()}`).digest('hex').slice(0, 16);
};
const installHash = () => {
  if (installSeed === undefined) installSeed = loadOrCreateInstallId();
  return createHash('sha256').update(`aibvf-install ${installSeed}`).digest('hex').slice(0, 24);
};

// Where the method is published: returned with a Fix or Stop verdict, so the
// person who has to act on it can check every rule behind it. It carries no
// offer and no contact.
const METHOD_URL = 'https://github.com/Craig-Horton/ai-bvf';
const FEEDBACK_QUESTION = 'Did this change what you will do next, what should AI BVF do more of, and what should it stop doing?';
function methodNoteFor(classification: string): string | undefined {
  if (classification === 'Fix' || classification === 'Stop') {
    return `Every rule behind this ${classification} verdict is published. Read the method and the code: ${METHOD_URL}`;
  }
  return undefined;
}

function feedbackFor(classification: string, industry?: string): { question: string; url: string } | undefined {
  if (classification === 'Fix' || classification === 'Stop') {
    const industryQuery = industry ? `&industry=${encodeURIComponent(industry)}` : '';
    return {
      question: FEEDBACK_QUESTION,
      url: `https://www.aibvf.com/feedback?classification=${encodeURIComponent(classification)}&route=mcp${industryQuery}`,
    };
  }
  return undefined;
}

/** A fault inside the server, as opposed to an input the tools decline. */
export class InternalFault extends Error {}

/**
 * The engine refuses incomplete or invalid input with a plain Error and a
 * message that names what is missing. Telemetry records those as refused,
 * so a deliberate refusal is never counted as a failure of the tool.
 */
export function isInputRefusal(err: unknown): boolean {
  return err instanceof Error && err.constructor === Error;
}

export function logCall(tool_name: string, meta: Record<string, unknown> = {}) {
  if (TELEMETRY_DISABLED || !TELEMETRY_DEFAULT_URL || !TELEMETRY_DEFAULT_KEY) return;
  const payload = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    tool_name,
    bvf_version: BVF_VERSION,
    package_version: VERSION,
    caller_hash: callerHash(),
    install_hash: meta.entry_route === 'stdio' ? installHash() : opaqueId(meta.clientId) ? hashId('aibvf-remote', opaqueId(meta.clientId)!) : null,
    activity_cohort: activityCohort(meta),
    assessment_hash: opaqueId(meta.assessmentId) ? hashId('aibvf-mcp-assessment', opaqueId(meta.assessmentId)!) : null,
    // The five questions, plus the piece of context the engine had to ask for because it could not read it.
    question_key: ['financial_return', 'governance_risk', 'strategic_alignment', 'change_enablement', 'work_architecture', 'industry', 'function', 'ai_tier', 'employees'].includes(String(meta.question_key)) ? meta.question_key : null,
    outcome: ['ok', 'error', 'refused'].includes(String(meta.outcome)) ? meta.outcome : 'ok',
    user_role: meta.entry_route === 'stdio' ? configuredUsageRole() : null,
    entry_route: meta.entry_route ?? 'unknown',
    assessment_stage: meta.assessment_stage ?? null,
    work_architecture_status: meta.work_architecture_status ?? null,
    industry: meta.industry ?? null,
    function: meta.function ?? null,
    ai_tier: meta.ai_tier ?? null,
    readiness: meta.readiness ?? null,
    classification: meta.classification ?? null,
    confidence: meta.confidence ?? null,
    // Who answered a guided assessment, and at a review what happened after the earlier verdict.
    // Categories only: no proposal, quote or source is ever sent.
    answered_by: ['owner', 'evidence'].includes(String(meta.answered_by)) ? meta.answered_by : null,
    review_previous_verdict: ['Accelerate', 'Fix', 'Stop'].includes(String(meta.review_previous_verdict)) ? meta.review_previous_verdict : null,
    review_outcome: (REVIEW_OUTCOMES as readonly string[]).includes(String(meta.review_outcome)) ? meta.review_outcome : null,
    // At a review: what the owner decided on the next round of money. One of three words. No amount is ever sent.
    funding_decision: (FUNDING_DECISIONS as readonly string[]).includes(String(meta.funding_decision)) ? meta.funding_decision : null,
  };
  // Local callers do not wait for telemetry. Serverless callers can flush the
  // pending request briefly after the scoring response has been written.
  // Errors are silent unless AIBVF_TELEMETRY_DEBUG=1, in which case both
  // network failures and non-2xx HTTP responses are logged to stderr so
  // schema drifts and auth issues are debuggable from the user's terminal.
  const debug = process.env.AIBVF_TELEMETRY_DEBUG === '1';
  const request = fetch(TELEMETRY_DEFAULT_URL, {
    method: 'POST',
    headers: {
      apikey: TELEMETRY_DEFAULT_KEY,
      Authorization: `Bearer ${TELEMETRY_DEFAULT_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok && debug) {
        const text = await res.text().catch(() => '');
        console.error(`aibvf-mcp telemetry HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
    })
    .catch((err) => {
      if (debug) {
        console.error('aibvf-mcp telemetry network error:', err instanceof Error ? err.message : err);
      }
    });
  pendingTelemetry.add(request);
  void request.finally(() => pendingTelemetry.delete(request));
  return request;
}

/** Keep a serverless invocation alive long enough for pending telemetry to finish. */
export async function flushTelemetry(timeoutMs = 1200): Promise<void> {
  const requests = [...pendingTelemetry];
  if (requests.length === 0) return;
  await Promise.race([
    Promise.allSettled(requests),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

const workArchitectureInputSchema = {
  type: 'object',
  description: 'Evidence that workflows, roles, decision rights and measures are ready. Pass only what is known. Explicit gaps and omitted checks block Accelerate until all four checks are evidenced.',
  properties: {
    workflow_redesigned: { type: 'boolean', description: 'True only when the end-to-end workflow has been redesigned around the AI and retained human judgement, false when the existing workflow remains.' },
    roles_redesigned: { type: 'boolean', description: 'True only when affected roles, accountabilities and capability expectations have been rewritten, false when roles remain unchanged.' },
    decision_rights_defined: { type: 'boolean', description: 'True only when decision, override and escalation rights have named human owners, false when authority remains unclear.' },
    measures_updated: { type: 'boolean', description: 'True only when performance measures and incentives reflect the redesigned work, false when the old measures remain.' },
  },
};

const scoreInputSchema = {
  type: 'object',
  required: ['industry', 'revenue_eur', 'function', 'ai_tier', 'readiness'],
  properties: {
    industry:    { type: 'string', enum: INDUSTRIES, description: 'Your industry, as one of the accepted enum values — used to select the benchmark rate multiplier applied to the modelled EUR value. Call list_taxonomy for the exact strings if unsure.' },
    revenue_eur: { type: 'number', minimum: 0, description: 'Approximate annual revenue in EUR (must be ≥ 0). Scales the whole output: the disclosed AI BVF planning rates are applied as fractions of this figure, so the modelled EUR value range grows with it. A rough order-of-magnitude estimate is fine.' },
    function:    { type: 'string', enum: FUNCTIONS, description: 'Business function where the AI will operate, as one of the accepted enum values — selects which benchmark value drivers and rate ranges apply. Call list_taxonomy for the exact strings if unsure.' },
    ai_tier:     { type: 'string', enum: AI_TIERS, description: 'Ambition of the AI being deployed: gen1 = automation/RPA, gen2 = GenAI, gen3 = agentic. Interacts with readiness — a more ambitious tier running on lower readiness widens the pace-layer gap, which discounts the modelled EUR value even when the four pillar scores are strong.' },
    readiness:   { type: 'string', enum: READINESS, description: 'Organisational readiness, honest self-assessment: agile = cross-functional, fast decisions; traditional = functional hierarchy; siloed = rigid, hand-off heavy. Sets the value-capture rate and, paired with ai_tier, the pace-layer drag — lower readiness against a higher tier reduces the captured value. Self-report is gameable: when the user has real process numbers, call infer_readiness first and pass its measured classification here instead.' },
    scores: {
      type: 'object',
      description: 'OPTIONAL, and each pillar inside it is optional. The four AI BVF pillars, each an honest 0–100 self-assessment, combining deterministically into the verdict: governance_risk ≥ 70 OR financial_return ≤ 20 returns Stop; strategic_alignment, financial_return and change_enablement all ≥ 60 with governance_risk ≤ 40 returns Accelerate; everything else returns Fix. Pass ONLY the pillars the user has real evidence for — do NOT invent numbers for the rest. Missing pillars are estimated deterministically by the engine from disclosed AI BVF planning assumptions, the response reports which via pillar_basis and scores_used, decision score is haircut by how much was estimated, and a fully-estimated pass can never return Accelerate (it returns Fix pending confirmation). So call immediately with whatever the user gave you, then ask for evidence on the estimated pillars and re-call to firm the verdict up.',
      properties: {
        strategic_alignment: { type: 'number', minimum: 0, maximum: 100, description: 'Optional; estimated at 50 (unproven) when omitted, since alignment to a board KPI cannot be read from context. How clearly this moves a board-level KPI (0–100, higher is better). Must be ≥ 60 — together with financial_return ≥ 60, change_enablement ≥ 60 and governance_risk ≤ 40 — for an Accelerate verdict.' },
        financial_return:    { type: 'number', minimum: 0, maximum: 100, description: 'Optional; when omitted, estimated from the disclosed AI BVF planning range for the function (40–52, never enough to clear 60 unmodelled, never low enough to force a Stop). Strength of the modelled return (0–100, higher is better). A value ≤ 20 forces a Stop on its own; ≥ 60 is one of the four conditions required for Accelerate.' },
        change_enablement:   { type: 'number', minimum: 0, maximum: 100, description: 'Optional; when omitted, estimated from readiness (agile 55, traditional 45, siloed 32 — always below the 60 floor, because an unevidenced change capability is unproven). Sponsor in place, owner named, change budget funded (0–100, higher is better). Must be ≥ 60 for an Accelerate verdict.' },
        governance_risk:     { type: 'number', minimum: 0, maximum: 100, description: 'Optional; when omitted, estimated from tier and regulated context (gen1 30 / gen2 42 / gen3 55, +10 in a regulated function, +8 in a regulated industry — agentic AI in regulated finance estimates at 73 and forces a Stop until governance evidence exists). This pillar is INVERTED: higher means MORE risk. ≥ 70 forces a Stop on its own; must be ≤ 40 for Accelerate.' },
      },
    },
    work_architecture: workArchitectureInputSchema,
  },
};

// score_initiative accepts everything scoreInputSchema does, plus an optional
// signal_completeness so a caller can flag estimated-vs-measured pillar scores.
// recommend_improvements uses recommendInputSchema (score inputs + optional diagnostics).
const scoreInitiativeInputSchema = {
  ...scoreInputSchema,
  properties: {
    ...scoreInputSchema.properties,
    signal_completeness: {
      type: 'number', minimum: 0, maximum: 1,
      description: 'Optional 0 to 1 input-quality factor. The default ranges from 0.5 when all pillars are estimated to 1 when all are supplied. Supplied values still require evidence review. Lower this factor when the supplied pillars rest on weak evidence.',
    },
  },
};

const evidenceSchema = {
  type: 'object',
  properties: {
    quote: { type: 'string', maxLength: 2000, description: 'The words as written in the source, at least a few words long.' },
    source: { type: 'string', maxLength: 500, description: 'The document, message or record the words came from, with its date where known.' },
  },
};

// One quote, or up to three when an answer rests on more than one document.
const evidenceForAnswerSchema = {
  anyOf: [evidenceSchema, { type: 'array', minItems: 1, maxItems: 3, items: evidenceSchema }],
};
const evidenceListSchema = { type: 'array', items: evidenceSchema };

const assessInitiativeInputSchema = {
  type: 'object',
  required: ['proposal'],
  properties: {
    assessment_id: { type: 'string', description: 'Optional opaque ID returned by the previous call. Copy it unchanged while continuing the same assessment; omit it for a new idea. Never derive it from proposal text or a person.' },
    proposal: {
      type: 'string', minLength: 1,
      description: 'The AI initiative in the user\'s own words. Pass it unchanged on every call. The tool reads industry, business function, AI type and headcount from it and never guesses an unread value.',
    },
    industry: { type: 'string', description: 'Answer or correction in canonical or everyday language, for example retail, hospital, bank or public sector. Overrides anything read from proposal.' },
    function: { type: 'string', description: 'Answer or correction in canonical or everyday language, for example customer service, procurement, finance or risk. Overrides anything read from proposal.' },
    ai_tier: { type: 'string', description: 'Answer or correction: automation/RPA, GenAI/copilot, or agentic/autonomous. Overrides anything read from proposal.' },
    employees: { type: 'number', minimum: 1, description: 'Number of people in the organisation. Under 250 the questions are worded for a smaller firm; the rules are the same for every size.' },
    confirmed: { type: 'boolean', description: 'Set true only after the user has seen the understood statement and said it is right. Never set it on behalf of a user who is present. Working alone in evidence mode, set it yourself after checking the reading against what you read.' },
    answers: {
      type: 'object',
      description: 'The answers to the guided questions, by question id. Each value is the id of a choice: a, b, c, d, or unknown. Pass every answer given so far on each call. With a person present, pass what the person picked and never pick for them. In evidence mode, pass only the answer your quote supports, and unknown when you found nothing. Answer all five in one call: open_questions returns every question still open with its choices.',
      properties: Object.fromEntries(['financial_return', 'governance_risk', 'strategic_alignment', 'change_enablement', 'work_architecture']
        .map((id) => [id, { type: 'string', enum: ['a', 'b', 'c', 'd', 'unknown'] }])),
    },
    answered_by: {
      type: 'string', enum: ['owner', 'evidence'],
      description: 'Who chose the answers. Omit it when a person answered. Pass evidence only when you work alone under your owner\'s mandate and answer from evidence you can quote. In evidence mode every answer of a to d needs its entry in evidence, numeric scores are refused, and the verdict says that an agent answered and no person confirmed it.',
    },
    evidence: {
      type: 'object',
      description: 'Evidence mode: for each answered question, the words the answer rests on and where they were found. An answer of a to d with no quote and source is counted as not known and listed in evidence_missing. Quote the source exactly. Never write a quote yourself. Where an answer rests on more than one document, pass a list of up to three quotes, each with its own source, and never join words from different places into one quote.',
      properties: Object.fromEntries(['financial_return', 'governance_risk', 'strategic_alignment', 'change_enablement', 'work_architecture']
        .map((id) => [id, evidenceForAnswerSchema])),
    },
    evidence_against: {
      type: 'object',
      description: 'Evidence mode: where another record says otherwise than your answer, the words of that record and where they were found, by question id. Pass the answer one record supports in answers, its quote in evidence, and the words of the other record here. The answer is then counted as not known and both sets of quotes come back in conflicts, because no rule here picks which record applies today. A later record that reports a change replaces the earlier one, and that is no disagreement. Never leave a record out because it disagrees.',
      properties: Object.fromEntries(['financial_return', 'governance_risk', 'strategic_alignment', 'change_enablement', 'work_architecture']
        .map((id) => [id, evidenceForAnswerSchema])),
    },
    review: {
      type: 'object',
      description: 'At a return visit to an initiative that was assessed before. Pass previous_brief, the brief_url the earlier verdict came with, unchanged: the result then says in since_last which answers changed and which change moved the verdict. Without that link, pass previous_verdict and outcome. A review never changes the verdict. In evidence mode an outcome needs its own quote and source, or it is not kept.',
      properties: {
        previous_brief: { type: 'string', description: 'The brief_url returned with the earlier verdict, passed unchanged. The earlier answers and quotes travel inside it. Nothing is stored.' },
        previous_verdict: { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'] },
        outcome: {
          type: 'string', enum: [...REVIEW_OUTCOMES],
          description: 'delivering: it went ahead and is delivering what was expected. falling_short: it went ahead and is falling short. fixed_then_went_ahead: it was fixed first, then went ahead. paused_or_stopped: it was paused or stopped. no_decision: no decision has been made.',
        },
        evidence: evidenceSchema,
      },
    },
    funding: {
      type: 'object',
      description: 'OPTIONAL. The funding record, for the person who holds the budget: what is asked for the next stage, the alternative, and up to three results agreed to release more money. It sits beside the verdict and never changes it. Pass only figures the organisation has stated, never one you worked out. In evidence mode each figure needs its quote and source, or it is not kept. At a return visit pass review.previous_brief and put what was measured in results: the agreed results come back from the earlier link. This tool never says whether to fund.',
      properties: {
        stage: { type: 'string', enum: ['pilot', 'rollout'], description: 'What the money is for: a limited pilot, or a rollout.' },
        ask: {
          type: 'object', description: 'What is asked for the next stage.',
          properties: { amount_eur: { type: 'number', minimum: 0, description: 'The amount asked, in euros, as the organisation states it.' }, evidence: evidenceSchema },
        },
        alternative: {
          type: 'object', description: 'The cheapest credible other route, including fixing the process as it is.',
          properties: { description: { type: 'string', maxLength: 500 }, amount_eur: { type: 'number', minimum: 0 }, evidence: evidenceSchema },
        },
        thresholds: {
          type: 'array', maxItems: 3,
          description: 'Up to three results the owner agreed would release more money, written down before the work starts.',
          items: {
            type: 'object', required: ['measure', 'direction', 'target'],
            properties: {
              measure: { type: 'string', maxLength: 200, description: 'What is measured, for example Cost per resolved ticket.' },
              unit: { type: 'string', maxLength: 40, description: 'For example euros or percent.' },
              direction: { type: 'string', enum: ['at_most', 'at_least'], description: 'at_most when lower is better, at_least when higher is better.' },
              target: { type: 'number', description: 'The agreed figure.' },
              baseline: { type: 'number', minimum: 0, description: 'Today\'s figure.' },
              baseline_kind: { type: 'string', enum: ['measured', 'estimate'], description: 'measured when today\'s figure was counted from records. Otherwise it is an estimate.' },
              evidence: evidenceSchema,
            },
          },
        },
        results: {
          type: 'array', maxItems: 3,
          description: 'At a review: what was measured, by the name of the agreed result.',
          items: {
            type: 'object', required: ['measure', 'value'],
            properties: {
              measure: { type: 'string', maxLength: 200 }, value: { type: 'number' },
              kind: { type: 'string', enum: ['measured', 'estimate'], description: 'measured when it was counted from records. Otherwise it is an estimate.' },
              evidence: evidenceSchema,
            },
          },
        },
        decision: {
          type: 'string', enum: [...FUNDING_DECISIONS],
          description: 'At a review, only when the owner has said it: released, the next round of money was released. deferred, the decision was put off. withdrew, the request was withdrawn. Never choose it for the owner.',
        },
      },
    },
    brief_includes_proposal: { type: 'boolean', description: 'Set true only when the owner says the wording of the proposal may travel in brief_url. Without it the link carries the context, the answers and, in evidence mode, the quotes.' },
    scores: {
      ...scoreInputSchema.properties.scores,
      description: 'OPTIONAL, for callers that already hold 0 to 100 pillar scores from the user. A regular user answers the guided questions and never needs this. A supplied score takes precedence over an answer. Never invent a number: this tool fills in nothing.',
    },
    signal_completeness: scoreInitiativeInputSchema.properties.signal_completeness,
    work_architecture: {
      ...workArchitectureInputSchema,
      description: `${workArchitectureInputSchema.description} OPTIONAL, for callers that already hold the four checks. Refused in evidence mode: there, answer work_architecture in answers with a to d and quote it in evidence.`,
    },
    revenue_eur: { type: 'number', minimum: 0, description: 'Accepted for compatibility and ignored. The front door verdict does not use revenue.' },
    readiness: { type: 'string', description: 'Accepted for compatibility and ignored. The front door verdict does not use the operating-model label.' },
  },
};

// recommend_improvements takes everything score_initiative scores on, plus two
// optional diagnostics that select the change play. When absent, the engine
// infers them from readiness / tier / function and marks the play provisional.
const recommendInputSchema = {
  ...scoreInputSchema,
  description: 'Inputs for a change plan after a Fix or Stop verdict. industry, revenue_eur, function, ai_tier and readiness must match the scoring call so the plan is built against the same case. scores and work_architecture may be copied from score_initiative; omitted pillars are estimated and make the plan provisional. resistance_type and risk_type are optional diagnostics that select the play, and omission triggers a named inference plus the next question to ask.',
  properties: {
    ...scoreInputSchema.properties,
    resistance_type: {
      type: 'string', enum: ['will', 'skill'],
      description: 'Optional. What sits behind a low change-enablement score: "will" = people do not want the change (power shifts, fear, no case for change), "skill" = people cannot yet do it (capability and capacity gap). Selects between a coalition-building play (Kotter 1-2 + ADKAR Awareness/Desire) and an owner-and-capability play (ADKAR Knowledge/Ability). If you do not know, omit it: the engine infers from readiness (agile infers skill, traditional/siloed infers will) and marks the play provisional. Ask the user "is the resistance about not wanting this, or not being able to do it yet?" and re-call to sharpen.',
    },
    risk_type: {
      type: 'string', enum: ['regulatory', 'reputational', 'operational'],
      description: 'Optional. The nature of a high governance-risk score: "regulatory" = statute applies (EU AI Act, GDPR Article 22, DORA), "reputational" = the risk is how failure looks and lands publicly, "operational" = the system failing quietly inside a process. Selects between a regulatory remediation sequence, visible trust guardrails, and a proportionate governance review. If you do not know, omit it: the engine infers (gen3 tier, or a regulated function/industry, infers regulatory) and marks the play provisional.',
    },
  },
};

const paceLayerInputSchema = {
  type: 'object',
  required: ['revenue_eur', 'ai_tier', 'readiness'],
  properties: {
    revenue_eur: { type: 'number', minimum: 0, description: 'Approximate annual revenue in EUR (must be ≥ 0). The result scales with this: annual_drag_eur is returned as an absolute range and as drag_rate, a fraction of this revenue (e.g. 0.02 = 2%).' },
    ai_tier:     { type: 'string', enum: AI_TIERS, description: 'Ambition of the AI operating model: gen1 = automation/RPA, gen2 = GenAI, gen3 = agentic. Paired with readiness to set pace_gap severity — gen3 on any readiness below agile, or gen2 on siloed, is severe; a higher tier against a slower operating model widens the gap and raises the drag.' },
    readiness:   { type: 'string', enum: READINESS, description: 'Organisational readiness, honest self-assessment: agile = cross-functional, fast decisions; traditional = functional hierarchy; siloed = rigid, hand-off heavy. Agile readiness yields minimal drag at any tier; the mismatch between a fast AI tier and a slower operating model is what generates the Organisational Drag Cost.' },
    industry:    { type: 'string', enum: INDUSTRIES, description: 'Optional; defaults to universal if omitted. Reserved for future vertical drag-rate adjustments — does not change the result today. Call list_taxonomy for accepted values.' },
  },
};

// Reusable output-schema fragments. Two range shapes exist in the wire format:
// {low,high} for modelled EUR/value ranges, {lo,hi} for raw planning rates.
const rangeLowHigh = (description: string) => ({
  type: 'object', description, required: ['low', 'high'],
  properties: { low: { type: 'number' }, high: { type: 'number' } },
});
const rangeLoHi = (description: string) => ({
  type: 'object', description, required: ['lo', 'hi'],
  properties: { lo: { type: 'number' }, hi: { type: 'number' } },
});
const stringArray = (description: string) => ({ type: 'array', items: { type: 'string' }, description });
const roundEur = (value: number) => Math.round(value);
const eurRange = (low: number, high: number) => ({ low: roundEur(low), high: roundEur(high) });

/** Pillar scores arrive as bare numbers or as { value }; accept both, same as validate() and the sequencer. */
const pillarValue = (s: unknown): number | undefined =>
  typeof s === 'number' ? s : (s && typeof (s as any).value === 'number' ? (s as any).value : undefined);

const PILLARS = ['strategic_alignment', 'financial_return', 'change_enablement', 'governance_risk'] as const;

// Compatibility field names stay stable; their interpretation is explicit on the wire.
const SCORE_INTERPRETATION = {
  decision_confidence: 'Heuristic decision score, 0 to 100, adjusted for input quality. This score has no probability calibration.',
  net_value_eur: 'Readiness-adjusted benefit hypothesis before project build, run and change costs. Replace planning rates with scoped economics before funding.',
  applied_modules: 'Scoring-rule and sector-context labels. Sector labels do not certify clinical validation or regulatory compliance.',
};
const PORTFOLIO_INTERPRETATION = {
  ...SCORE_INTERPRETATION,
  aggregate_net_value_eur: 'Arithmetic sum of benefit hypotheses. Reconcile overlapping scope, double counting and project costs before using this as a portfolio business case.',
  pillar_basis: 'Given means supplied by the caller. It does not assert that source evidence has been verified. Estimated values are recalculated for the scoring context.',
};
const interpretationSchema = {
  type: 'object',
  additionalProperties: { type: 'string' },
  description: 'Meaning and limits of compatibility fields. Present these labels when explaining the result.',
};

function portfolioScoreInput(
  initiative: any,
  context: Pick<ScoreInput, 'industry' | 'revenue_eur' | 'function' | 'ai_tier' | 'readiness'>,
): ScoreInput {
  const scores: Partial<PillarScores> = {};
  const qualities: number[] = [];
  let givenCount = 0;
  for (const pillar of PILLARS) {
    const raw = initiative.scores[pillar];
    const basis = initiative.pillar_basis?.[pillar];
    if (basis !== undefined && basis !== 'given' && basis !== 'estimated') {
      throw new Error(`Invalid pillar_basis for ${pillar}.`);
    }
    const estimated = basis === 'estimated';
    const value = pillarValue(raw);
    if (!estimated && value !== undefined) {
      scores[pillar] = value;
      givenCount += 1;
    }
    const reported = typeof raw === 'object' && raw !== null ? raw.confidence : undefined;
    qualities.push(typeof reported === 'number' ? Math.max(0, Math.min(1, reported / 100)) : estimated ? 0.5 : 1);
  }
  const explicitSignal = initiative.signal_completeness;
  if (explicitSignal !== undefined && (typeof explicitSignal !== 'number' || !Number.isFinite(explicitSignal) || explicitSignal < 0 || explicitSignal > 1)) {
    throw new Error('signal_completeness must be a number from 0 to 1.');
  }
  // A supplied quality value can lower the default, but cannot erase known estimates.
  const defaultSignal = 0.5 + 0.125 * givenCount;
  const reportedSignal = qualities.reduce((sum, quality) => sum + quality, 0) / PILLARS.length;
  return {
    ...context,
    scores,
    work_architecture: initiative.work_architecture,
    signal_completeness: Math.min(defaultSignal, reportedSignal, explicitSignal ?? 1),
  };
}

const auditSchema = {
  type: 'object',
  description: 'Reproducibility record: engine version, the rules that fired, and the resolved inputs. Deterministic, no timestamps. If the verdict is challenged months later, the same inputs on the same engine version reproduce it exactly.',
  properties: {
    engine: { type: 'string' }, engine_version: { type: 'string' }, bvf_version: { type: 'string' },
    rules_fired: { type: 'array', items: { type: 'string' }, description: 'The rules that actually fired, in order: estimation, gates, classification, value arithmetic.' },
    inputs_used: { type: 'object', description: 'The resolved inputs the result was computed on, including estimated pillar values.' },
    note: { type: 'string' },
  },
};

const scoreOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'classification', 'reason', 'net_value_eur', 'gross_value_eur', 'decision_confidence', 'multipliers', 'drivers', 'benchmark_source', 'applied_modules', 'work_architecture'],
  properties: {
    bvf_version:         { type: 'string', description: 'AI BVF protocol version used.' },
    classification:      { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'], description: 'The verdict for this initiative.' },
    reason:              { type: 'string', description: 'One-line justification for the classification.' },
    net_value_eur:       rangeLowHigh(SCORE_INTERPRETATION.net_value_eur),
    interpretation: interpretationSchema,
    gross_value_eur:     rangeLowHigh('Modelled gross value in EUR before capture, low/high.'),
    decision_confidence: { type: 'number', description: SCORE_INTERPRETATION.decision_confidence },
    multipliers: {
      type: 'object', description: 'Factors applied to the base rates.',
      required: ['industry', 'tier', 'capture_low', 'capture_high'],
      properties: {
        industry:     { type: 'number' }, tier: { type: 'number' },
        capture_low:  { type: 'number' }, capture_high: { type: 'number' },
      },
    },
    drivers:            stringArray('Named value drivers behind the estimate.'),
    scores_used: {
      type: 'object',
      description: 'The four pillar values the verdict was actually computed on, whether given by the caller or estimated by the engine. Show these to the user when any pillar was estimated.',
      properties: {
        strategic_alignment: { type: 'number' }, financial_return: { type: 'number' },
        change_enablement: { type: 'number' }, governance_risk: { type: 'number' },
      },
    },
    pillar_basis: {
      type: 'object',
      description: 'Per pillar: "given" (caller supplied it) or "estimated" (deterministic prior). When any pillar is estimated, tell the user which, and ask for evidence on those to firm up the verdict.',
      properties: {
        strategic_alignment: { type: 'string', enum: ['given', 'estimated'] },
        financial_return:    { type: 'string', enum: ['given', 'estimated'] },
        change_enablement:   { type: 'string', enum: ['given', 'estimated'] },
        governance_risk:     { type: 'string', enum: ['given', 'estimated'] },
      },
    },
    sensitivity: {
      type: 'object',
      description: 'What moves this verdict, computed deterministically: the value if readiness were one notch worse, the value at revenue minus 20 percent, and the nearest single-pillar movements that flip the classification. Boards trust ranges with visible assumptions over point estimates; show this.',
      properties: {
        readiness_one_notch_down: { type: ['object', 'null'], description: 'Null when readiness is already siloed.' },
        revenue_minus_20pct: { type: 'object' },
        verdict_flips: { type: 'array', items: { type: 'string' } },
      },
    },
    audit: auditSchema,
    benchmark_source:   { type: 'string', description: 'Provenance and evidence status for the AI BVF planning rates applied.' },
    applied_modules:    stringArray(SCORE_INTERPRETATION.applied_modules),
    caveat:             { type: 'string', description: 'Present only when signal_completeness was low: warns the verdict rests on soft inputs and confidence was reduced.' },
    work_architecture: {
      type: 'object',
      description: 'The work architecture gate across workflow, roles, human decision rights and performance measures. A stated gap or missing evidence blocks Accelerate.',
      required: ['status', 'blocks_accelerate', 'checks', 'gaps', 'unknowns', 'gate'],
      properties: {
        status: { type: 'string', enum: ['unknown', 'partial', 'gap', 'ready'] },
        blocks_accelerate: { type: 'boolean' },
        checks: { type: 'array', items: { type: 'object' } },
        gaps: { type: 'array', items: { type: 'string' } },
        unknowns: { type: 'array', items: { type: 'string' } },
        next_question: { type: 'string' },
        gate: { type: 'string' },
      },
    },
    method_note: { type: 'string', description: 'Present only for Fix/Stop verdicts: where the method and the code are published. It carries no offer.' },
    feedback: {
      type: 'object',
      description: 'Optional three-question feedback route, present only for Fix/Stop verdicts. The page records the response anonymously only when the user chooses an answer; no assessment data is attached.',
      required: ['question', 'url'],
      properties: { question: { type: 'string' }, url: { type: 'string', format: 'uri' } },
    },
  },
};

const assessVerdictSchema = {
  type: 'object',
  description: 'Present only when status is verdict. Rests on what the user answered or supplied, read against the words of the proposal. Carries no euro figure and no estimated score.',
  required: ['bvf_version', 'classification', 'summary', 'holding_back', 'first_step', 'contradictions', 'reason', 'scores_supplied', 'answers_given', 'work_architecture', 'audit', 'value_note'],
  properties: {
    bvf_version: { type: 'string' },
    classification: { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'] },
    summary: { type: 'string', description: 'The outcome in one or two plain sentences. A Stop quotes its cause. Lead with this.' },
    holding_back: {
      type: 'array',
      description: 'The answers that keep the initiative from a go-ahead, most decisive first. Empty for Accelerate. Show each with what the user said and what it needs to become.',
      items: {
        type: 'object',
        required: ['id', 'short', 'question', 'answer', 'needed'],
        properties: {
          id: { type: 'string', enum: ['strategic_alignment', 'financial_return', 'change_enablement', 'governance_risk', 'work_architecture'] },
          short: { type: 'string', description: 'A short name for the question, for lists.' },
          question: { type: 'string' },
          answer: { type: 'string', description: 'What the user answered.' },
          needed: { type: 'string', description: 'What the answer has to become to clear the bar.' },
          proposal_words: { type: 'string', description: 'Present when the proposal or the evidence contradicts this answer: the words as written. Quote them to the user.' },
          evidence: { ...evidenceListSchema, description: 'Evidence mode: the words this answer rests on and where they were found, one entry per quote. Show them beside the answer.' },
        },
      },
    },
    contradictions: {
      type: 'array',
      description: 'Where the words of the proposal contradict a favourable answer. Empty when they agree. Any entry holds the verdict at Fix until the user changes the proposal or the answer. Quote proposal_words beside answer and ask which one is true.',
      items: {
        type: 'object',
        required: ['id', 'rule', 'proposal_words', 'proposal_says', 'answer'],
        properties: {
          id: { type: 'string', enum: ['strategic_alignment', 'financial_return', 'change_enablement', 'governance_risk', 'work_architecture'] },
          rule: { type: 'string', description: 'The published phrase rule that fired.' },
          proposal_words: { type: 'string', description: 'The words as written in the proposal.' },
          proposal_says: { type: 'string', description: 'What those words say about the initiative.' },
          answer: { type: 'string', description: 'What the user answered.' },
          found_in: { type: 'string', enum: ['proposal', 'evidence'], description: 'Where the words were found. Absent means the proposal.' },
        },
      },
    },
    first_step: { type: 'string', description: 'The one thing to do first. Give it after the summary.' },
    reason: { type: 'string', description: 'The rule that produced the classification, in framework terms. For audit use; prefer summary when speaking to the user.' },
    scores_supplied: { type: 'object', description: 'The pillar scores the verdict rests on, from answers or supplied scores. Nothing here was estimated.' },
    answers_given: { type: 'object', description: 'The guided answers behind those scores: the choice, its wording and the published score it carries.' },
    decision_confidence: { type: 'number', description: 'Heuristic decision score, 0 to 100, with no probability calibration. Present only when all four pillars were supplied.' },
    verdict_flips: stringArray('The nearest single-pillar movements that change the verdict. Present only when all four pillars were supplied.'),
    interpretation: { type: 'object', description: 'How to read decision_confidence. Present only when all four pillars were supplied.' },
    work_architecture: scoreOutputSchema.properties.work_architecture,
    audit: scoreOutputSchema.properties.audit,
    value_note: { type: 'string', description: 'Why no euro figure is given.' },
    provenance: {
      type: 'object',
      description: 'Evidence mode only. Say statement with the verdict, so nobody takes an agent\'s reading for a person\'s answer.',
      required: ['answered_by', 'statement', 'answers_with_evidence'],
      properties: {
        answered_by: { type: 'string', enum: ['evidence'] },
        statement: { type: 'string' },
        answers_with_evidence: { type: 'number' },
      },
    },
    brief_url: { type: 'string', format: 'uri', description: 'A link to the one-page brief for this verdict, to forward to the person who has to sign it off. The context, the answers and any quoted evidence travel inside the link after the # sign and are stored nowhere. Show it behind link text where the chat can do that. Never change it and never pass it to a link shortener. Absent when the verdict rests on a supplied score.' },
    method_note: { type: 'string', description: 'Present only for Fix/Stop verdicts: where the method and the code are published. It carries no offer.' },
    feedback: scoreOutputSchema.properties.feedback,
  },
};

const assessContextFields = ['industry', 'function', 'ai_tier', 'employees'];
const assessDeciderSchema = {
  type: 'object',
  required: ['id', 'question', 'why', 'answer_in'],
  properties: {
    id: { type: 'string', enum: ['strategic_alignment', 'financial_return', 'change_enablement', 'governance_risk', 'work_architecture'] },
    question: { type: 'string' },
    why: { type: 'string' },
    answer_in: { type: 'string', description: 'The input field that carries the answer on the next call.' },
    where_to_look: { type: 'string', description: 'Where the answer is usually written down. Look there before answering unknown.' },
  },
};

const assessInitiativeOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'status', 'proposal', 'resolved_inputs', 'resolutions', 'missing_fields', 'inferred_fields', 'understood'],
  properties: {
    bvf_version: { type: 'string' },
    status: { type: 'string', enum: ['needs_input', 'needs_confirmation', 'not_enough_to_judge', 'verdict'], description: 'needs_input: a piece of context is unread, ask question. needs_confirmation: show understood and ask the user to confirm or correct it. not_enough_to_judge: ask question, the next guided question. verdict: Accelerate, Fix or Stop from the user\'s answers only.' },
    proposal: { type: 'string', description: 'The supplied proposal, returned so the next call can preserve it verbatim.' },
    resolved_inputs: { type: 'object', description: 'Context resolved so far: industry, function, ai_tier, employees and track (smaller_firm under 250 people, otherwise enterprise).' },
    resolutions: stringArray('Every deterministic resolution, naming the field, canonical value, source and matched phrase.'),
    missing_fields: { type: 'array', items: { type: 'string', enum: assessContextFields } },
    next_question: { type: 'string', description: 'The one thing to ask the user next, as a sentence. Absent when status is verdict.' },
    question: {
      type: 'object',
      description: 'The same question in structured form. Show the question and every choice label to the user, in the given order, and pass back the id of the choice they pick in the field named by answer_in. Ask one question per turn.',
      required: ['id', 'question', 'answer_in'],
      properties: {
        id: { type: 'string' },
        question: { type: 'string' },
        why: { type: 'string', description: 'Why the answer decides the outcome.' },
        choices: { type: 'array', items: { type: 'object', required: ['id', 'label'], properties: { id: { type: 'string' }, label: { type: 'string' } } } },
        answer_in: { type: 'string' },
        where_to_look: { type: 'string', description: 'Guided questions only: where the answer is usually written down.' },
        number: { type: 'number', description: 'Guided questions only: position in the sequence.' },
        of_at_most: { type: 'number' },
      },
    },
    suggestions: stringArray('Accepted values for an explicitly supplied field that could not be resolved.'),
    ambiguous_fields: { type: 'object', description: 'Fields whose wording pointed to more than one value, each with the competing values. Ask the user to choose; never choose for them.' },
    inferred_fields: { type: 'array', items: { type: 'string', enum: assessContextFields }, description: 'Fields read from the wording of the proposal instead of an explicit answer.' },
    understood: { type: 'string', description: 'Plain statement of how the proposal was read. Show it to the user before anything else and invite corrections.' },
    decides: { type: 'array', description: 'not_enough_to_judge only. Up to three things still to answer, most decisive first.', items: assessDeciderSchema },
    also_open: stringArray('not_enough_to_judge only. Anything still open after the three in decides.'),
    to_find_out: { type: 'array', description: 'Questions the user answered with "I do not know yet". A verdict waits on these. When no question is left to ask, tell the user to find these out and come back.', items: assessDeciderSchema },
    warning: { type: 'string', description: 'A condition the user must meet first. Lead with it when present.' },
    answered_by: { type: 'string', enum: ['evidence'], description: 'Present when an agent answered from evidence.' },
    evidence_missing: stringArray('Evidence mode: answers that came with no quote and source. Each was counted as not known. Find the words, or leave the answer as unknown.'),
    open_questions: {
      type: 'array',
      description: 'Evidence mode only. Every guided question still without an answer, each with its choices and where to look. Answer all of them in one call, each with its quote, and unknown where you found nothing. On a verdict nothing waits on them: answer them and call again, and the brief carries those answers too.',
      items: {
        ...assessDeciderSchema,
        required: [...assessDeciderSchema.required, 'choices'],
        properties: {
          ...assessDeciderSchema.properties,
          choices: { type: 'array', items: { type: 'object', required: ['id', 'label'], properties: { id: { type: 'string' }, label: { type: 'string' } } } },
        },
      },
    },
    funding: {
      type: 'object',
      description: 'Present when a funding record was passed, or the earlier brief carried one. Say statement with the verdict, then each line in thresholds and each entry in gaps. Every figure is the organisation\'s own. Never add a figure, and never say whether to fund: say note.',
      required: ['thresholds', 'gaps', 'statement', 'note'],
      properties: {
        stage: { type: 'string', enum: ['pilot', 'rollout'] },
        ask: { type: 'object', properties: { amount_eur: { type: 'number' }, evidence: evidenceSchema } },
        alternative: { type: 'object', properties: { description: { type: 'string' }, amount_eur: { type: 'number' }, evidence: evidenceSchema } },
        thresholds: {
          type: 'array',
          items: {
            type: 'object', required: ['measure', 'direction', 'target', 'baseline_kind', 'line'],
            properties: {
              measure: { type: 'string' }, unit: { type: 'string' }, direction: { type: 'string', enum: ['at_most', 'at_least'] }, target: { type: 'number' },
              baseline: { type: 'number' }, baseline_kind: { type: 'string', enum: ['measured', 'estimate', 'unknown'] }, evidence: evidenceSchema,
              result: { type: 'number' }, result_kind: { type: 'string', enum: ['measured', 'estimate'] }, result_evidence: evidenceSchema,
              met: { type: 'boolean', description: 'At a review: whether the result is on the agreed side of the target.' },
              line: { type: 'string', description: 'The agreed result in one sentence. Say it as written.' },
            },
          },
        },
        gaps: stringArray('What the person who holds the budget still does not know, most important first.'),
        review: {
          type: 'object', description: 'Present once a result is in.', required: ['met', 'of', 'statement'],
          properties: { met: { type: 'number' }, of: { type: 'number' }, statement: { type: 'string' } },
        },
        agreement_changed: { type: 'boolean', description: 'True when results passed today differ from those the earlier brief carried. The earlier ones are used. Tell the owner.' },
        decision: { type: 'string', enum: [...FUNDING_DECISIONS] },
        statement: { type: 'string', description: 'The record in plain sentences. Say it as written.' },
        note: { type: 'string', description: 'Whose figures these are, and whose decision it is. Say it.' },
      },
    },
    conflicts: {
      type: 'array',
      description: 'Evidence mode: answers on which two records disagree. Each was counted as not known. Put ask to the owner, with both sets of quotes beside it, and never say which record is right.',
      items: {
        type: 'object',
        required: ['id', 'short', 'question', 'answer', 'evidence', 'against', 'ask'],
        properties: {
          id: { type: 'string' },
          short: { type: 'string', description: 'A short name for the question.' },
          question: { type: 'string' },
          answer: { type: 'string', description: 'The answer the first record supports.' },
          evidence: { type: 'array', items: evidenceSchema, description: 'The words that support that answer.' },
          against: { type: 'array', items: evidenceSchema, description: 'The words in another record that say otherwise.' },
          ask: { type: 'string', description: 'The question to put to the owner, in these words.' },
        },
      },
    },
    review: {
      type: 'object',
      description: 'Present when a review was passed: the earlier verdict and what happened since. accepted is false when an agent gave an outcome with no evidence.',
      required: ['previous_verdict', 'accepted', 'note'],
      properties: {
        previous_verdict: { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'] },
        outcome: { type: 'string', enum: [...REVIEW_OUTCOMES] },
        evidence: evidenceSchema,
        accepted: { type: 'boolean' },
        note: { type: 'string' },
        since_last: {
          type: 'object',
          description: 'Present when previous_brief was passed. Say statement with the verdict, then each line in changes with the earlier and the new quote beside it.',
          required: ['previous_verdict', 'previous_date', 'now', 'verdict_changed', 'changes', 'unchanged', 'statement'],
          properties: {
            previous_verdict: { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'] },
            previous_date: { type: 'string', description: 'The date of the earlier verdict, written YYYY-MM-DD.' },
            now: { type: 'string', enum: ['Accelerate', 'Fix', 'Stop', 'Not enough to judge yet'] },
            verdict_changed: { type: 'boolean' },
            unchanged: { type: 'number', description: 'How many of the five answers are the same as before.' },
            context_changed: stringArray('Present when the earlier brief was for another industry, function, AI type or size. Tell the owner.'),
            statement: { type: 'string', description: 'What changed, in plain sentences. Say it as written.' },
            changes: {
              type: 'array',
              description: 'Each answer that differs from the earlier verdict.',
              items: {
                type: 'object',
                required: ['id', 'short', 'question', 'from', 'to', 'moved_verdict', 'line'],
                properties: {
                  id: { type: 'string' }, short: { type: 'string' }, question: { type: 'string' },
                  from: { type: 'object', description: 'The answer as it stood then, with its quotes.' },
                  to: { type: 'object', description: 'The answer today, with its quotes.' },
                  moved_verdict: { type: 'boolean', description: 'True when putting this one answer back gives a different outcome from today\'s.' },
                  line: { type: 'string', description: 'The change in one sentence.' },
                },
              },
            },
          },
        },
      },
    },
    verdict: assessVerdictSchema,
  },
};

const recommendOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'current_classification', 'target_classification', 'feasible', 'recommendations', 'projected_decision_confidence', 'notes'],
  properties: {
    bvf_version:            { type: 'string', description: 'AI BVF protocol version used.' },
    current_classification: { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'], description: 'Verdict as the initiative stands today.' },
    target_classification:  { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'], description: 'Verdict the recommendations aim to reach.' },
    feasible:               { type: 'boolean', description: 'Whether the target is reachable via the listed pillar moves.' },
    recommendations: {
      type: 'array', description: 'Per-pillar improvement actions.',
      items: {
        type: 'object',
        required: ['pillar', 'current', 'target', 'delta', 'action', 'rationale'],
        properties: {
          pillar:    { type: 'string', enum: ['strategic_alignment', 'financial_return', 'change_enablement', 'governance_risk'] },
          current:   { type: 'number', description: 'Current pillar score (0–100).' },
          target:    { type: 'number', description: 'Pillar score needed to flip classification (0–100).' },
          delta:     { type: 'number', description: 'Points of improvement required (target − current).' },
          action:    { type: 'string', description: 'Concrete action to close the gap.' },
          rationale: { type: 'string', description: 'Why this action moves the pillar.' },
        },
      },
    },
    projected_decision_confidence: { type: 'number', description: 'Projected heuristic decision score, 0 to 100. The target remains conditional on work architecture and evidence review.' },
    interpretation: interpretationSchema,
    notes:              stringArray('Caveats or context on the recommendation set.'),
    audit: auditSchema,
    change_plan: {
      type: 'object',
      description: 'The change-leader layer: a specific, sequenced route from Fix or Stop toward Go, aimed at the organisation. Present for Fix/Stop, absent when the initiative is already Accelerate. Present this to the user as the plan, not as raw data.',
      properties: {
        binding_constraint: { type: 'string', description: 'The one thing standing between this initiative and a Go. Lead with this; a single named blocker gets acted on where a list of four gets skimmed.' },
        position:           { type: 'string', enum: ['near_go', 'contested', 'near_stop'], description: 'Where this Fix sits between Go and Stop. near_go = a funding decision waiting on evidence; near_stop = one adverse finding from Stop, run only the first play then re-score.' },
        position_detail:    { type: 'string', description: 'One-paragraph read of the position, written for the organisation.' },
        plays: {
          type: 'array',
          description: 'Named change plays, worst pillar first, each selected from the failing pillar AND the organisational context. Every play works two altitudes: the organisation (Kotter) and the person (Prosci ADKAR).',
          items: {
            type: 'object',
            properties: {
              id:        { type: 'string', description: 'Play identifier, e.g. coalition-first, regulatory-remediation, value-rescope.' },
              pillar:    { type: 'string', description: 'The pillar this play repairs, or pace_gap for the cross-cutting operating-model play.' },
              diagnosis: { type: 'string', description: 'What is actually blocking, in plain language.' },
              org_move:  { type: 'object', description: 'The organisation-level move (method + action), typically a Kotter step.' },
              person_move: { type: 'object', description: 'The individual-level move (method + action), typically an ADKAR stage.' },
              steps:     { type: 'array', items: { type: 'string' }, description: 'Sequenced actions, in order. Order matters: e.g. desire before change budget.' },
              diagnostic_questions: { type: 'array', items: { type: 'string' }, description: 'Questions to put to the organisation to sharpen or challenge the play. Ask these before executing.' },
              owner:     { type: 'string', description: 'The role that owns the play, to be filled with a named individual.' },
              timeline_weeks: { type: 'array', items: { type: 'number' }, description: 'Expected duration range in weeks, [low, high].' },
              stop_condition: { type: 'string', description: 'Present when the honest escalation from this play is Stop, and the condition that triggers it.' },
              provisional: { type: 'boolean', description: 'True when the play was inferred from readiness/tier/function rather than told via resistance_type or risk_type. When true, ask the diagnostic questions and re-call with the answer to sharpen the plan.' },
              source:    { type: 'string', description: 'The named method behind the play: Kotter, Prosci ADKAR, EU AI Act, benchmark sources.' },
            },
          },
        },
        cost_of_waiting_eur: { type: 'object', description: 'Estimated organisational drag over the plan window, {low, high} in EUR, from the pace-layer model. The price of sitting in Fix.' },
        cost_of_waiting:     { type: 'string', description: 'The cost of delay framed as a decision rule: fix if the plays cost less than the waiting, stop if they cost more.' },
        rescore_gate: { type: 'object', description: 'What must be true, and by when, for the re-score to arbitrate. Fix is a decision with a deadline, not a limbo state.' },
        honest_stop:  { type: 'string', description: 'Present when the truthful call is Stop rather than Fix. Surface this verbatim; it is the most valuable sentence in the response when it appears.' },
      },
    },
    method_note: { type: 'string', description: 'Present only for Fix/Stop verdicts: where the method and the code are published. It carries no offer.' },
    feedback: {
      type: 'object',
      description: 'Optional three-question feedback route, present only for Fix/Stop verdicts. The page records the response anonymously only when the user chooses an answer; no assessment data is attached.',
      required: ['question', 'url'],
      properties: { question: { type: 'string' }, url: { type: 'string', format: 'uri' } },
    },
  },
};

const paceLayerOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'annual_drag_eur', 'drag_rate', 'pace_gap', 'drivers', 'source'],
  properties: {
    bvf_version:     { type: 'string', description: 'AI BVF protocol version used.' },
    annual_drag_eur: rangeLowHigh('Estimated annual Organisational Drag Cost in EUR, low/high.'),
    drag_rate:       rangeLowHigh('Drag as a fraction of revenue (e.g. 0.02 = 2%), low/high.'),
    pace_gap:        { type: 'string', enum: ['minimal', 'moderate', 'severe'], description: 'Severity of the tier↔readiness mismatch.' },
    drivers:         stringArray('Named factors contributing to the drag.'),
    source:          { type: 'string', description: 'Citation for the drag-rate model applied.' },
  },
};

const validateOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'valid', 'errors'],
  properties: {
    bvf_version: { type: 'string', description: 'AI BVF protocol version validated against.' },
    valid:       { type: 'boolean', description: 'True when the portfolio conforms to the schema.' },
    errors: {
      type: 'array', description: 'Empty when valid; otherwise one entry per schema violation.',
      items: {
        type: 'object', required: ['path', 'msg'],
        properties: {
          path: { type: 'string', description: 'JSON path to the failing field.' },
          msg:  { type: 'string', description: 'The rule that was broken.' },
        },
      },
    },
  },
};

const benchmarkOutputSchema = {
  type: 'object',
  required: ['function', 'industry', 'revenue_uplift_range', 'cost_takeout_range', 'industry_multiplier', 'drivers', 'source'],
  properties: {
    function:             { type: 'string', description: 'Business function the rates apply to.' },
    industry:             { type: 'string', description: 'Industry whose multiplier was applied.' },
    revenue_uplift_range: rangeLoHi('Revenue uplift as a fraction of revenue, lo/hi.'),
    cost_takeout_range:   rangeLoHi('Cost take-out as a fraction of revenue, lo/hi.'),
    industry_multiplier:  { type: 'number', description: 'Multiplier applied to the base rates for this industry.' },
    drivers:              stringArray('Named value drivers behind the benchmark.'),
    source:               { type: 'string', description: 'Citation for the benchmark figures.' },
  },
};

const taxonomyOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'industries', 'functions', 'ai_tiers', 'readiness'],
  properties: {
    bvf_version: { type: 'string', description: 'AI BVF protocol version these enums belong to.' },
    industries:  stringArray('All accepted industry values.'),
    functions:   stringArray('All accepted business-function values.'),
    ai_tiers:    stringArray('All accepted ai_tier values (gen1/gen2/gen3).'),
    readiness:   stringArray('All accepted organisational-readiness values.'),
  },
};

const scorePortfolioInputSchema = {
  type: 'object',
  required: ['portfolio', 'readiness'],
  properties: {
    portfolio: {
      type: 'object',
      description: 'AI BVF v1.0 portfolio with organization and initiatives. Each initiative carries id, name, function, ai_tier and four scores, supplied as numbers or { value, confidence } objects. Retain each initiative\'s work_architecture, pillar_basis and optional signal_completeness. pillar_basis marks given or estimated values; estimated pillars are recalculated for the current context and retain an input-quality reduction. Supplied values without provenance are caller-provided, with no claim of evidence verification. Accelerate requires the pillar thresholds and all four work-architecture checks. Missing work-design evidence returns Fix for an otherwise green case. organization.revenue_eur is required for benefit modelling. Validate unfamiliar documents first.',
    },
    readiness: {
      type: 'string',
      enum: READINESS,
      description: 'Organisational readiness applied to every initiative in the portfolio. Honest self-assessment: agile = cross-functional, fast decisions; traditional = functional hierarchy; siloed = rigid, hand-off heavy. The portfolio schema does not carry per-initiative readiness; this single value sets the capture rate for the whole portfolio and, paired with the ai_tier of each initiative, its pace-layer drag — lower readiness against a higher tier discounts the modelled EUR value.',
    },
  },
};

const scorePortfolioOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'valid', 'organization', 'readiness', 'total', 'summary', 'aggregate_net_value_eur', 'mean_decision_confidence', 'scored_initiatives', 'skipped_initiatives'],
  properties: {
    bvf_version:       { type: 'string', description: 'AI BVF protocol version used.' },
    valid:             { type: 'boolean', description: 'True when the portfolio passed schema validation. False means no initiatives were scored.' },
    validation_errors: {
      type: 'array', description: 'Empty when valid; otherwise one entry per schema violation.',
      items: {
        type: 'object', required: ['path', 'msg'],
        properties: { path: { type: 'string' }, msg: { type: 'string' } },
      },
    },
    organization: {
      type: 'object', required: ['name', 'industry'],
      properties: { name: { type: 'string' }, industry: { type: 'string' } },
      description: 'Echo of the portfolio organisation fields applied to scoring.',
    },
    readiness: { type: 'string', enum: ['agile', 'traditional', 'siloed'], description: 'Readiness value applied across all initiatives.' },
    total:     { type: 'number', description: 'Total initiatives in the portfolio (scored + skipped).' },
    summary: {
      type: 'object', required: ['accelerate', 'fix', 'stop', 'skipped'],
      properties: {
        accelerate: { type: 'number', description: 'Count of Accelerate verdicts.' },
        fix:        { type: 'number', description: 'Count of Fix verdicts.' },
        stop:       { type: 'number', description: 'Count of Stop verdicts.' },
        skipped:    { type: 'number', description: 'Count of initiatives skipped due to missing or invalid scoring inputs.' },
      },
    },
    aggregate_net_value_eur:  rangeLowHigh(PORTFOLIO_INTERPRETATION.aggregate_net_value_eur),
    interpretation: interpretationSchema,
    mean_decision_confidence: { type: 'number', description: 'Mean decision score across scored initiatives (0–100); 0 when none were scored.' },
    top_initiative_by_value: {
      type: 'object',
      description: 'Scored initiative with the highest mid-point readiness-adjusted EUR benefit. Omitted when none were scored.',
      required: ['id', 'name', 'classification', 'net_value_eur'],
      properties: {
        id:             { type: 'string' },
        name:           { type: 'string' },
        classification: { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'] },
        net_value_eur:  rangeLowHigh('Readiness-adjusted EUR benefit range for the top initiative.'),
      },
    },
    highest_risk_initiative: {
      type: 'object',
      description: 'Scored initiative most at risk: worst classification (Stop > Fix > Accelerate), tie-broken by lowest decision_confidence. Omitted when none were scored.',
      required: ['id', 'name', 'classification', 'reason'],
      properties: {
        id:             { type: 'string' },
        name:           { type: 'string' },
        classification: { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'] },
        reason:         { type: 'string' },
      },
    },
    scored_initiatives: {
      type: 'array', description: 'Per-initiative scoring result.',
      items: {
        type: 'object',
        required: ['id', 'name', 'function', 'ai_tier', 'classification', 'reason', 'net_value_eur', 'decision_confidence', 'applied_modules'],
        properties: {
          id:                  { type: 'string' },
          name:                { type: 'string' },
          function:            { type: 'string' },
          ai_tier:             { type: 'string' },
          classification:      { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'] },
          reason:              { type: 'string' },
          net_value_eur:       rangeLowHigh('Modelled readiness-adjusted EUR benefit, low/high.'),
          decision_confidence: { type: 'number', description: SCORE_INTERPRETATION.decision_confidence },
          applied_modules: stringArray(SCORE_INTERPRETATION.applied_modules),
          scores_used: scoreOutputSchema.properties.scores_used,
          pillar_basis: scoreOutputSchema.properties.pillar_basis,
          signal_completeness: { type: 'number', minimum: 0, maximum: 1, description: 'Input-quality factor after estimated provenance, pillar quality and any explicit factor are combined conservatively.' },
          work_architecture: scoreOutputSchema.properties.work_architecture,
          audit: auditSchema,
          sensitivity: scoreOutputSchema.properties.sensitivity,
          caveat: scoreOutputSchema.properties.caveat,
        },
      },
    },
    skipped_initiatives: {
      type: 'array', description: 'Initiatives that could not be scored, with the reason. Empty when all initiatives scored.',
      items: {
        type: 'object', required: ['id', 'name', 'reason'],
        properties: {
          id:     { type: 'string' },
          name:   { type: 'string' },
          reason: { type: 'string', description: 'Why this initiative was skipped (e.g. missing revenue, unknown function).' },
        },
      },
    },
    method_note: { type: 'string', description: 'Present only when any initiative was Fix or Stop: where the method and the code are published. It carries no offer.' },
    feedback: {
      type: 'object',
      description: 'Optional three-question feedback route, present only when any initiative was Fix or Stop. The page records the response anonymously only when the user chooses an answer; no assessment data is attached.',
      required: ['question', 'url'],
      properties: { question: { type: 'string' }, url: { type: 'string', format: 'uri' } },
    },
  },
};

const diagnoseInputSchema = {
  type: 'object',
  required: ['process_id', 'function', 'instances_per_year', 'fte_hours_per_instance', 'loaded_hourly_rate_eur', 'cycle_time_days', 'touch_ratio', 'handoffs', 'rework_rate', 'automation_level', 'direct_spend_eur'],
  properties: {
    process_id:             { type: 'string', description: 'Stable identifier for the process.' },
    function:               { type: 'string', enum: FUNCTIONS, description: 'Business function the process belongs to. See list_taxonomy.' },
    instances_per_year:     { type: 'number', minimum: 0, description: 'Process volume: how many times it runs per year. Low volume on a heavy process (heaviness ≥ 50) selects the Eliminate / insource intervention rather than automating it.' },
    fte_hours_per_instance: { type: 'number', minimum: 0, description: 'Human touch-time in hours per instance. With loaded_hourly_rate_eur and instances_per_year this sets the labour baseline the saving is a fraction of.' },
    loaded_hourly_rate_eur: { type: 'number', minimum: 0, description: 'Fully-loaded labour cost per hour in EUR (salary + on-costs). Multiplies fte_hours_per_instance × instances_per_year into the annual labour baseline.' },
    cycle_time_days:        { type: 'number', minimum: 0, description: 'Median wall-clock days per instance, end to end. Long cycles relative to touch-time signal wait/latency drag.' },
    touch_ratio:            { type: 'number', minimum: 0, maximum: 1, description: 'Touch-time ÷ cycle-time (0–1). The remainder is wait; a low value means the process is mostly waiting, which pushes the intervention toward Consolidate & re-sequence.' },
    handoffs:               { type: 'number', minimum: 0, description: 'Distinct owners/systems an instance passes through. Weighed against the per-function median; many handoffs make handoff drag dominant and point to Consolidate & re-sequence.' },
    rework_rate:            { type: 'number', minimum: 0, maximum: 1, description: 'Fraction of instances reopened/reworked (0–1). When rework is the dominant drag factor the intervention becomes Quality controls, and it also sets the addressable share for that path.' },
    automation_level:       { type: 'number', minimum: 0, maximum: 1, description: 'Share already automated (0–1). Low automation makes manual effort the dominant drag and selects Automate; the un-automated remainder is the addressable share.' },
    direct_spend_eur:       { type: 'number', minimum: 0, description: 'Annual licence/vendor/tooling spend on the process in EUR. Added to the labour baseline and shifts how much of the saving is labour- vs spend-addressable.' },
    signal_completeness:    { type: 'number', minimum: 0, maximum: 1, description: 'Optional 0–1. How much of the above was measured versus defaulted. Governs decision_confidence proportionally — lower it when you estimated inputs so the verdict stays honest. Defaults to 0.7.' },
    readiness:              { type: 'string', enum: READINESS, description: 'Optional. Org change-absorption capacity — agile / traditional / siloed — which caps the realised (net) saving below the gross potential. Defaults to traditional.' },
  },
};

const dragDecompositionSchema = {
  type: 'object', description: 'Share of heaviness from each friction factor (sums to ~1).',
  required: ['manual', 'handoffs', 'wait', 'rework', 'cycle'],
  properties: {
    manual: { type: 'number' }, handoffs: { type: 'number' }, wait: { type: 'number' },
    rework: { type: 'number' }, cycle: { type: 'number' },
  },
};

const diagnoseOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'brain_version', 'process_id', 'function', 'baseline_cost_eur', 'heaviness', 'drag_decomposition', 'intervention', 'net_saving_eur', 'efficiency_gain_pct', 'verdict', 'decision_confidence', 'assumptions', 'offer_to_execute', 'evidence_maturity', 'disclaimer'],
  properties: {
    bvf_version:         { type: 'string', description: 'AI BVF protocol version used.' },
    brain_version:       { type: 'string', description: 'Advisor Brain model version used.' },
    process_id:          { type: 'string', description: 'Echo of the input process id.' },
    function:            { type: 'string', description: 'Business function diagnosed.' },
    baseline_cost_eur:   { type: 'number', description: 'Current annual cost: labour + direct spend.' },
    heaviness:           { type: 'number', description: 'Process heaviness index, 0–100.' },
    drag_decomposition:  dragDecompositionSchema,
    intervention:        { type: 'string', enum: ['Automate', 'Consolidate & re-sequence', 'Quality controls', 'Eliminate / insource'], description: 'Recommended move.' },
    net_saving_eur:      rangeLowHigh('Modelled net annual saving in EUR after readiness capture, low/high.'),
    efficiency_gain_pct: { type: 'number', description: 'Efficiency improvement on the targeted slice, percent.' },
    verdict:             { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'], description: 'The call on the intervention.' },
    decision_confidence: { type: 'number', description: 'Confidence in the verdict, 0–100.' },
    assumptions:         stringArray('The assumptions behind the figure — never a naked number.'),
    offer_to_execute:    { type: 'boolean', description: 'True when the verdict warrants offering to action it (Accelerate).' },
    evidence_maturity:   { type: 'string', enum: ['High', 'Medium', 'Low'], description: 'Strength of the benchmark evidence behind the effectiveness band.' },
    disclaimer:          { type: 'string', description: 'Directional decision aid, not an audited figure.' },
    method_note:  { type: 'string', description: 'Present only for Fix/Stop verdicts: where the method and the code are published. It carries no offer.' },
  },
};

const inferReadinessInputSchema = {
  type: 'object',
  required: ['function'],
  properties: {
    function: { type: 'string', enum: FUNCTIONS, description: 'Business function the process belongs to. Selects the disclosed AI BVF cycle-time and hand-off reference points used to interpret the signals. Call list_taxonomy if unsure.' },
    handoffs: { type: 'number', minimum: 0, description: 'Distinct owners or systems an instance passes through. Read against the function median: 1.5x or more the median reads siloed, at or above the median reads traditional, below it reads agile.' },
    rework_rate: { type: 'number', minimum: 0, maximum: 1, description: 'Fraction of instances reopened or reworked (0-1). 15% or more reads siloed, 5-15% traditional, under 5% agile.' },
    touch_ratio: { type: 'number', minimum: 0, maximum: 1, description: 'Touch-time divided by cycle-time (0-1); the remainder is waiting. Under 0.15 reads siloed (the process lives in queues), 0.15-0.4 traditional, above 0.4 agile.' },
    automation_level: { type: 'number', minimum: 0, maximum: 1, description: 'Share of the process already automated (0-1). Under 0.2 reads siloed, 0.2-0.5 traditional, above 0.5 agile.' },
    cycle_time_days: { type: 'number', minimum: 0, description: 'Median wall-clock days per instance. Read against the function median, same bands as handoffs.' },
    claimed_readiness: { type: 'string', enum: ['agile', 'traditional', 'siloed'], description: 'Optional. What the organisation says about itself. The measured result is compared against it and the gap returned as readiness_gap plus a gap_finding, because an organisation whose self-image runs ahead of its process data has just told you where the change work starts.' },
  },
};

const inferReadinessOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'readiness', 'readiness_basis', 'confidence', 'signals_used', 'signal_reads', 'guidance'],
  properties: {
    bvf_version:     { type: 'string', description: 'AI BVF protocol version used.' },
    readiness:       { type: 'string', enum: ['agile', 'traditional', 'siloed'], description: 'The readiness classification the measured signals support.' },
    readiness_basis: { type: 'string', enum: ['measured'], description: 'Always measured: this came from process data, not self-report.' },
    confidence:      { type: 'number', description: 'Confidence 0-100, set by signal coverage (2 signals ~45, 5 signals ~90) and discounted when signals disagree.' },
    signals_used:    { type: 'number', description: 'How many of the five signals were provided.' },
    signal_reads: {
      type: 'array', description: 'Per-signal read: the value, which readiness it leans toward, and why in plain language. Show these to the user.',
      items: { type: 'object', properties: {
        signal: { type: 'string' }, value: { type: 'number' },
        leans: { type: 'string', enum: ['agile', 'traditional', 'siloed'] },
        note: { type: 'string' },
      } },
    },
    disagreement: { type: 'string', description: 'Present when signals point in opposing directions: readiness is uneven across the process, read the per-signal detail.' },
    claimed_readiness: { type: 'string', enum: ['agile', 'traditional', 'siloed'], description: 'Echo of the claim, when supplied.' },
    readiness_gap: { type: 'number', description: 'Ordinal distance claimed-to-measured. Positive: the organisation claims better than it measures.' },
    gap_finding: { type: 'string', description: 'The claimed-versus-measured gap read as a change-readiness finding. Surface verbatim when present.' },
    guidance:     { type: 'string', description: 'How to use the result downstream, including what a gap between measured and self-reported readiness means.' },
    audit: auditSchema,
  },
};

const sequenceInputSchema = {
  type: 'object',
  description: 'Sequence one scored portfolio by passing either portfolio, or organization plus initiatives, never both. readiness is always required because it sets pacing. constraints are optional and default to two concurrent initiatives per function across a 90-day horizon.',
  required: ['readiness'],
  properties: {
    organization: {
      type: 'object', description: 'Organisation context used when initiatives are passed at the top level. Required with top-level initiatives and ignored when portfolio is supplied.', required: ['industry', 'revenue_eur'],
      properties: {
        name: { type: 'string', description: 'Optional organisation name.' },
        industry: { type: 'string', enum: INDUSTRIES, description: 'Industry for benchmark multipliers. Call map_to_taxonomy for everyday-language mapping.' },
        revenue_eur: { type: 'number', minimum: 0, description: 'Annual revenue in EUR; scales every modelled value.' },
      },
    },
    initiatives: {
      type: 'array', minItems: 1,
      description: 'The portfolio to sequence. Each initiative carries flat 0-100 pillar numbers (not the nested value objects of the portfolio wire format).',
      items: {
        type: 'object', required: ['id', 'name', 'function', 'ai_tier', 'scores'],
        properties: {
          id: { type: 'string', description: 'Stable initiative identifier used in waves, conflicts and deferrals.' },
          name: { type: 'string', description: 'Initiative name shown in the sequenced plan.' },
          function: { type: 'string', enum: FUNCTIONS, description: 'Business function absorbing the change. Capacity limits are enforced against this field.' },
          ai_tier: { type: 'string', enum: AI_TIERS, description: 'AI ambition, gen1, gen2 or gen3. Higher tiers are treated as more complex when wave placement is decided.' },
          scores: {
            type: 'object', description: 'The four flat 0-100 pillar values used to classify and place the initiative. Pass the score_initiative scores_used values, not nested score objects.', required: ['strategic_alignment', 'financial_return', 'change_enablement', 'governance_risk'],
            properties: {
              strategic_alignment: { type: 'number', minimum: 0, maximum: 100, description: 'Strategic-alignment score from score_initiative, 0-100.' },
              financial_return: { type: 'number', minimum: 0, maximum: 100, description: 'Financial-return score from score_initiative, 0-100.' },
              change_enablement: { type: 'number', minimum: 0, maximum: 100, description: 'Change-enablement score from score_initiative, 0-100.' },
              governance_risk: { type: 'number', minimum: 0, maximum: 100, description: 'Governance-risk score from score_initiative, 0-100, where higher means more risk.' },
            },
          },
        },
      },
    },
    portfolio: { type: 'object', description: 'Alternative input: the same AI BVF v1.0 portfolio document score_portfolio accepts (organization + initiatives with nested {value} pillar scores). Pass either this OR the top-level organization + initiatives; nested score values are flattened automatically, and missing pillars are estimated honestly.' },
    readiness: { type: 'string', enum: READINESS, description: 'Organisational readiness applied across the portfolio; sets capture rates and pacing. Measure it with infer_readiness when process numbers exist.' },
    constraints: {
      type: 'object',
      description: 'Change-capacity constraints. The defaults encode the core principle: no function absorbs unlimited concurrent change.',
      properties: {
        max_parallel_per_function: { type: 'number', minimum: 1, description: 'Max initiatives landing on one business function per wave. Default 2. Overflow defers to the next wave and is reported as a capacity conflict, because the constraint is itself a finding.' },
        horizon_days: { type: 'number', minimum: 30, description: 'Planning horizon in days, split into three equal waves. Default 90.' },
      },
    },
  },
};

const sequenceOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'waves', 'capacity_conflicts', 'totals', 'sequencing_principles', 'audit'],
  properties: {
    bvf_version: { type: 'string' },
    waves: {
      type: 'array',
      description: 'Three waves with named gates: Stops first (free the budget), quick Accelerates second (buy trust), complex Accelerates plus Fixes third (spend the trust). Present this to the user as the rollout plan.',
      items: { type: 'object', properties: {
        wave: { type: 'number' }, window_days: { type: 'array', items: { type: 'number' } },
        theme: { type: 'string' }, rationale: { type: 'string' },
        initiatives: { type: 'array', items: { type: 'object' } },
        gate_to_next: { type: ['string', 'null'], description: 'What must be true before the next wave starts. Null on the final wave.' },
      } },
    },
    capacity_conflicts: { type: 'array', description: 'Where more initiatives land on one function than it can absorb per wave, with the deferral applied. Surface these: an overloaded function is how good portfolios fail.', items: { type: 'object' } },
    deferred_beyond_horizon: { type: 'array', items: { type: 'object' }, description: 'Initiatives that did not fit the horizon under the capacity constraint; they need their own decision.' },
    skipped: { type: 'array', items: { type: 'object' } },
    totals: { type: 'object', description: 'Counts: stopped, quick_wins, complex_or_fix, deferred.' },
    aggregate_accelerate_value_eur: { type: 'object', description: 'Sum of modelled net EUR for the sequenced Accelerates, low and high.' },
    sequencing_principles: { type: 'array', items: { type: 'string' } },
    audit: auditSchema,
  },
};

const mapTaxonomyInputSchema = {
  type: 'object',
  properties: {
    industry: { type: 'string', description: 'Everyday industry language, e.g. banking, ecommerce, pharma. Resolved to the canonical enum.' },
    function: { type: 'string', description: 'Everyday function language, e.g. customer service, procurement, legal, people. Resolved to cx, supply, risk, hr and so on.' },
    ai_tier: { type: 'string', description: 'Everyday AI language, e.g. RPA, GenAI copilot, autonomous agents. Resolved to gen1/gen2/gen3.' },
    readiness: { type: 'string', description: 'Everyday culture language, e.g. bureaucratic, cross-functional, hierarchical. Resolved to agile/traditional/siloed.' },
  },
};

const mapTaxonomyOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'guidance'],
  properties: {
    bvf_version: { type: 'string' },
    industry: { type: 'object', description: 'input, resolved and matched_on; or resolved null with suggestions when no confident match, plus candidates when the wording pointed to more than one value.' },
    function: { type: 'object' }, ai_tier: { type: 'object' }, readiness: { type: 'object' },
    guidance: { type: 'string' },
  },
};

const assemblePortfolioInputSchema = {
  type: 'object',
  description: 'Build a valid portfolio document from loose organisation and initiative inputs. organization and at least one initiative are required. readiness defaults to traditional; missing pillar scores are estimated and reported, while unresolved taxonomy values return issues instead of guesses.',
  required: ['organization', 'initiatives'],
  properties: {
    organization: {
      type: 'object',
      description: 'Organisation identity and context shared by every initiative in the assembled portfolio.',
      required: ['name', 'industry'],
      properties: {
        name: { type: 'string', description: 'The organisation the portfolio belongs to.' },
        industry: { type: 'string', description: 'Canonical id or plain language: banking resolves to financial, pharma to healthcare.' },
        revenue_eur: { type: 'number', description: 'Optional annual revenue in EUR. Needed later for value modelling in score_portfolio.' },
        region: { type: 'string', description: 'Optional operating region retained as portfolio context; it does not alter scoring today.' },
        headcount: { type: 'number', minimum: 0, description: 'Optional employee count retained as portfolio context; it does not alter scoring today.' },
      },
    },
    initiatives: {
      type: 'array',
      description: 'One entry per initiative, from whatever the user gave you. Only name, function and ai_tier are required.',
      items: {
        type: 'object',
        required: ['name', 'function', 'ai_tier'],
        properties: {
          name: { type: 'string', description: 'Plain name. Also the source of the generated id when none is given.' },
          id: { type: 'string', description: 'Optional slug (lowercase letters, digits, hyphens, max 64). Generated from the name when absent, deduplicated deterministically.' },
          function: { type: 'string', description: 'Canonical id or plain language: customer service resolves to cx, procurement to supply.' },
          ai_tier: { type: 'string', description: 'Canonical id or plain language: RPA resolves to gen1, copilot to gen2, agentic to gen3.' },
          scores: {
            type: 'object',
            description: 'The pillar scores you have real evidence for, as bare numbers 0 to 100. Do NOT invent the rest: missing pillars are estimated deterministically, carry low confidence in the document, and are reported in estimated_pillars.',
            properties: {
              strategic_alignment: { type: 'number', minimum: 0, maximum: 100, description: 'Optional evidenced strategic-alignment score, 0-100; omitted values are estimated.' },
              financial_return: { type: 'number', minimum: 0, maximum: 100, description: 'Optional evidenced financial-return score, 0-100; omitted values are estimated.' },
              change_enablement: { type: 'number', minimum: 0, maximum: 100, description: 'Optional evidenced change-enablement score, 0-100; omitted values are estimated.' },
              governance_risk: { type: 'number', minimum: 0, maximum: 100, description: 'Optional evidenced governance-risk score, 0-100, where higher means more risk; omitted values are estimated.' },
            },
          },
          work_architecture: workArchitectureInputSchema,
          signal_completeness: { type: 'number', minimum: 0, maximum: 1, description: 'Optional input-quality factor retained for portfolio scoring. Lower it when supplied pillars rest on weak evidence.' },
          bucket: { type: 'string', enum: ['Agent-Proof', 'Agent-Augmented', 'Agent-Replaceable'], description: 'Optional workforce-impact label retained in the document; it does not change the verdict today.' },
          compliance: { type: 'array', items: { type: 'string', enum: ['eu_ai_act', 'dora', 'csrd', 'gdpr_ai'] }, description: 'Optional known compliance regimes retained in the document; governance risk still comes from the supplied or estimated pillar score.' },
        },
      },
    },
    readiness: { type: 'string', description: 'Organisational readiness, canonical or plain language (bureaucratic resolves to siloed). Drives estimation of missing pillars. Defaults to traditional.' },
  },
};

const assemblePortfolioOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'resolutions', 'assumptions', 'estimated_pillars', 'issues', 'readiness_used', 'guidance', 'audit'],
  properties: {
    bvf_version: { type: 'string' },
    portfolio: { type: 'object', description: 'The assembled BVF v1.0 document, ready for validate_portfolio, score_portfolio and sequence_portfolio. Null when assembly is blocked on issues.' },
    resolutions: { type: 'array', items: { type: 'string' }, description: 'Every alias resolution performed, in plain language.' },
    assumptions: { type: 'array', items: { type: 'string' }, description: 'Every default the assembler applied, in plain language. Surface these to the user: what was not given is named here.' },
    estimated_pillars: { type: 'object', description: 'Initiative id to the pillars the assembler estimated. Gather evidence for these, or expect scoring to haircut confidence.' },
    issues: { type: 'array', items: { type: 'object' }, description: 'Unresolved inputs, each with path, message and suggestions where the taxonomy has them.' },
    validation: { type: 'object', description: 'validate() run on the assembled document.' },
    readiness_used: { type: 'string' },
    guidance: { type: 'string' },
    audit: auditSchema,
  },
};

const SCORE_INITIATIVE_DESCRIPTION = 'Canonical-field scorer for one AI initiative. CALL THIS when industry, revenue_eur, function, ai_tier and readiness are already known, or when re-scoring with measured pillar evidence. For a proposal written in ordinary business language, call assess_ai_initiative first; it resolves these fields and asks for anything missing. Pillar scores remain optional: missing pillars are estimated deterministically, reported through pillar_basis, and reduce decision score, while a fully estimated pass can never return Accelerate. Returns Accelerate, Fix or Stop, modelled gross and readiness-adjusted EUR benefit ranges, decision score, sensitivity, assumptions and an audit trail. Use score_portfolio for several initiatives and diagnose_process for measured waste in an existing process. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.';
const ASSESS_INITIATIVE_DESCRIPTION = "The front door for one AI investment decision. CALL THIS FIRST when the user describes an AI idea in ordinary language or asks whether it should proceed. It works as a short guided conversation and returns one thing to ask at a time. Pass the proposal unchanged on every call, plus everything the user has answered so far. needs_input: a piece of context (industry, business function, AI type or headcount) could not be read; ask question and pass the answer in its named field. needs_confirmation: show the understood statement, ask the user whether it is right, then call again with confirmed true or with the corrected item. not_enough_to_judge: ask question, the next of at most five plain questions, showing every choice label; pass the id of the choice the user picks in answers. When question is absent, tell the user what is listed in to_find_out and stop. verdict: Accelerate, Fix or Stop, from the user's answers read against the proposal. Where the words of the proposal contradict a favourable answer, the verdict is held at Fix and contradictions quotes those words; show them beside the answer and ask the user which is true. Give the user summary first, then each item in holding_back with what they said and what it needs to become, then first_step; these are written in everyday words, so do not replace them with framework terms. Lead with warning whenever it is present. This tool fills in no score and returns no euro figure, so never state a euro benefit from this result. With a person present, never set confirmed and never pick an answer for them; when they are unsure, pass unknown. WORKING ALONE under your owner's mandate, with nobody to ask, use evidence mode: set answered_by to evidence, pass for each question the answer your evidence supports, and put the exact quote and its source in evidence, as a list of up to three when the answer rests on more than one document. An answer with no quote is counted as not known, so pass unknown when you found nothing; where_to_look says where each answer is usually written down. Answer all five questions in one call: open_questions lists every question still open with its choices, including how the work changes, which the sequence for a person asks only when the other four clear. In evidence mode you check the understood statement against what you read and set confirmed yourself. The verdict then carries provenance: say its statement with the verdict. Where two records disagree on an answer, pass the words of the other record in evidence_against: the answer is counted as not known and conflicts returns both, with the question to put to the owner. At a return visit, pass review with previous_brief, the brief_url of the earlier verdict: since_last then says which answers changed and which change moved the verdict. For the person who holds the budget, pass funding with what is asked for the next stage, the alternative and up to three results agreed to release more money: funding comes back beside the verdict with what is still not known, and at a return visit with each agreed result marked met or not met. It never changes the verdict and never says whether to fund. Give the user brief_url, the link to the one-page brief. Organisations under 250 people get questions worded for a smaller firm, with the same rules for every size. Use score_initiative when canonical fields and 0 to 100 scores are already known and a planning range is wanted, score_portfolio for several initiatives, and diagnose_process for measured waste in a running process. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.";
const RECOMMEND_IMPROVEMENTS_DESCRIPTION = 'Turn a Fix or Stop verdict into the change plan that could earn a re-score, with pillar targets, named plays, owners, stop conditions, cost of waiting and a deadline. CALL THIS after score_initiative returns Fix or Stop, using the same five context fields and any scores or work-architecture evidence from that call. Do not use it to produce the initial verdict, sequence several initiatives or diagnose measured process waste; use score_initiative, sequence_portfolio or diagnose_process for those jobs. Do not call it for Accelerate unless a specific delivery risk needs testing before commitment. resistance_type selects the will or skill route, risk_type selects the regulatory, reputational or operational route, and omitted diagnostics remain provisional with the next question returned. Lead with binding_constraint, surface honest_stop when present, and use rescore_gate to decide whether this remains Fix or becomes Stop. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.';

const EXAMPLE_ORGANIZATION = { name: 'Example retailer', industry: 'retail', revenue_eur: 300_000_000 };
const EXAMPLE_SCORES = { strategic_alignment: 70, financial_return: 64, change_enablement: 48, governance_risk: 35 };
const EXAMPLE_PORTFOLIO = {
  bvf_version: '1.0',
  organization: EXAMPLE_ORGANIZATION,
  initiatives: [
    { id: 'service-assistant', name: 'Customer service assistant', function: 'cx', ai_tier: 'gen2', scores: EXAMPLE_SCORES },
    { id: 'invoice-matching', name: 'Invoice matching', function: 'finance', ai_tier: 'gen1', scores: { strategic_alignment: 75, financial_return: 80, change_enablement: 70, governance_risk: 25 } },
  ],
};

/**
 * One complete, working call per tool, published in each input schema as
 * `examples`. A test calls every one of them, so an example cannot go stale.
 */
export const TOOL_EXAMPLES: Record<string, Record<string, unknown>> = {
  assess_ai_initiative: { proposal: 'We are a 400-person online retailer. We want an AI agent to answer first-line customer queries and issue refunds up to 50 euros on its own.' },
  score_initiative: { industry: 'retail', revenue_eur: 300_000_000, function: 'cx', ai_tier: 'gen2', readiness: 'traditional' },
  score_portfolio: { portfolio: EXAMPLE_PORTFOLIO, readiness: 'traditional' },
  recommend_improvements: { industry: 'retail', revenue_eur: 300_000_000, function: 'cx', ai_tier: 'gen2', readiness: 'traditional', scores: EXAMPLE_SCORES },
  calculate_pace_layer_drag: { revenue_eur: 300_000_000, ai_tier: 'gen2', readiness: 'traditional' },
  validate_portfolio: { portfolio: EXAMPLE_PORTFOLIO },
  get_benchmark: { function: 'cx', industry: 'retail' },
  list_taxonomy: {},
  diagnose_process: {
    process_id: 'invoice-matching', function: 'finance', instances_per_year: 12_000, fte_hours_per_instance: 0.5,
    loaded_hourly_rate_eur: 45, cycle_time_days: 3, touch_ratio: 0.2, handoffs: 4, rework_rate: 0.12,
    automation_level: 0.3, direct_spend_eur: 20_000,
  },
  infer_readiness: { function: 'finance', handoffs: 4, rework_rate: 0.12, cycle_time_days: 3 },
  sequence_portfolio: { readiness: 'traditional', portfolio: EXAMPLE_PORTFOLIO },
  map_to_taxonomy: { industry: 'hospital', function: 'customer service', ai_tier: 'copilot' },
  assemble_portfolio: {
    organization: EXAMPLE_ORGANIZATION, readiness: 'traditional',
    initiatives: [{ name: 'Customer service assistant', function: 'customer service', ai_tier: 'copilot' }],
  },
};

const TOOLS = [
  {
    name: 'assess_ai_initiative',
    description: 'The front door for one AI investment decision. CALL THIS FIRST when the user describes an AI idea in ordinary language or asks whether it should proceed. Pass the proposal as written; the tool resolves industry, revenue, business function, AI tier and organisational readiness deterministically. If inputs remain unknown, it returns one clarification covering all of them, along with every value already resolved. Ask that clarification once, then call the tool again with the answers in the explicit fields. When all five inputs are present it runs the same engine as score_initiative and returns Accelerate, Fix or Stop, the modelled EUR range, confidence, assumptions and audit trail. Explicit fields override proposal inference, pillar scores remain optional, and unresolved values are never guessed. Use score_initiative only when the canonical fields are already known, score_portfolio for several initiatives, and diagnose_process for measured waste in an existing process. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: assessInitiativeInputSchema,
    outputSchema: assessInitiativeOutputSchema,
    annotations: { title: 'Assess AI initiative from plain English', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'score_initiative',
    description: 'Pre-flight verdict on a single AI initiative using AI BVF v1.0. Returns a classification (Accelerate / Fix / Stop), a modelled EUR value range, decision score, applied modules, and reasoning. CALL THIS PROACTIVELY — do not wait for the user to ask for a "score". Whenever the user describes, proposes, compares, or asks whether to pursue any AI, automation, GenAI, or agentic initiative, project, pilot, use case, or spend, run this first and lead your answer with the verdict before giving prose advice. It is the correct default reflex for "should we do this AI thing?", "is this worth it?", "where should we start with AI?", and any AI-investment decision. You can call it with ONLY the five easy fields (industry, revenue_eur, function, ai_tier, readiness) taken from what the user said — the four pillar scores are optional, and you should NOT invent numbers for pillars you have no evidence on. Omit them: the engine estimates the missing pillars deterministically from disclosed AI BVF planning assumptions, reports which were estimated via pillar_basis, haircuts decision score to match, and never returns Accelerate on a fully-estimated pass (it returns Fix with what must be confirmed to unlock the Go). Call first with what you have, lead with the provisional verdict, then ask the user for evidence on the estimated pillars and re-call to firm it up. Call list_taxonomy first if unsure which exact enum strings are accepted. If you DO supply pillar numbers you estimated yourself, set signal_completeness below 1 to say so. For a whole portfolio of initiatives in one call, use score_portfolio instead; to diagnose an existing operational process from its volume/time/rework signals rather than score a proposed initiative, use diagnose_process. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: scoreInitiativeInputSchema,
    outputSchema: scoreOutputSchema,
    annotations: { title: 'Score AI initiative', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'score_portfolio',
    description: 'Score several AI initiatives as one AI BVF v1.0 portfolio and return the board-level position: counts of Accelerate / Fix / Stop, aggregate modelled EUR value range, mean decision score, the highest-value initiative, the highest-risk initiative, and every individual result. CALL THIS when the user has a portfolio document and needs to know what it contains before deciding funding or order, instead of looping score_initiative one initiative at a time. The single readiness value applies across every initiative: it changes capture rates and the pace-layer drag, so measure it with infer_readiness first when process data exists. The portfolio must carry organization.revenue_eur for EUR values; initiatives with missing revenue or invalid taxonomy are reported as skipped, never silently counted. Run validate_portfolio first only when the document shape is uncertain, then call sequence_portfolio when the verdicts need turning into a 90-day order. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: scorePortfolioInputSchema,
    outputSchema: scorePortfolioOutputSchema,
    annotations: { title: 'Score AI portfolio', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'recommend_improvements',
    description: 'Turn a Fix or Stop verdict into the change plan that could earn a re-score: pillar targets plus named plays, owners, stop conditions, cost of waiting and a deadline. CALL THIS after score_initiative returns Fix or Stop. Do not call it for an Accelerate verdict unless the user has identified a real delivery risk and needs to test the plan before committing. resistance_type changes the change-enablement play: will selects Kotter urgency, coalition and ADKAR Desire, skill selects ADKAR Knowledge and Ability. risk_type changes the governance route: regulatory selects pre-deployment remediation, reputational selects visible trust guardrails, operational selects proportionate controls. Omit either only when unknown, then the response marks the inferred play provisional and gives the question needed to test it. The four pillars can be partial, but estimated scores make the plan provisional and must be re-measured before spend is committed. Lead with binding_constraint, surface honest_stop verbatim when present, then use the rescore_gate to decide whether this remains a Fix or becomes Stop. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: recommendInputSchema,
    outputSchema: recommendOutputSchema,
    annotations: { title: 'Recommend pillar improvements', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'calculate_pace_layer_drag',
    description: 'Quantify the annual EUR cost of an AI ambition outrunning the operating model: queues, hand-offs and slow decisions that prevent the organisation capturing the value already assumed in the case. CALL THIS when the user needs the cost of waiting for the organisation to change, or when a Fix plan needs a cost-of-waiting figure. Do not use it to score an AI initiative, estimate the implementation cost, or calculate a process saving: use score_initiative for the investment verdict, diagnose_process for a running process, and recommend_improvements for the change plan. revenue_eur sets the absolute EUR range; ai_tier and readiness together set the drag rate and pace_gap, so gen3 in a siloed organisation costs more than gen1 in an agile one. industry is accepted for a consistent interface and defaults to universal, but does not change this calculation yet. Returns a low/high EUR range, drag rate, pace-gap severity, drivers and source. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: paceLayerInputSchema,
    outputSchema: paceLayerOutputSchema,
    annotations: { title: 'Calculate pace-layer drag cost', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'validate_portfolio',
    description: 'Check whether a supplied AI BVF v1.0 portfolio document has the shape the portfolio tools require, before scoring, sequencing, storing or sharing it. CALL THIS when the document came from a file, another system or hand-built JSON and its structure is uncertain. It checks required fields, taxonomy values and 0–100 pillar ranges only; it does not judge the evidence or calculate a verdict. Pillars may be bare numbers or { value, confidence } objects, both are valid. Use assemble_portfolio when the user has a list of initiatives in conversation and needs the document built for them, score_portfolio when the document is already ready for verdicts, and sequence_portfolio only after its initiatives are scoreable. Returns valid=true or one error per failing JSON path. Deterministic validation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: {
      type: 'object',
      required: ['portfolio'],
      properties: {
        portfolio: {
          type: 'object',
          description: 'The portfolio document as a JSON object following the AI BVF v1.0 schema: a top-level object with bvf_version, organization, and a non-empty "initiatives" array, each initiative carrying the same fields score_initiative expects (industry, revenue_eur, function, ai_tier, readiness, and a scores object with the four 0–100 pillars, each either a bare number or an object { value, confidence? }; both shapes pass). Checked structurally only — required fields present, correct types, enum values valid, pillar numbers in range; the pillar values are NOT scored or judged here (use score_initiative or score_portfolio for that). On failure, errors[] names each failing JSON path and the rule it broke.',
        },
      },
    },
    outputSchema: validateOutputSchema,
    annotations: { title: 'Validate BVF portfolio document', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_benchmark',
    description: 'Look up the disclosed AI BVF planning rates behind the value model for one business function and industry. CALL THIS when the user wants to inspect the revenue-uplift and cost-takeout assumptions before scoring, or to compare the value drivers across functions. function selects the base rate range and named drivers; industry applies the multiplier, while universal returns the unadjusted base rate. External research in the evidence register frames the adoption and value problem but does not publish these function rates. The output is a rate, expressed as a fraction of revenue, not an initiative verdict or EUR business case. Replace it with measured organisation evidence before funding. Use score_initiative for an Accelerate/Fix/Stop decision, score_portfolio for several initiatives and diagnose_process for measured operational waste. Deterministic lookup with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: {
      type: 'object',
      required: ['function', 'industry'],
      properties: {
        function: { type: 'string', enum: FUNCTIONS, description: 'Business function to benchmark — must be one of the list_taxonomy function values. Selects the base revenue-uplift and cost-reduction rate ranges (returned as fractions of revenue) and the value drivers.' },
        industry: { type: 'string', enum: INDUSTRIES, description: 'Industry whose multiplier to apply — must be one of the list_taxonomy industry values. The returned industry_multiplier is applied to the function base rates; pass "universal" for the un-adjusted rates.' },
      },
    },
    outputSchema: benchmarkOutputSchema,
    annotations: { title: 'Get planning rates', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'list_taxonomy',
    description: 'Return the exact industry, function, AI-tier and readiness values every AI BVF calculation accepts. CALL THIS when the caller needs the complete allowed list or when a free-text value is not obvious. It returns taxonomy only, no score, verdict or language mapping. Use map_to_taxonomy when the user has said customer service, banking, RPA or bureaucratic and you need the one canonical value; use this tool when they need the whole menu of values to choose from. Takes no parameters. Deterministic lookup with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: taxonomyOutputSchema,
    annotations: { title: 'List BVF taxonomy enums', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'diagnose_process',
    description: 'Diagnose a single existing business process from operational evidence and return the intervention, modelled net EUR saving, efficiency gain, verdict and confidence. CALL THIS when the user can describe a process already running, including volume, touch time, waiting, hand-offs, rework, automation and cost. instances_per_year × fte_hours_per_instance × loaded_hourly_rate_eur builds the labour baseline, direct_spend_eur adds the non-labour baseline, and readiness caps the saving that the organisation can realise. The intervention is chosen by the first rule that fits: under 250 instances a year with heaviness of 50 or more is Eliminate / insource; 30 percent rework or more is Quality controls; 15 minutes of work or less with one person at most and 1,000 instances a year or more is Automate; otherwise the largest drag factor decides, with manual work pointing to Automate, rework to Quality controls, and hand-offs, wait or cycle time to Consolidate & re-sequence. assumptions names the rule that chose. signal_completeness must fall when inputs are estimated, because it directly reduces decision score. Use score_initiative for a proposed AI investment and infer_readiness when the question is the organisation’s change capacity. Effectiveness bands are benchmark-cited and figures are directional, not audited. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: diagnoseInputSchema,
    outputSchema: diagnoseOutputSchema,
    annotations: { title: 'Diagnose business process', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'infer_readiness',
    description: 'Measure organisational readiness from process data, so the investment case does not depend on an untested maturity claim. CALL THIS before score_initiative, score_portfolio or calculate_pace_layer_drag when the user can provide at least two of five signals: hand-offs, rework, touch ratio, automation level and cycle time. function selects the comparison medians for hand-offs and cycle time; more signals increase confidence and disagreement between them reduces it. claimed_readiness is optional, but pass it when the organisation has declared itself agile, traditional or siloed, because the returned gap exposes where its self-image runs ahead of the process data. Fewer than two signals produces a refusal, not a guess. Pass the measured readiness into the downstream tool, then use diagnose_process when the next question is what to change in that process. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: inferReadinessInputSchema,
    outputSchema: inferReadinessOutputSchema,
    annotations: { title: 'Measure readiness from process signals', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'sequence_portfolio',
    description: 'Turn a scored AI portfolio into three waves with gates over a configurable horizon, so the roadmap respects the change capacity of each business function. CALL THIS after score_portfolio when the user asks what to stop, fund first, defer or fit into the next 90 days. It does not change any verdict or re-score the business case. Stops enter wave 1 to reclaim budget and attention, quicker Accelerates enter wave 2, complex Accelerates and Fixes enter wave 3 behind their re-score gates. Pass the portfolio returned by score_portfolio directly through portfolio, or pass organization plus initiatives; both score shapes are accepted and nested values are flattened. readiness sets capture rates and pacing, max_parallel_per_function caps simultaneous change in one function per wave, and horizon_days divides the plan into three equal windows. Capacity overflow is reported as a conflict or a deferral beyond the horizon, never hidden. Run recommend_improvements for a Fix before treating its wave placement as permission to proceed. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: sequenceInputSchema,
    outputSchema: sequenceOutputSchema,
    annotations: { title: 'Sequence a portfolio into waves', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'map_to_taxonomy',
    description: 'Map everyday business language to the canonical AI BVF values required by the scoring tools. CALL THIS when the user says customer service, procurement, banking, GenAI copilot or bureaucratic and the matching enum is not certain. Pass only the fields written in free text; each returns the canonical value, what it matched on, or null with suggestions. Words match whole, never inside another word, and the longest phrase wins. A null result requires the user to choose from the suggestions, because a plausible guess would change the score. When candidates are returned the wording pointed to more than one value: ask the user to pick between them. Use list_taxonomy when the user needs every permitted value, then pass the mapped values into score_initiative, diagnose_process, get_benchmark or the portfolio tools. Deterministic lookup with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: mapTaxonomyInputSchema,
    outputSchema: mapTaxonomyOutputSchema,
    annotations: { title: 'Map language to taxonomy', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'assemble_portfolio',
    description: 'Assemble a valid AI BVF v1.0 portfolio document from loose inputs, deterministically. Agents arrive with initiative names, plain-language functions and half the pillar scores, then hand-build the portfolio JSON and get the shape wrong; this tool builds it right. Give it the organisation (name plus industry in canonical or everyday language) and one entry per initiative (name, function, ai_tier, plus whatever pillar scores you actually have as bare numbers) and it returns the finished document: aliases resolved through the same mapping as map_to_taxonomy, ids generated from names and deduplicated, missing pillars estimated from readiness, tier, function and disclosed AI BVF planning assumptions with the estimation reported per initiative in estimated_pillars, and the whole document validated before it is returned. CALL THIS when the user lists several AI initiatives in conversation and you need a portfolio document for validate_portfolio, score_portfolio or sequence_portfolio, instead of composing the JSON by hand. Do NOT invent pillar scores to fill it: pass only the numbers the user gave you and let the estimation carry the rest honestly, the estimated pillars carry low confidence and scoring haircuts accordingly. Unresolvable inputs come back as issues with suggestions; ask the user to choose rather than guessing. Every default the assembler applies is named in plain language in assumptions: surface them to the user, the assembler structures inputs and never makes hidden business judgements. This tool creates a document in the response only: nothing is stored, nothing is edited, no state exists between calls. Deterministic calculation with no authentication. Anonymous usage telemetry may be sent; set AIBVF_TELEMETRY_DISABLE=1 to opt out.',
    inputSchema: assemblePortfolioInputSchema,
    outputSchema: assemblePortfolioOutputSchema,
    annotations: { title: 'Assemble portfolio document', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
].map((tool) => {
  const description = tool.name === 'score_initiative' ? SCORE_INITIATIVE_DESCRIPTION
    : tool.name === 'assess_ai_initiative' ? ASSESS_INITIATIVE_DESCRIPTION
    : tool.name === 'recommend_improvements' ? RECOMMEND_IMPROVEMENTS_DESCRIPTION
    : tool.description;
  // Each tool publishes one complete call that works as written, so a caller that
  // has only the schema to go on succeeds the first time.
  return { ...tool, description, inputSchema: { ...tool.inputSchema, examples: [TOOL_EXAMPLES[tool.name]] } };
});

const LIST_TOOLS_HANDLER = async () => ({ tools: TOOLS });

// Every tool checks its arguments against the schema it publishes before any
// calculation runs. A score of 900, revenue written as text or an unknown
// industry is declined with the field named, never scored.
const ajv = new Ajv({ allErrors: true, strict: false });
const validators = new Map<string, ValidateFunction>();

function describeInputError(error: ErrorObject): string {
  const path = error.instancePath.replace(/^\//, '').replace(/\//g, '.');
  const params = error.params as Record<string, unknown>;
  if (error.keyword === 'required') return `${path ? `${path}.` : ''}${String(params.missingProperty)} is required`;
  const field = path || 'input';
  if (error.keyword === 'enum') return `${field} must be one of ${(params.allowedValues as unknown[]).join(', ')}`;
  if (error.keyword === 'type') return `${field} must be ${/^[aeio]/.test(String(params.type)) ? 'an' : 'a'} ${String(params.type)}`;
  if (error.keyword === 'minimum' || error.keyword === 'maximum') return `${field} must be ${String(params.comparison)} ${String(params.limit)}`;
  return `${field} ${error.message ?? 'is invalid'}`;
}

/** Throws a plain Error naming every failing field, which telemetry records as refused. */
export function checkToolInput(name: string, args: unknown): void {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  // assemble_portfolio reports each unusable entry as an issue with suggestions
  // and assembles the rest, so it reads loose input itself.
  if (!tool || name === 'assemble_portfolio') return;
  let validate = validators.get(name);
  if (!validate) {
    validate = ajv.compile(tool.inputSchema as object);
    validators.set(name, validate);
  }
  if (validate(args ?? {})) return;
  const problems = [...new Set((validate.errors ?? []).map(describeInputError))].slice(0, 6);
  const taxonomy = (validate.errors ?? []).some((error) => error.keyword === 'enum'
    && /(industry|function|ai_tier|readiness)$/.test(error.instancePath));
  throw new Error(`${name} input was declined: ${problems.join('; ')}.${taxonomy ? ' Call map_to_taxonomy to turn everyday wording into the allowed values.' : ''}`);
}

/**
 * Said to every assistant that connects. Two ways of working: with a person
 * who answers, and alone under a mandate, where only quoted evidence counts.
 */
export const SERVER_INSTRUCTIONS = 'For one AI proposal written in ordinary business language, call assess_ai_initiative first. It fills in no score and gives no euro figure, so never state a euro benefit from it. WITH A PERSON PRESENT it is a guided conversation that returns one thing to ask at a time: ask it, then call again with the proposal unchanged, every answer so far and the returned assessment_id. Omit assessment_id for a new idea. Never set confirmed or pick an answer for that person. WORKING ALONE as an agent under your owner\'s mandate, with nobody to ask, use evidence mode: set answered_by to evidence, answer each question only from words you can quote, pass each quote with its source in evidence, and answer unknown where you found none. Answer all five questions in one call: open_questions lists each one still open with its choices. An answer without a quote is counted as not known. Say the returned provenance statement with every verdict reached this way. The prompt aibvf_agent holds the full operating brief for working alone: the mandate, the run and the rules. Use score_initiative only when the canonical fields are already known. Use the portfolio tools only when the user has several initiatives.';

/** The operating brief for an agent working alone, offered to clients that list prompts. */
export const AGENT_PROMPT = {
  name: 'aibvf_agent',
  title: 'AI BVF agent',
  description: `Run as the AI BVF agent: find the AI initiatives, judge each one from evidence you quote, draft the next step and keep it under review, alone, under a mandate the owner sets once. Operating brief version ${AGENT_BRIEF_VERSION}.`,
};
const PROMPTS = [AGENT_PROMPT];

const callToolHandler = (entryRoute: EntryRoute, context: TelemetryContext = {}) => async (req: any) => {
  const { name, arguments: args } = req.params;
  const assessmentId = name === 'assess_ai_initiative' ? opaqueId(args?.assessment_id) || randomUUID() : null;
  const recordCall = async (toolName: string, meta: Record<string, unknown> = {}) => {
    const request = logCall(toolName, { ...context, ...meta, assessmentId, entry_route: entryRoute });
    if (entryRoute === 'remote') await request;
  };

  try {
    checkToolInput(name, args);
    if (name === 'assess_ai_initiative') {
      const a = args as any;
      const r = assessInitiative(a);
      const answeredBy = a?.answered_by === 'evidence' ? 'evidence' : 'owner';
      if (r.status !== 'verdict') {
        await recordCall('assess_ai_initiative', {
          assessment_stage: r.status,
          question_key: r.question?.id,
          industry: r.resolved_inputs.industry, function: r.resolved_inputs.function,
          ai_tier: r.resolved_inputs.ai_tier,
          answered_by: answeredBy,
          ...(r.funding?.decision ? { funding_decision: r.funding.decision } : {}),
        });
        const payload = { bvf_version: BVF_VERSION, ...r, assessment_id: assessmentId };
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload,
        };
      }

      const s = r.verdict!;
      const feedback = feedbackFor(s.classification, r.resolved_inputs.industry);
      const methodNote = methodNoteFor(s.classification);
      await recordCall('assess_ai_initiative', {
        assessment_stage: 'verdict',
        work_architecture_status: s.work_architecture?.status,
        industry: r.resolved_inputs.industry, function: r.resolved_inputs.function,
        ai_tier: r.resolved_inputs.ai_tier,
        classification: s.classification, confidence: s.confidence,
        answered_by: answeredBy,
        // An outcome is recorded only once it is accepted: an agent has to quote what happened.
        ...(r.review?.accepted ? { review_previous_verdict: r.review.previous_verdict, review_outcome: r.review.outcome } : {}),
        // What the owner decided on the next round of money, as one of three words. No amount is recorded.
        ...(r.funding?.decision ? { funding_decision: r.funding.decision } : {}),
      });
      // The brief is rebuilt from the answers by the page that opens it. The link is made here and stored nowhere.
      const briefUrl = briefUrlFor(a, r, new Date().toISOString().slice(0, 10), { include_proposal: a?.brief_includes_proposal === true });
      const verdict = {
        bvf_version: BVF_VERSION,
        classification: s.classification,
        summary: s.summary,
        holding_back: s.holding_back,
        first_step: s.first_step,
        contradictions: s.contradictions,
        reason: s.reason,
        scores_supplied: s.scores_supplied,
        answers_given: s.answers_given,
        ...(s.confidence !== undefined ? { decision_confidence: s.confidence, interpretation: { decision_confidence: SCORE_INTERPRETATION.decision_confidence } } : {}),
        ...(s.verdict_flips ? { verdict_flips: s.verdict_flips } : {}),
        work_architecture: s.work_architecture,
        audit: s.audit,
        value_note: s.value_note,
        ...(s.provenance ? { provenance: s.provenance } : {}),
        ...(briefUrl ? { brief_url: briefUrl } : {}),
        ...(methodNote ? { method_note: methodNote } : {}),
        ...(feedback ? { feedback } : {}),
      };
      const payload = { bvf_version: BVF_VERSION, ...r, verdict, assessment_id: assessmentId };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'score_initiative') {
      const a = args as any;
      const r = score(a);
      const feedback = feedbackFor(r.classification, a.industry);
      await recordCall('score_initiative', {
        assessment_stage: 'verdict',
        work_architecture_status: r.work_architecture?.status,
        industry: a.industry, function: a.function,
        ai_tier: a.ai_tier, readiness: a.readiness,
        classification: r.classification, confidence: r.confidence,
      });
      const payload = {
        bvf_version: BVF_VERSION,
        classification: r.classification,
        reason: r.reason,
        net_value_eur: eurRange(r.net_low_eur, r.net_high_eur),
        gross_value_eur: eurRange(r.gross_low_eur, r.gross_high_eur),
        decision_confidence: r.confidence,
        multipliers: r.multipliers,
        drivers: r.drivers,
        scores_used: r.scores_used,
        pillar_basis: r.pillar_basis,
        sensitivity: r.sensitivity,
        benchmark_source: r.source,
        applied_modules: r.applied_modules,
        work_architecture: r.work_architecture,
        audit: r.audit,
        interpretation: SCORE_INTERPRETATION,
        ...(r.caveat ? { caveat: r.caveat } : {}),
        method_note: methodNoteFor(r.classification),
        ...(feedback ? { feedback } : {}),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'score_portfolio') {
      const a = args as any;
      const portfolio = a.portfolio;
      const readiness = a.readiness;
      await recordCall('score_portfolio', { readiness });

      const v = validate(portfolio);
      if (!v.valid) {
        const payload = {
          bvf_version: BVF_VERSION,
          valid: false,
          validation_errors: v.errors,
          organization: { name: portfolio?.organization?.name ?? '', industry: portfolio?.organization?.industry ?? '' },
          readiness,
          total: Array.isArray(portfolio?.initiatives) ? portfolio.initiatives.length : 0,
          summary: { accelerate: 0, fix: 0, stop: 0, skipped: 0 },
          aggregate_net_value_eur: { low: 0, high: 0 },
          mean_decision_confidence: 0,
          scored_initiatives: [],
          skipped_initiatives: [],
          interpretation: PORTFOLIO_INTERPRETATION,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload,
        };
      }

      const org = portfolio.organization;
      const industry = org.industry;
      const revenue_eur = org.revenue_eur;

      const scored: any[] = [];
      const skipped: any[] = [];

      for (const init of portfolio.initiatives) {
        if (typeof revenue_eur !== 'number') {
          skipped.push({ id: init.id, name: init.name, reason: 'organization.revenue_eur is required to model EUR value at the portfolio level.' });
          continue;
        }
        try {
          const scoringInput = portfolioScoreInput(init, {
            industry,
            revenue_eur,
            function: init.function,
            ai_tier: init.ai_tier,
            readiness,
          });
          const r = score(scoringInput);
          scored.push({
            id: init.id,
            name: init.name,
            function: init.function,
            ai_tier: init.ai_tier,
            classification: r.classification,
            reason: r.reason,
            net_value_eur: eurRange(r.net_low_eur, r.net_high_eur),
            decision_confidence: r.confidence,
            applied_modules: r.applied_modules,
            scores_used: r.scores_used,
            pillar_basis: r.pillar_basis,
            signal_completeness: scoringInput.signal_completeness,
            work_architecture: r.work_architecture,
            audit: r.audit,
            sensitivity: r.sensitivity,
            ...(r.caveat ? { caveat: r.caveat } : {}),
          });
        } catch (e) {
          skipped.push({ id: init.id, name: init.name, reason: e instanceof Error ? e.message : String(e) });
        }
      }

      const summary = {
        accelerate: scored.filter((s) => s.classification === 'Accelerate').length,
        fix:        scored.filter((s) => s.classification === 'Fix').length,
        stop:       scored.filter((s) => s.classification === 'Stop').length,
        skipped:    skipped.length,
      };

      const aggLow  = scored.reduce((sum, s) => sum + s.net_value_eur.low,  0);
      const aggHigh = scored.reduce((sum, s) => sum + s.net_value_eur.high, 0);

      const meanConf = scored.length > 0
        ? Math.round(scored.reduce((sum, s) => sum + s.decision_confidence, 0) / scored.length)
        : 0;

      const topByValue = scored.length > 0
        ? scored.reduce((best, s) => {
            const sMid    = (s.net_value_eur.low + s.net_value_eur.high) / 2;
            const bestMid = (best.net_value_eur.low + best.net_value_eur.high) / 2;
            return sMid > bestMid ? s : best;
          })
        : null;

      const RISK_RANK: Record<Classification, number> = { Stop: 0, Fix: 1, Accelerate: 2 };
      const highestRisk = scored.length > 0
        ? scored.reduce((worst, s) => {
            const sRank = RISK_RANK[s.classification as Classification];
            const wRank = RISK_RANK[worst.classification as Classification];
            if (sRank < wRank) return s;
            if (sRank === wRank && s.decision_confidence < worst.decision_confidence) return s;
            return worst;
          })
        : null;

      const payload: any = {
        bvf_version: BVF_VERSION,
        valid: true,
        validation_errors: [],
        organization: { name: org.name, industry: org.industry },
        readiness,
        total: portfolio.initiatives.length,
        summary,
        aggregate_net_value_eur: { low: eurRange(aggLow, aggHigh).low, high: eurRange(aggLow, aggHigh).high },
        mean_decision_confidence: meanConf,
        scored_initiatives: scored,
        skipped_initiatives: skipped,
        interpretation: PORTFOLIO_INTERPRETATION,
      };
      if (topByValue) {
        payload.top_initiative_by_value = {
          id: topByValue.id,
          name: topByValue.name,
          classification: topByValue.classification,
          net_value_eur: topByValue.net_value_eur,
        };
      }
      if (highestRisk) {
        payload.highest_risk_initiative = {
          id: highestRisk.id,
          name: highestRisk.name,
          classification: highestRisk.classification,
          reason: highestRisk.reason,
        };
      }
      if (summary.stop > 0 || summary.fix > 0) {
        payload.method_note = methodNoteFor('Fix');
        payload.feedback = feedbackFor('Fix');
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'recommend_improvements') {
      const a = args as any;
      const rec = recommendImprovements(a);
      const feedback = feedbackFor(rec.current_classification, a.industry);
      await recordCall('recommend_improvements', {
        industry: a.industry, function: a.function,
        ai_tier: a.ai_tier, readiness: a.readiness,
        classification: rec.current_classification,
      });
      const payload = {
        bvf_version: BVF_VERSION,
        current_classification: rec.current_classification,
        target_classification: rec.target_classification,
        feasible: rec.feasible,
        recommendations: rec.recommendations,
        projected_decision_confidence: rec.projected_confidence,
        interpretation: {
          projected_decision_confidence: SCORE_INTERPRETATION.decision_confidence,
          target_classification: 'Pillar target conditional on work-architecture readiness and source-evidence review. Re-score the complete case before funding.',
        },
        notes: rec.notes,
        audit: rec.audit,
        ...(rec.change_plan ? { change_plan: rec.change_plan } : {}),
        method_note: methodNoteFor(rec.current_classification),
        ...(feedback ? { feedback } : {}),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'calculate_pace_layer_drag') {
      const a = args as any;
      await recordCall('calculate_pace_layer_drag', {
        industry: a.industry, ai_tier: a.ai_tier, readiness: a.readiness,
      });
      const d = calculatePaceLayerDrag(a);
      const payload = {
        bvf_version: BVF_VERSION,
        annual_drag_eur: eurRange(d.annual_drag_eur_low, d.annual_drag_eur_high),
        drag_rate: { low: d.drag_rate_low, high: d.drag_rate_high },
        pace_gap: d.pace_gap,
        drivers: d.drivers,
        source: d.source,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'validate_portfolio') {
      await recordCall('validate_portfolio');
      const result = validate((args as any).portfolio);
      const payload = { bvf_version: BVF_VERSION, ...result };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'get_benchmark') {
      const { function: fn, industry } = args as any;
      await recordCall('get_benchmark', { industry, function: fn });
      const base = BASE_RATES[fn];
      const mult = (IND_MULT[industry] ?? IND_MULT.universal)[fn];
      const payload = {
        function: fn,
        industry,
        revenue_uplift_range: base.rev,
        cost_takeout_range: base.cost,
        industry_multiplier: mult,
        drivers: base.drivers,
        source: base.source,
        evidence_status: base.evidence_status,
        reviewed_at: base.reviewed_at,
        use_guidance: base.use_guidance,
        external_evidence: BENCHMARK_EVIDENCE_REGISTER,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'list_taxonomy') {
      await recordCall('list_taxonomy');
      const payload = {
        bvf_version: BVF_VERSION,
        industries: INDUSTRIES,
        functions: FUNCTIONS,
        ai_tiers: AI_TIERS,
        readiness: READINESS,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'diagnose_process') {
      const a = args as any;
      const v = diagnoseProcess(a);
      await recordCall('diagnose_process', {
        function: v.function,
        classification: v.verdict,
        confidence: Math.round(v.decision_confidence * 100),
      });
      const payload = {
        bvf_version: BVF_VERSION,
        brain_version: v.brain_version,
        process_id: v.process_id,
        function: v.function,
        baseline_cost_eur: v.baseline_cost_eur,
        heaviness: v.heaviness,
        drag_decomposition: v.drag_decomposition,
        intervention: v.intervention,
        net_saving_eur: { low: v.net_saving_low_eur, high: v.net_saving_high_eur },
        efficiency_gain_pct: v.efficiency_gain_pct,
        verdict: v.verdict,
        decision_confidence: Math.round(v.decision_confidence * 100),
        assumptions: v.assumptions,
        offer_to_execute: v.offer_to_execute,
        evidence_maturity: v.evidence_maturity,
        disclaimer: v.disclaimer,
        method_note: methodNoteFor(v.verdict),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'infer_readiness') {
      const a = args as any;
      const r = inferReadiness(a);
      await recordCall('infer_readiness', { function: a.function, readiness: r.readiness });
      const payload = { bvf_version: BVF_VERSION, ...r };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'sequence_portfolio') {
      const a = args as any;
      const r = sequencePortfolio(a);
      await recordCall('sequence_portfolio', { industry: a.organization?.industry, readiness: a.readiness });
      const payload = { bvf_version: BVF_VERSION, ...r };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'map_to_taxonomy') {
      const a = args as any;
      const r = mapToTaxonomy(a);
      await recordCall('map_to_taxonomy');
      const payload = { bvf_version: BVF_VERSION, ...r };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (name === 'assemble_portfolio') {
      const a = args as any;
      const r = assemblePortfolio(a);
      await recordCall('assemble_portfolio', {
        industry: r.portfolio?.organization?.industry, readiness: r.readiness_used,
      });
      let sourceIndex = 0;
      const portfolio = r.portfolio ? {
        ...r.portfolio,
        initiatives: r.portfolio.initiatives.map((initiative) => {
          // Assembly can skip malformed entries and deduplicate ids. Match retained
          // entries in source order using the same canonical taxonomy.
          const index = a.initiatives.findIndex((raw: any, position: number) => position >= sourceIndex
            && raw?.name === initiative.name
            && typeof raw.function === 'string' && typeof raw.ai_tier === 'string'
            && mapToTaxonomy({ function: raw.function }).function?.resolved === initiative.function
            && mapToTaxonomy({ ai_tier: raw.ai_tier }).ai_tier?.resolved === initiative.ai_tier);
          if (index < 0) throw new InternalFault('Could not retain the source evidence for an assembled initiative.');
          sourceIndex = index + 1;
          const original = a.initiatives[index];
          const estimated = r.estimated_pillars[initiative.id] ?? [];
          return {
            ...initiative,
            pillar_basis: Object.fromEntries(PILLARS.map((pillar) => [pillar, estimated.includes(pillar) ? 'estimated' : 'given'])),
            ...(original.work_architecture !== undefined ? { work_architecture: original.work_architecture } : {}),
            ...(original.signal_completeness !== undefined ? { signal_completeness: original.signal_completeness } : {}),
          };
        }),
      } : null;
      const payload = {
        bvf_version: BVF_VERSION,
        ...r,
        portfolio,
        validation: portfolio ? validate(portfolio) : r.validation,
        guidance: r.guidance.replace(/decision confidence/g, 'decision score') + ' Keep pillar_basis and work_architecture with each initiative when passing the portfolio to scoring.',
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    // A plain Error is the engine or a handler declining an input it will not
    // guess at. Anything else (TypeError, RangeError, InternalFault) is a fault.
    const outcome = isInputRefusal(err) ? 'refused' : 'error';
    if (TOOLS.some(tool => tool.name === name)) await recordCall(name, { outcome, assessment_stage: outcome });
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
};

/** True when telemetry will actually fire; used by the stdio banner. */
export const telemetryEnabled = !TELEMETRY_DISABLED && !!TELEMETRY_DEFAULT_URL && !!TELEMETRY_DEFAULT_KEY;

/**
 * Build a fresh Server wired with the AI BVF tools. A new instance per
 * connection: stdio creates one for the process lifetime, the remote
 * Streamable HTTP endpoint creates one per request (stateless mode).
 */
export function createAibvfServer(options: { entryRoute?: EntryRoute; telemetry?: TelemetryContext } = {}): Server {
  const server = new Server(
    { name: 'io.github.Craig-Horton/aibvf-mcp', title: 'AI BVF', version: VERSION },
    {
      capabilities: { tools: {}, prompts: {} },
      instructions: SERVER_INSTRUCTIONS,
    },
  );
  server.setRequestHandler(ListToolsRequestSchema, LIST_TOOLS_HANDLER);
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: PROMPTS }));
  server.setRequestHandler(GetPromptRequestSchema, async (req: any) => {
    if (req.params?.name !== AGENT_PROMPT.name) throw new Error(`Unknown prompt: ${String(req.params?.name)}. The only prompt is ${AGENT_PROMPT.name}.`);
    return {
      description: AGENT_PROMPT.description,
      messages: [{ role: 'user', content: { type: 'text', text: AGENT_BRIEF } }],
    };
  });
  server.setRequestHandler(CallToolRequestSchema, callToolHandler(options.entryRoute ?? 'unknown', options.telemetry));
  return server;
}
