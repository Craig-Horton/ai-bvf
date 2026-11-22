/**
 * The link to the one-page brief for an assessed initiative.
 *
 * The result travels inside the link, after the # sign, which browsers never
 * send to a server. Nothing is stored. The page at the other end rebuilds the
 * verdict from the context and the answers with this same engine, so the
 * brief cannot say anything the engine would not.
 */
import type {
  AssessAnsweredBy, AssessChoiceId, AssessEvidence, AssessFunding, AssessInitiativeInput, AssessInitiativeResult,
  AssessQuestionId, Classification, PillarScores,
} from './types.js';
import { fundingRecord } from './funding.js';

export const BRIEF_BASE = 'https://www.aibvf.com/verdict';
const QUESTIONS: AssessQuestionId[] = ['financial_return', 'governance_risk', 'strategic_alignment', 'change_enablement', 'work_architecture'];
const MAX_LINK = 12000;

export interface BriefLinkInput {
  context: { industry: string; function: string; ai_tier: string; employees: number };
  answers: Partial<Record<AssessQuestionId, AssessChoiceId>>;
  /** The date of the assessment, written YYYY-MM-DD. */
  date: string;
  /** The wording of the proposal. Leave it out unless the owner says it may travel. */
  proposal?: string;
  /** Without the proposal: the words that contradicted an answer, so the brief reaches the same verdict. */
  contradiction_words?: string[];
  answered_by?: AssessAnsweredBy;
  /** Evidence mode: the quotes and sources behind each answer. They travel in the link so the brief can show them. */
  evidence?: Partial<Record<AssessQuestionId, AssessEvidence[]>>;
  /**
   * Evidence mode: answers on which two records disagree, with the answer the
   * first record supports and both sets of quotes. Each travels as not known.
   */
  conflicts?: Partial<Record<AssessQuestionId, BriefConflict>>;
  /** At a return visit: the earlier verdict, its date, the answers as they stood then, and the changes that moved the verdict. */
  previous?: BriefPrevious;
  /** The funding record: the ask, the alternative and the agreed results, so a return visit can set results beside them. */
  funding?: AssessFunding;
  /** False to leave the quotes behind the funding figures out of the link, when it would be too long with them. */
  funding_quotes?: boolean;
  /** The page that opens the brief. Defaults to the public one. */
  base?: string;
}

const pair = (evidence: AssessEvidence | undefined, keep: boolean): [string, string] | 0 =>
  (evidence && keep ? [evidence.quote.slice(0, 200), evidence.source.slice(0, 120)] : 0);
const unpair = (given: unknown): AssessEvidence | undefined =>
  (Array.isArray(given) && typeof given[0] === 'string' && typeof given[1] === 'string' ? { quote: given[0].slice(0, 400), source: given[1].slice(0, 160) } : undefined);

/** The funding record in its short form for the link. A result is one row: what is measured, the agreement, today's figure and the result. */
function packFunding(funding: AssessFunding, quotes: boolean): Record<string, unknown> {
  return {
    ...(funding.stage ? { s: funding.stage === 'pilot' ? 'p' : 'r' } : {}),
    ...(funding.ask ? { k: [funding.ask.amount_eur, pair(funding.ask.evidence, quotes)] } : {}),
    ...(funding.alternative ? { l: [funding.alternative.description.slice(0, 200), funding.alternative.amount_eur ?? null, pair(funding.alternative.evidence, quotes)] } : {}),
    t: funding.thresholds.slice(0, 3).map((item) => [
      item.measure.slice(0, 80), item.unit ?? '', item.direction === 'at_most' ? 'm' : 'l', item.target,
      item.baseline ?? null, item.baseline_kind === 'measured' ? 'm' : 'e', pair(item.evidence, quotes),
      item.result ?? null, item.result_kind === 'measured' ? 'm' : 'e', pair(item.result_evidence, quotes),
    ]),
    ...(funding.decision ? { d: funding.decision } : {}),
  };
}

/** Reads the short form back and has the engine rebuild the record, so the brief says only what the engine would. */
function unpackFunding(given: unknown, agreedOn?: string): AssessFunding | undefined {
  if (!given || typeof given !== 'object') return undefined;
  const u = given as Record<string, unknown>;
  const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
  const rows = (Array.isArray(u.t) ? u.t : []).filter((row): row is unknown[] => Array.isArray(row) && typeof row[0] === 'string' && num(row[3]) !== undefined).slice(0, 3);
  try {
    const agreed = fundingRecord({
      ...(u.s === 'p' ? { stage: 'pilot' as const } : u.s === 'r' ? { stage: 'rollout' as const } : {}),
      ...(Array.isArray(u.k) && num(u.k[0]) !== undefined ? { ask: { amount_eur: num(u.k[0]), evidence: unpair(u.k[1]) } } : {}),
      ...(Array.isArray(u.l) && typeof u.l[0] === 'string' ? { alternative: { description: u.l[0], amount_eur: num(u.l[1]), evidence: unpair(u.l[2]) } } : {}),
      thresholds: rows.map((row) => ({
        measure: row[0] as string, unit: typeof row[1] === 'string' ? row[1] : undefined, direction: row[2] === 'l' ? 'at_least' as const : 'at_most' as const,
        target: row[3] as number, baseline: num(row[4]), baseline_kind: row[5] === 'm' ? 'measured' as const : 'estimate' as const, evidence: unpair(row[6]),
      })),
      results: rows.filter((row) => num(row[7]) !== undefined).map((row) => ({
        measure: row[0] as string, value: row[7] as number, kind: row[8] === 'm' ? 'measured' as const : 'estimate' as const, evidence: unpair(row[9]),
      })),
      ...(u.d === 'released' || u.d === 'deferred' || u.d === 'withdrew' ? { decision: u.d } : {}),
    // A link whose quotes were left out still carries its figures: they are read as given.
    }, false, undefined, agreedOn);
    return agreed;
  } catch {
    return undefined;
  }
}

export interface BriefConflict {
  choice: Exclude<AssessChoiceId, 'unknown'>;
  evidence: AssessEvidence[];
  against: AssessEvidence[];
}

export interface BriefPrevious {
  verdict: Classification;
  /** Written YYYY-MM-DD. */
  date: string;
  answers: Partial<Record<AssessQuestionId, AssessChoiceId | 'unanswered'>>;
  moved: AssessQuestionId[];
}

const CHOICES = ['a', 'b', 'c', 'd', 'unknown'];
const VERDICTS = ['Accelerate', 'Fix', 'Stop'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const pairs = (items: AssessEvidence[], most: number): [string, string][] =>
  items.slice(0, most).map((item) => [item.quote.slice(0, 400), item.source.slice(0, 160)]);

export function briefUrl(input: BriefLinkInput): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('date must be written as YYYY-MM-DD.');
  const answers: Partial<Record<AssessQuestionId, AssessChoiceId>> = {};
  for (const id of QUESTIONS) if (input.answers[id]) answers[id] = input.answers[id];
  const payload: Record<string, unknown> = {
    v: 1,
    c: { i: input.context.industry, f: input.context.function, t: input.context.ai_tier, e: Math.round(input.context.employees) },
    a: answers,
    d: input.date,
  };
  if (input.proposal) payload.p = input.proposal.slice(0, 2000);
  else if (input.contradiction_words?.length) payload.w = input.contradiction_words.slice(0, 5).map((words) => words.slice(0, 120));
  if (input.answered_by === 'evidence') {
    const quotes: Partial<Record<AssessQuestionId, [string, string][]>> = {};
    for (const id of QUESTIONS) {
      const items = input.evidence?.[id];
      if (items?.length && answers[id] && answers[id] !== 'unknown') {
        quotes[id] = items.slice(0, 3).map((item) => [item.quote.slice(0, 400), item.source.slice(0, 160)]);
      }
    }
    payload.b = 'e';
    payload.q = quotes;
    // A conflicted answer travels as not known, with both sets of quotes beside it.
    const conflicts: Record<string, { c: string; f: [string, string][]; g: [string, string][] }> = {};
    for (const id of QUESTIONS) {
      const item = input.conflicts?.[id];
      if (!item || !item.evidence.length || !item.against.length) continue;
      answers[id] = 'unknown';
      delete quotes[id];
      conflicts[id] = { c: item.choice, f: pairs(item.evidence, 2), g: pairs(item.against, 2) };
    }
    if (Object.keys(conflicts).length) payload.x = conflicts;
  }
  if (input.previous) {
    const then: Partial<Record<AssessQuestionId, string>> = {};
    for (const id of QUESTIONS) if (input.previous.answers[id]) then[id] = input.previous.answers[id];
    payload.r = { v: input.previous.verdict, d: input.previous.date, a: then, m: input.previous.moved.filter((id) => QUESTIONS.includes(id)) };
  }
  if (input.funding) payload.u = packFunding(input.funding, input.funding_quotes !== false);
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (encoded.length > MAX_LINK) throw new Error('The brief link is too long. Leave the proposal out or shorten it.');
  return `${input.base ?? BRIEF_BASE}#${encoded}`;
}

/**
 * Reads a brief link back into what it carries, or nothing when the text is
 * not a brief link. Takes the whole link or only the part after the # sign.
 */
export function readBriefLink(link: string): BriefLinkInput | undefined {
  if (typeof link !== 'string') return undefined;
  const raw = link.includes('#') ? link.slice(link.indexOf('#') + 1) : link.trim();
  if (!raw || raw.length > MAX_LINK || !/^[A-Za-z0-9_-]+$/.test(raw)) return undefined;
  let data: Record<string, unknown>;
  try {
    const bytes = Uint8Array.from(atob(raw.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
  const c = data?.c as Record<string, unknown> | undefined;
  if (!data || data.v !== 1 || !c || typeof data.a !== 'object' || data.a === null) return undefined;
  if (typeof c.i !== 'string' || typeof c.f !== 'string' || typeof c.t !== 'string' || typeof c.e !== 'number' || !(c.e >= 1)) return undefined;
  if (typeof data.d !== 'string' || !DATE.test(data.d)) return undefined;

  const answers: Partial<Record<AssessQuestionId, AssessChoiceId>> = {};
  for (const id of QUESTIONS) {
    const choice = (data.a as Record<string, unknown>)[id];
    if (typeof choice === 'string' && CHOICES.includes(choice)) answers[id] = choice as AssessChoiceId;
  }
  const quoted = (given: unknown): AssessEvidence[] => (Array.isArray(given) ? given : [])
    .filter((pair): pair is [string, string] => Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string')
    .slice(0, 3).map(([quote, source]) => ({ quote: quote.slice(0, 400), source: source.slice(0, 160) }));

  const brief: BriefLinkInput = {
    context: { industry: c.i, function: c.f, ai_tier: c.t, employees: Math.round(c.e) },
    answers, date: data.d,
  };
  if (typeof data.p === 'string' && data.p.trim()) brief.proposal = data.p.slice(0, 2000);
  else if (Array.isArray(data.w)) brief.contradiction_words = data.w.filter((w): w is string => typeof w === 'string').slice(0, 5).map((w) => w.slice(0, 120));
  if (data.b === 'e') {
    brief.answered_by = 'evidence';
    const evidence: Partial<Record<AssessQuestionId, AssessEvidence[]>> = {};
    const conflicts: Partial<Record<AssessQuestionId, BriefConflict>> = {};
    for (const id of QUESTIONS) {
      const items = quoted((data.q as Record<string, unknown> | undefined)?.[id]);
      if (items.length) evidence[id] = items;
      const held = (data.x as Record<string, Record<string, unknown>> | undefined)?.[id];
      const choice = held?.c;
      const supports = quoted(held?.f);
      const against = quoted(held?.g);
      if (typeof choice === 'string' && ['a', 'b', 'c', 'd'].includes(choice) && supports.length && against.length) {
        conflicts[id] = { choice: choice as BriefConflict['choice'], evidence: supports, against };
      }
    }
    brief.evidence = evidence;
    if (Object.keys(conflicts).length) brief.conflicts = conflicts;
  }
  const r = data.r as Record<string, unknown> | undefined;
  if (r && typeof r.v === 'string' && VERDICTS.includes(r.v) && typeof r.d === 'string' && DATE.test(r.d) && typeof r.a === 'object' && r.a !== null) {
    const then: BriefPrevious['answers'] = {};
    for (const id of QUESTIONS) {
      const choice = (r.a as Record<string, unknown>)[id];
      if (typeof choice === 'string' && [...CHOICES, 'unanswered'].includes(choice)) then[id] = choice as AssessChoiceId | 'unanswered';
    }
    brief.previous = {
      verdict: r.v as Classification, date: r.d, answers: then,
      moved: (Array.isArray(r.m) ? r.m : []).filter((id): id is AssessQuestionId => QUESTIONS.includes(id as AssessQuestionId)),
    };
  }
  const funding = unpackFunding(data.u, brief.previous?.date);
  if (funding) brief.funding = funding;
  return brief;
}

/** What to pass to the engine to rebuild the verdict a brief link carries. */
export function assessInputFromBrief(brief: BriefLinkInput): AssessInitiativeInput {
  const answers = { ...brief.answers };
  const input: AssessInitiativeInput = {
    proposal: brief.proposal || ['Idea text not shared.', ...(brief.contradiction_words ?? [])].join(' '),
    industry: brief.context.industry, function: brief.context.function, ai_tier: brief.context.ai_tier,
    employees: brief.context.employees, confirmed: true, answers,
  };
  if (brief.answered_by === 'evidence') {
    input.answered_by = 'evidence';
    const evidence: Partial<Record<AssessQuestionId, AssessEvidence[]>> = { ...(brief.evidence ?? {}) };
    const against: Partial<Record<AssessQuestionId, AssessEvidence[]>> = {};
    for (const id of QUESTIONS) {
      const held = brief.conflicts?.[id];
      if (!held) continue;
      answers[id] = held.choice;
      evidence[id] = held.evidence;
      against[id] = held.against;
    }
    input.evidence = evidence;
    if (Object.keys(against).length) input.evidence_against = against;
  }
  return input;
}

/**
 * The brief link for a verdict the front door has just returned, or nothing
 * when the verdict cannot travel this way: the brief rebuilds a verdict from
 * the five answers, so one that rests on a supplied score has no link.
 */
export function briefUrlFor(
  input: AssessInitiativeInput, result: AssessInitiativeResult, date: string,
  options: { include_proposal?: boolean; base?: string } = {},
): string | undefined {
  const verdict = result.verdict;
  const context = result.resolved_inputs;
  if (result.status !== 'verdict' || !verdict) return undefined;
  if (!context.industry || !context.function || !context.ai_tier || !context.employees) return undefined;
  const scored = Object.keys(verdict.scores_supplied) as (keyof PillarScores)[];
  if (scored.some((pillar) => !verdict.answers_given[pillar])) return undefined;
  if (Object.keys(input.work_architecture ?? {}).length) return undefined;
  const read = { industry: context.industry, function: context.function, ai_tier: context.ai_tier, employees: context.employees };
  const build = (fundingQuotes: boolean) => briefUrl({
      context: read,
      answers: input.answers ?? {},
      date,
      ...(options.include_proposal ? { proposal: result.proposal } : {}),
      contradiction_words: verdict.contradictions.filter((item) => item.found_in !== 'evidence').map((item) => item.proposal_words),
      // The quotes as the engine kept them: trimmed, capped, and only for answers that counted.
      ...(input.answered_by === 'evidence' ? {
        answered_by: 'evidence' as const,
        evidence: Object.fromEntries(Object.entries(verdict.answers_given).flatMap(([id, answer]) => (answer?.evidence ? [[id, answer.evidence]] : []))),
      } : {}),
      ...(result.conflicts?.length ? {
        conflicts: Object.fromEntries(result.conflicts.flatMap((item) => {
          const choice = input.answers?.[item.id];
          return choice && choice !== 'unknown' ? [[item.id, { choice, evidence: item.evidence, against: item.against }]] : [];
        })),
      } : {}),
      ...(result.review?.since_last ? {
        previous: {
          verdict: result.review.since_last.previous_verdict, date: result.review.since_last.previous_date,
          answers: Object.fromEntries(result.review.since_last.changes.map((change) => [change.id, change.from.choice])),
          moved: result.review.since_last.changes.filter((change) => change.moved_verdict).map((change) => change.id),
        },
      } : {}),
      ...(result.funding ? { funding: result.funding, funding_quotes: fundingQuotes } : {}),
      ...(options.base ? { base: options.base } : {}),
    });
  try {
    return build(true);
  } catch {
    // Too long with the quotes behind the funding figures. The figures still travel without them.
    if (result.funding) { try { return build(false); } catch { /* still too long */ } }
    // Too long to travel in a link. The verdict stands without one.
    return undefined;
  }
}
