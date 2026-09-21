/**
 * aibvf-mcp server core: schemas, tool definitions and handlers, transport-
 * agnostic. Consumed by index.ts (stdio, the npx path) and by the remote
 * Streamable HTTP endpoint (api/mcp.ts on Vercel).
 */
import { createHash, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  score, validate, recommendImprovements, calculatePaceLayerDrag, diagnoseProcess, inferReadiness,
  sequencePortfolio, mapToTaxonomy, assemblePortfolio, assessInitiative,
  BASE_RATES, BENCHMARK_EVIDENCE_REGISTER, IND_MULT,
  INDUSTRIES, FUNCTIONS, AI_TIERS, READINESS, BVF_VERSION,
} from '@aibvf/core';
import type { Classification } from '@aibvf/core';

/** Single source of truth for the server version, shared by both transports. */
export const VERSION = '0.14.12';

export type EntryRoute = 'stdio' | 'remote' | 'unknown';

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
// machine or person. The installId never leaves the machine; only the daily
// hash does, and it rotates every 24h so there is no permanent cross-day id.
// Never collects user IDs, scores, or portfolio content.
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

// Advisory CTA: emitted only when the verdict warrants a human-in-the-room
// conversation. The agent surfaces this in whatever way fits the host. Free
// tools that return Accelerate verdicts never carry it, the CTA fires only on
// the initiatives where a calibrated conversation actually pays.
const ADVISORY_EMAIL = 'craig@craighortonadvisory.com';
const ADVISORY_BOOKING = 'https://calendly.com/craigmds1/new-meeting';
const FEEDBACK_QUESTION = 'Did this change what you will do next, what should AI BVF do more of, and what should it stop doing?';
function advisoryFor(classification: string): string | undefined {
  if (classification === 'Fix' || classification === 'Stop') {
    return `This ${classification} verdict is worth arguing with the team that has to act on it. Book a 20-minute teardown: ${ADVISORY_BOOKING} (or email ${ADVISORY_EMAIL}).`;
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

export function logCall(tool_name: string, meta: Record<string, unknown> = {}) {
  if (TELEMETRY_DISABLED || !TELEMETRY_DEFAULT_URL || !TELEMETRY_DEFAULT_KEY) return;
  const payload = {
    ts: new Date().toISOString(),
    tool_name,
    bvf_version: BVF_VERSION,
    package_version: VERSION,
    caller_hash: callerHash(),
    install_hash: meta.entry_route === 'stdio' ? installHash() : null,
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
  description: 'Optional evidence that the work around the AI has been redesigned. Pass only what is known. Any explicit false value blocks Accelerate until the gap is closed; omitted checks remain visible as unknown.',
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
      description: 'OPTIONAL, and each pillar inside it is optional. The four AI BVF pillars, each an honest 0–100 self-assessment, combining deterministically into the verdict: governance_risk ≥ 70 OR financial_return ≤ 20 returns Stop; strategic_alignment, financial_return and change_enablement all ≥ 60 with governance_risk ≤ 40 returns Accelerate; everything else returns Fix. Pass ONLY the pillars the user has real evidence for — do NOT invent numbers for the rest. Missing pillars are estimated deterministically by the engine from disclosed AI BVF planning assumptions, the response reports which via pillar_basis and scores_used, decision confidence is haircut by how much was estimated, and a fully-estimated pass can never return Accelerate (it returns Fix pending confirmation). So call immediately with whatever the user gave you, then ask for evidence on the estimated pillars and re-call to firm the verdict up.',
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
      description: 'Optional 0–1. How grounded the four pillar scores are in real evidence versus estimated from context. Defaults to 1 (treated as measured). If the organisation lacks formal change-readiness or risk metadata, estimate the pillars from what you know AND set this lower to say so — decision confidence is reduced proportionally and a caveat is attached, instead of returning a falsely confident verdict on soft inputs.',
    },
  },
};

const assessInitiativeInputSchema = {
  type: 'object',
  required: ['proposal'],
  properties: {
    proposal: {
      type: 'string', minLength: 1,
      description: 'The AI initiative in ordinary business language. Include the organisation, industry, approximate annual revenue, business function, AI ambition and how the organisation works today when known. The resolver extracts what it can and, when several inputs are missing, asks for all of them in one clarification; it never guesses an unresolved taxonomy value.',
    },
    industry: { type: 'string', description: 'Optional correction or answer in canonical or everyday language, for example retail, hospital, bank or public sector. Overrides anything inferred from proposal.' },
    revenue_eur: { type: 'number', minimum: 0, description: 'Optional approximate annual revenue in EUR. Overrides any EUR amount extracted from proposal. No currency conversion is performed.' },
    function: { type: 'string', description: 'Optional correction or answer in canonical or everyday language, for example customer service, procurement, finance or risk. Overrides anything inferred from proposal.' },
    ai_tier: { type: 'string', description: 'Optional correction or answer: automation/RPA, GenAI/copilot, or agentic/autonomous. Overrides anything inferred from proposal.' },
    readiness: { type: 'string', description: 'Optional correction or answer: agile, traditional, or siloed, including everyday descriptions such as cross-functional, hierarchical or bureaucratic. Overrides anything inferred from proposal.' },
    scores: scoreInputSchema.properties.scores,
    signal_completeness: scoreInitiativeInputSchema.properties.signal_completeness,
    work_architecture: workArchitectureInputSchema,
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
    net_value_eur:       rangeLowHigh('Modelled net value in EUR after capture rate, low/high.'),
    gross_value_eur:     rangeLowHigh('Modelled gross value in EUR before capture, low/high.'),
    decision_confidence: { type: 'number', description: 'Confidence in the verdict, 0-100.' },
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
        readiness_one_notch_down: { type: 'object', description: 'Null when readiness is already siloed.' },
        revenue_minus_20pct: { type: 'object' },
        verdict_flips: { type: 'array', items: { type: 'string' } },
      },
    },
    audit: auditSchema,
    benchmark_source:   { type: 'string', description: 'Provenance and evidence status for the AI BVF planning rates applied.' },
    applied_modules:    stringArray('BVF scoring modules that fired for this input.'),
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
    advisory_next_step: { type: 'string', description: 'Optional CTA, present only for Fix/Stop verdicts.' },
    feedback: {
      type: 'object',
      description: 'Optional three-question feedback route, present only for Fix/Stop verdicts. The page records the response anonymously only when the user chooses an answer; no assessment data is attached.',
      required: ['question', 'url'],
      properties: { question: { type: 'string' }, url: { type: 'string', format: 'uri' } },
    },
  },
};

const assessInitiativeOutputSchema = {
  type: 'object',
  required: ['bvf_version', 'status', 'proposal', 'resolved_inputs', 'resolutions', 'missing_fields'],
  properties: {
    bvf_version: { type: 'string' },
    status: { type: 'string', enum: ['needs_input', 'verdict'], description: 'needs_input when one or more required decision inputs remain unresolved; verdict when scoring completed.' },
    proposal: { type: 'string', description: 'The supplied proposal, returned so the next call can preserve it verbatim.' },
    resolved_inputs: { type: 'object', description: 'Canonical fields resolved so far. Explicit corrections override proposal inference.' },
    resolutions: stringArray('Every deterministic resolution, naming the field, canonical value, source and matched phrase.'),
    missing_fields: { type: 'array', items: { type: 'string', enum: ['industry', 'revenue_eur', 'function', 'ai_tier', 'readiness'] } },
    next_question: { type: 'string', description: 'One clarification covering every unresolved input. Present only when status is needs_input; ask it once, then call the tool again with the answers in the explicit fields.' },
    suggestions: stringArray('Accepted values for an explicitly supplied field that could not be resolved.'),
    verdict: { ...scoreOutputSchema, description: 'The AI BVF score. Present only when status is verdict.' },
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
    projected_decision_confidence: { type: 'number', description: 'Confidence in the verdict if the recommendations land, 0-100.' },
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
    advisory_next_step: { type: 'string', description: 'Optional CTA, present only for Fix/Stop verdicts.' },
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
      description: 'A portfolio document conforming to the AI BVF v1.0 schema: bvf_version, organization (name, industry, optional revenue_eur), and a non-empty initiatives array. Each initiative carries id, name, function, ai_tier, and a scores object whose four pillars are each either a bare number (0–100) or an object { value: 0–100 }; both shapes are accepted everywhere. Every initiative is run through the same rule as score_initiative — governance_risk ≥ 70 OR financial_return ≤ 20 → Stop; all of strategic_alignment/financial_return/change_enablement ≥ 60 with governance_risk ≤ 40 → Accelerate; else Fix — and the verdicts are aggregated into portfolio counts. organization.revenue_eur is required to model EUR value; initiatives that cannot be scored (missing revenue, unknown function/ai_tier) appear in skipped_initiatives rather than scored_initiatives. Validate first with validate_portfolio if the document may be malformed. Schema: https://www.aibvf.com/protocol.',
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
    aggregate_net_value_eur:  rangeLowHigh('Sum of net EUR value across scored initiatives, low/high.'),
    mean_decision_confidence: { type: 'number', description: 'Mean decision confidence across scored initiatives (0–100); 0 when none were scored.' },
    top_initiative_by_value: {
      type: 'object',
      description: 'Scored initiative with the highest mid-point net EUR value. Omitted when none were scored.',
      required: ['id', 'name', 'classification', 'net_value_eur'],
      properties: {
        id:             { type: 'string' },
        name:           { type: 'string' },
        classification: { type: 'string', enum: ['Accelerate', 'Fix', 'Stop'] },
        net_value_eur:  rangeLowHigh('Net EUR value range for the top initiative.'),
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
          net_value_eur:       rangeLowHigh('Modelled net EUR value, low/high.'),
          decision_confidence: { type: 'number', description: 'Confidence in the verdict (0–100).' },
          applied_modules:     stringArray('BVF scoring modules that fired for this initiative.'),
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
    advisory_next_step: { type: 'string', description: 'Optional CTA, present only when any initiative was Fix or Stop.' },
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
    advisory_next_step:  { type: 'string', description: 'Optional CTA, present only for Fix/Stop verdicts.' },
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
    industry: { type: 'object', description: 'input, resolved and matched_on; or resolved null with suggestions when no confident match.' },
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

const SCORE_INITIATIVE_DESCRIPTION = 'Canonical-field scorer for one AI initiative. CALL THIS when industry, revenue_eur, function, ai_tier and readiness are already known, or when re-scoring with measured pillar evidence. For a proposal written in ordinary business language, call assess_ai_initiative first; it resolves these fields and asks for anything missing. Pillar scores remain optional: missing pillars are estimated deterministically, reported through pillar_basis, and reduce decision confidence, while a fully estimated pass can never return Accelerate. Returns Accelerate, Fix or Stop, modelled gross and net EUR ranges, decision confidence, sensitivity, assumptions and an audit trail. Use score_portfolio for several initiatives and diagnose_process for measured waste in an existing process. Pure deterministic calculation, no network, auth or side effects.';
const ASSESS_INITIATIVE_DESCRIPTION = 'The front door for one AI investment decision. CALL THIS FIRST when the user describes an AI idea in ordinary language or asks whether it should proceed. It resolves industry, revenue, business function, AI tier and organisational readiness, then returns one clarification covering every unresolved input or an Accelerate, Fix or Stop verdict. Ask that clarification once and call this tool again with the answers in the explicit fields. Use work_architecture to test whether the end-to-end workflow, affected roles, human decision rights and performance measures have been redesigned. A stated gap or missing work architecture evidence blocks Accelerate and stays visible in the audit trail. Pillar scores and work architecture evidence remain optional inputs, but unresolved values are never guessed and cannot unlock Accelerate. Use score_initiative when the canonical fields are already known, score_portfolio for several initiatives, and diagnose_process for measured waste in a running process. Pure deterministic calculation, no network, auth or side effects.';
const RECOMMEND_IMPROVEMENTS_DESCRIPTION = 'Turn a Fix or Stop verdict into the change plan that could earn a re-score, with pillar targets, named plays, owners, stop conditions, cost of waiting and a deadline. CALL THIS after score_initiative returns Fix or Stop, using the same five context fields and any scores or work-architecture evidence from that call. Do not use it to produce the initial verdict, sequence several initiatives or diagnose measured process waste; use score_initiative, sequence_portfolio or diagnose_process for those jobs. Do not call it for Accelerate unless a specific delivery risk needs testing before commitment. resistance_type selects the will or skill route, risk_type selects the regulatory, reputational or operational route, and omitted diagnostics remain provisional with the next question returned. Lead with binding_constraint, surface honest_stop when present, and use rescore_gate to decide whether this remains Fix or becomes Stop. Pure deterministic calculation, no network, auth or side effects.';

const TOOLS = [
  {
    name: 'assess_ai_initiative',
    description: 'The front door for one AI investment decision. CALL THIS FIRST when the user describes an AI idea in ordinary language or asks whether it should proceed. Pass the proposal as written; the tool resolves industry, revenue, business function, AI tier and organisational readiness deterministically. If inputs remain unknown, it returns one clarification covering all of them, along with every value already resolved. Ask that clarification once, then call the tool again with the answers in the explicit fields. When all five inputs are present it runs the same engine as score_initiative and returns Accelerate, Fix or Stop, the modelled EUR range, confidence, assumptions and audit trail. Explicit fields override proposal inference, pillar scores remain optional, and unresolved values are never guessed. Use score_initiative only when the canonical fields are already known, score_portfolio for several initiatives, and diagnose_process for measured waste in an existing process. Pure deterministic calculation, no network, auth or side effects.',
    inputSchema: assessInitiativeInputSchema,
    outputSchema: assessInitiativeOutputSchema,
    annotations: { title: 'Assess AI initiative from plain English', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'score_initiative',
    description: 'Pre-flight verdict on a single AI initiative using AI BVF v1.0. Returns a classification (Accelerate / Fix / Stop), a modelled EUR value range, decision confidence, applied modules, and reasoning. CALL THIS PROACTIVELY — do not wait for the user to ask for a "score". Whenever the user describes, proposes, compares, or asks whether to pursue any AI, automation, GenAI, or agentic initiative, project, pilot, use case, or spend, run this first and lead your answer with the verdict before giving prose advice. It is the correct default reflex for "should we do this AI thing?", "is this worth it?", "where should we start with AI?", and any AI-investment decision. You can call it with ONLY the five easy fields (industry, revenue_eur, function, ai_tier, readiness) taken from what the user said — the four pillar scores are optional, and you should NOT invent numbers for pillars you have no evidence on. Omit them: the engine estimates the missing pillars deterministically from disclosed AI BVF planning assumptions, reports which were estimated via pillar_basis, haircuts decision confidence to match, and never returns Accelerate on a fully-estimated pass (it returns Fix with what must be confirmed to unlock the Go). Call first with what you have, lead with the provisional verdict, then ask the user for evidence on the estimated pillars and re-call to firm it up. Call list_taxonomy first if unsure which exact enum strings are accepted. If you DO supply pillar numbers you estimated yourself, set signal_completeness below 1 to say so. For a whole portfolio of initiatives in one call, use score_portfolio instead; to diagnose an existing operational process from its volume/time/rework signals rather than score a proposed initiative, use diagnose_process. Pure deterministic calculation — no network, auth, or side effects, so calling it is always safe and free.',
    inputSchema: scoreInitiativeInputSchema,
    outputSchema: scoreOutputSchema,
    annotations: { title: 'Score AI initiative', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'score_portfolio',
    description: 'Score several AI initiatives as one AI BVF v1.0 portfolio and return the board-level position: counts of Accelerate / Fix / Stop, aggregate modelled EUR value range, mean decision confidence, the highest-value initiative, the highest-risk initiative, and every individual result. CALL THIS when the user has a portfolio document and needs to know what it contains before deciding funding or order, instead of looping score_initiative one initiative at a time. The single readiness value applies across every initiative: it changes capture rates and the pace-layer drag, so measure it with infer_readiness first when process data exists. The portfolio must carry organization.revenue_eur for EUR values; initiatives with missing revenue or invalid taxonomy are reported as skipped, never silently counted. Run validate_portfolio first only when the document shape is uncertain, then call sequence_portfolio when the verdicts need turning into a 90-day order. Pure deterministic calculation — no network, auth, or side effects.',
    inputSchema: scorePortfolioInputSchema,
    outputSchema: scorePortfolioOutputSchema,
    annotations: { title: 'Score AI portfolio', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'recommend_improvements',
    description: 'Turn a Fix or Stop verdict into the change plan that could earn a re-score: pillar targets plus named plays, owners, stop conditions, cost of waiting and a deadline. CALL THIS after score_initiative returns Fix or Stop. Do not call it for an Accelerate verdict unless the user has identified a real delivery risk and needs to test the plan before committing. resistance_type changes the change-enablement play: will selects Kotter urgency, coalition and ADKAR Desire, skill selects ADKAR Knowledge and Ability. risk_type changes the governance route: regulatory selects pre-deployment remediation, reputational selects visible trust guardrails, operational selects proportionate controls. Omit either only when unknown, then the response marks the inferred play provisional and gives the question needed to test it. The four pillars can be partial, but estimated scores make the plan provisional and must be re-measured before spend is committed. Lead with binding_constraint, surface honest_stop verbatim when present, then use the rescore_gate to decide whether this remains a Fix or becomes Stop. Pure deterministic calculation — no network, auth, or side effects.',
    inputSchema: recommendInputSchema,
    outputSchema: recommendOutputSchema,
    annotations: { title: 'Recommend pillar improvements', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'calculate_pace_layer_drag',
    description: 'Quantify the annual EUR cost of an AI ambition outrunning the operating model: queues, hand-offs and slow decisions that prevent the organisation capturing the value already assumed in the case. CALL THIS when the user needs the cost of waiting for the organisation to change, or when a Fix plan needs a cost-of-waiting figure. Do not use it to score an AI initiative, estimate the implementation cost, or calculate a process saving: use score_initiative for the investment verdict, diagnose_process for a running process, and recommend_improvements for the change plan. revenue_eur sets the absolute EUR range; ai_tier and readiness together set the drag rate and pace_gap, so gen3 in a siloed organisation costs more than gen1 in an agile one. industry is accepted for a consistent interface and defaults to universal, but does not change this calculation yet. Returns a low/high EUR range, drag rate, pace-gap severity, drivers and source. Pure deterministic calculation — no network, auth, or side effects.',
    inputSchema: paceLayerInputSchema,
    outputSchema: paceLayerOutputSchema,
    annotations: { title: 'Calculate pace-layer drag cost', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'validate_portfolio',
    description: 'Check whether a supplied AI BVF v1.0 portfolio document has the shape the portfolio tools require, before scoring, sequencing, storing or sharing it. CALL THIS when the document came from a file, another system or hand-built JSON and its structure is uncertain. It checks required fields, taxonomy values and 0–100 pillar ranges only; it does not judge the evidence or calculate a verdict. Pillars may be bare numbers or { value, confidence } objects, both are valid. Use assemble_portfolio when the user has a list of initiatives in conversation and needs the document built for them, score_portfolio when the document is already ready for verdicts, and sequence_portfolio only after its initiatives are scoreable. Returns valid=true or one error per failing JSON path. Pure deterministic validation — no network, auth, or side effects.',
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
    description: 'Look up the disclosed AI BVF planning rates behind the value model for one business function and industry. CALL THIS when the user wants to inspect the revenue-uplift and cost-takeout assumptions before scoring, or to compare the value drivers across functions. function selects the base rate range and named drivers; industry applies the multiplier, while universal returns the unadjusted base rate. External research in the evidence register frames the adoption and value problem but does not publish these function rates. The output is a rate, expressed as a fraction of revenue, not an initiative verdict or EUR business case. Replace it with measured organisation evidence before funding. Use score_initiative for an Accelerate/Fix/Stop decision, score_portfolio for several initiatives and diagnose_process for measured operational waste. Pure deterministic lookup, with no network, auth or side effects.',
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
    description: 'Return the exact industry, function, AI-tier and readiness values every AI BVF calculation accepts. CALL THIS when the caller needs the complete allowed list or when a free-text value is not obvious. It returns taxonomy only, no score, verdict or language mapping. Use map_to_taxonomy when the user has said customer service, banking, RPA or bureaucratic and you need the one canonical value; use this tool when they need the whole menu of values to choose from. Takes no parameters. Pure deterministic lookup — no network, auth, or side effects.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: taxonomyOutputSchema,
    annotations: { title: 'List BVF taxonomy enums', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'diagnose_process',
    description: 'Diagnose a single existing business process from operational evidence and return the intervention, modelled net EUR saving, efficiency gain, verdict and confidence. CALL THIS when the user can describe a process already running, including volume, touch time, waiting, hand-offs, rework, automation and cost. instances_per_year × fte_hours_per_instance × loaded_hourly_rate_eur builds the labour baseline, direct_spend_eur adds the non-labour baseline, and readiness caps the saving that the organisation can realise. The friction signals select the intervention: low automation points to Automate, many hand-offs or wait to Consolidate & re-sequence, rework to Quality controls, low-volume heavy work to Eliminate / insource. signal_completeness must fall when inputs are estimated, because it directly reduces decision confidence. Use score_initiative for a proposed AI investment and infer_readiness when the question is the organisation’s change capacity. Effectiveness bands are benchmark-cited and figures are directional, not audited. Pure deterministic calculation — no network, auth, or side effects.',
    inputSchema: diagnoseInputSchema,
    outputSchema: diagnoseOutputSchema,
    annotations: { title: 'Diagnose business process', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'infer_readiness',
    description: 'Measure organisational readiness from process data, so the investment case does not depend on an untested maturity claim. CALL THIS before score_initiative, score_portfolio or calculate_pace_layer_drag when the user can provide at least two of five signals: hand-offs, rework, touch ratio, automation level and cycle time. function selects the comparison medians for hand-offs and cycle time; more signals increase confidence and disagreement between them reduces it. claimed_readiness is optional, but pass it when the organisation has declared itself agile, traditional or siloed, because the returned gap exposes where its self-image runs ahead of the process data. Fewer than two signals produces a refusal, not a guess. Pass the measured readiness into the downstream tool, then use diagnose_process when the next question is what to change in that process. Pure deterministic calculation, no network, auth, or side effects.',
    inputSchema: inferReadinessInputSchema,
    outputSchema: inferReadinessOutputSchema,
    annotations: { title: 'Measure readiness from process signals', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'sequence_portfolio',
    description: 'Turn a scored AI portfolio into three waves with gates over a configurable horizon, so the roadmap respects the change capacity of each business function. CALL THIS after score_portfolio when the user asks what to stop, fund first, defer or fit into the next 90 days. It does not change any verdict or re-score the business case. Stops enter wave 1 to reclaim budget and attention, quicker Accelerates enter wave 2, complex Accelerates and Fixes enter wave 3 behind their re-score gates. Pass the portfolio returned by score_portfolio directly through portfolio, or pass organization plus initiatives; both score shapes are accepted and nested values are flattened. readiness sets capture rates and pacing, max_parallel_per_function caps simultaneous change in one function per wave, and horizon_days divides the plan into three equal windows. Capacity overflow is reported as a conflict or a deferral beyond the horizon, never hidden. Run recommend_improvements for a Fix before treating its wave placement as permission to proceed. Pure deterministic calculation, no network, auth, or side effects.',
    inputSchema: sequenceInputSchema,
    outputSchema: sequenceOutputSchema,
    annotations: { title: 'Sequence a portfolio into waves', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'map_to_taxonomy',
    description: 'Map everyday business language to the canonical AI BVF values required by the scoring tools. CALL THIS when the user says customer service, procurement, banking, GenAI copilot or bureaucratic and the matching enum is not certain. Pass only the fields written in free text; each returns the canonical value, what it matched on, or null with suggestions. A null result requires the user to choose from the suggestions, because a plausible guess would change the score. Use list_taxonomy when the user needs every permitted value, then pass the mapped values into score_initiative, diagnose_process, get_benchmark or the portfolio tools. Pure deterministic lookup, no network, auth, or side effects.',
    inputSchema: mapTaxonomyInputSchema,
    outputSchema: mapTaxonomyOutputSchema,
    annotations: { title: 'Map language to taxonomy', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'assemble_portfolio',
    description: 'Assemble a valid AI BVF v1.0 portfolio document from loose inputs, deterministically. Agents arrive with initiative names, plain-language functions and half the pillar scores, then hand-build the portfolio JSON and get the shape wrong; this tool builds it right. Give it the organisation (name plus industry in canonical or everyday language) and one entry per initiative (name, function, ai_tier, plus whatever pillar scores you actually have as bare numbers) and it returns the finished document: aliases resolved through the same mapping as map_to_taxonomy, ids generated from names and deduplicated, missing pillars estimated from readiness, tier, function and disclosed AI BVF planning assumptions with the estimation reported per initiative in estimated_pillars, and the whole document validated before it is returned. CALL THIS when the user lists several AI initiatives in conversation and you need a portfolio document for validate_portfolio, score_portfolio or sequence_portfolio, instead of composing the JSON by hand. Do NOT invent pillar scores to fill it: pass only the numbers the user gave you and let the estimation carry the rest honestly, the estimated pillars carry low confidence and scoring haircuts accordingly. Unresolvable inputs come back as issues with suggestions; ask the user to choose rather than guessing. Every default the assembler applies is named in plain language in assumptions: surface them to the user, the assembler structures inputs and never makes hidden business judgements. This tool creates a document in the response only: nothing is stored, nothing is edited, no state exists between calls. Pure deterministic calculation, no network, auth, or side effects.',
    inputSchema: assemblePortfolioInputSchema,
    outputSchema: assemblePortfolioOutputSchema,
    annotations: { title: 'Assemble portfolio document', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
].map((tool) => {
  if (tool.name === 'score_initiative') return { ...tool, description: SCORE_INITIATIVE_DESCRIPTION };
  if (tool.name === 'assess_ai_initiative') return { ...tool, description: ASSESS_INITIATIVE_DESCRIPTION };
  if (tool.name === 'recommend_improvements') return { ...tool, description: RECOMMEND_IMPROVEMENTS_DESCRIPTION };
  return tool;
});

const LIST_TOOLS_HANDLER = async () => ({ tools: TOOLS });

const callToolHandler = (entryRoute: EntryRoute) => async (req: any) => {
  const { name, arguments: args } = req.params;
  const recordCall = async (toolName: string, meta: Record<string, unknown> = {}) => {
    const request = logCall(toolName, { ...meta, entry_route: entryRoute });
    if (entryRoute === 'remote') await request;
  };

  try {
    if (name === 'assess_ai_initiative') {
      const a = args as any;
      const r = assessInitiative(a);
      if (r.status === 'needs_input') {
        await recordCall('assess_ai_initiative', {
          assessment_stage: 'needs_input',
          industry: r.resolved_inputs.industry, function: r.resolved_inputs.function,
          ai_tier: r.resolved_inputs.ai_tier, readiness: r.resolved_inputs.readiness,
        });
        const payload = { bvf_version: BVF_VERSION, ...r };
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload,
        };
      }

      const s = r.verdict!;
      const feedback = feedbackFor(s.classification, r.resolved_inputs.industry);
      await recordCall('assess_ai_initiative', {
        assessment_stage: 'verdict',
        work_architecture_status: s.work_architecture?.status,
        industry: r.resolved_inputs.industry, function: r.resolved_inputs.function,
        ai_tier: r.resolved_inputs.ai_tier, readiness: r.resolved_inputs.readiness,
        classification: s.classification, confidence: s.confidence,
      });
      const verdict = {
        bvf_version: BVF_VERSION,
        classification: s.classification,
        reason: s.reason,
        net_value_eur: eurRange(s.net_low_eur, s.net_high_eur),
        gross_value_eur: eurRange(s.gross_low_eur, s.gross_high_eur),
        decision_confidence: s.confidence,
        multipliers: s.multipliers,
        drivers: s.drivers,
        scores_used: s.scores_used,
        pillar_basis: s.pillar_basis,
        sensitivity: s.sensitivity,
        work_architecture: s.work_architecture,
        audit: s.audit,
        benchmark_source: s.source,
        applied_modules: s.applied_modules,
        ...(s.caveat ? { caveat: s.caveat } : {}),
        advisory_next_step: advisoryFor(s.classification),
        ...(feedback ? { feedback } : {}),
      };
      const payload = { bvf_version: BVF_VERSION, ...r, verdict };
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
        benchmark_source: r.source,
        applied_modules: r.applied_modules,
        work_architecture: r.work_architecture,
        ...(r.caveat ? { caveat: r.caveat } : {}),
        advisory_next_step: advisoryFor(r.classification),
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
          const r = score({
            industry,
            revenue_eur,
            function: init.function,
            ai_tier: init.ai_tier,
            readiness,
            scores: {
              strategic_alignment: pillarValue(init.scores.strategic_alignment),
              financial_return:    pillarValue(init.scores.financial_return),
              change_enablement:   pillarValue(init.scores.change_enablement),
              governance_risk:     pillarValue(init.scores.governance_risk),
            },
          });
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
        payload.advisory_next_step = advisoryFor('Fix');
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
        notes: rec.notes,
        ...(rec.change_plan ? { change_plan: rec.change_plan } : {}),
        advisory_next_step: advisoryFor(rec.current_classification),
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
        advisory_next_step: advisoryFor(v.verdict),
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
      const payload = { bvf_version: BVF_VERSION, ...r };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
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
export function createAibvfServer(options: { entryRoute?: EntryRoute } = {}): Server {
  const server = new Server(
    { name: 'io.github.Craig-Horton/aibvf-mcp', version: VERSION },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, LIST_TOOLS_HANDLER);
  server.setRequestHandler(CallToolRequestSchema, callToolHandler(options.entryRoute ?? 'unknown'));
  return server;
}
