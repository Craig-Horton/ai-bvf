/**
 * The link to the one-page brief for an assessed initiative.
 *
 * The result travels inside the link, after the # sign, which browsers never
 * send to a server. Nothing is stored. The page at the other end rebuilds the
 * verdict from the context and the answers with this same engine, so the
 * brief cannot say anything the engine would not.
 */
import type {
  AssessAnsweredBy, AssessChoiceId, AssessEvidence, AssessInitiativeInput, AssessInitiativeResult, AssessQuestionId, PillarScores,
} from './types.js';

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
  /** The page that opens the brief. Defaults to the public one. */
  base?: string;
}

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
  }
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (encoded.length > MAX_LINK) throw new Error('The brief link is too long. Leave the proposal out or shorten it.');
  return `${input.base ?? BRIEF_BASE}#${encoded}`;
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
  try {
    return briefUrl({
      context: { industry: context.industry, function: context.function, ai_tier: context.ai_tier, employees: context.employees },
      answers: input.answers ?? {},
      date,
      ...(options.include_proposal ? { proposal: result.proposal } : {}),
      contradiction_words: verdict.contradictions.filter((item) => item.found_in !== 'evidence').map((item) => item.proposal_words),
      // The quotes as the engine kept them: trimmed, capped, and only for answers that counted.
      ...(input.answered_by === 'evidence' ? {
        answered_by: 'evidence' as const,
        evidence: Object.fromEntries(Object.entries(verdict.answers_given).flatMap(([id, answer]) => (answer?.evidence ? [[id, answer.evidence]] : []))),
      } : {}),
      ...(options.base ? { base: options.base } : {}),
    });
  } catch {
    // Too long to travel in a link. The verdict stands without one.
    return undefined;
  }
}
