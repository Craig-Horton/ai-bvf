/**
 * Reads the proposal for words that contradict a favourable answer.
 *
 * The guided verdict rests on what the user answers. Without this check a
 * user could describe an AI that acts with no human review, then tick the
 * answer that says a named person checks its work, and be told to go ahead.
 *
 * The rules are fixed phrases, published here, matched on whole words. No
 * model reads the text and nothing is inferred beyond the phrase itself.
 * A contradiction never changes a score. It holds the verdict at Fix, quotes
 * the words from the proposal beside the answer, and leaves the user to
 * settle which one is true.
 */
import type { AssessQuestionId } from './types.js';

export interface ProposalRule {
  /** Stable name, recorded in the audit when the rule fires. */
  rule: string;
  /** The question whose favourable answer the phrase contradicts. */
  question: AssessQuestionId;
  /** What the phrase says about the initiative, in plain words. */
  says: string;
  pattern: RegExp;
}

export interface ProposalFinding {
  rule: string;
  question: AssessQuestionId;
  /** The words as written in the proposal. */
  proposal_words: string;
  says: string;
}

const HUMAN = '(?:human|person|people|staff|manager|adviser|advisor|clinician|underwriter|agent|employee)';
const CHECK = '(?:review|reviews|reviewing|oversight|supervision|approval|approvals|sign[- ]off|checks?|checking|intervention|involvement|input)';

/**
 * Each pattern is anchored on word boundaries and uses single optional
 * spaces after the proposal's whitespace has been collapsed, so no pattern
 * can backtrack polynomially on long runs of separators.
 */
export const PROPOSAL_RULES: ProposalRule[] = [
  {
    rule: 'no_human_check', question: 'governance_risk',
    says: 'nobody checks or can override the AI',
    pattern: new RegExp(`\\b(?:without|with no|with zero|no) (?:any |a |further |manual )?(?:${HUMAN} )?(?:${CHECK})\\b|\\b(?:no|without a|without any) ${HUMAN}s? in the loop\\b|\\b(?:nobody|no one|no-one) (?:checks|reviews|approves|oversees|supervises|can override|can stop)\\b|\\b(?:unsupervised|unattended)\\b|\\bfully autonomous(?:ly)?\\b`, 'i'),
  },
  {
    rule: 'return_untested', question: 'financial_return',
    says: 'the cost and return have not been worked out',
    pattern: /\b(?:no|without a|without any) (?:business case|cost estimate|budget)\b|\b(?:roi|return|payback|savings?|costs?|benefits?) (?:is|are|remains?|still )?(?: ?(?:unknown|unclear|unproven|untested|uncertain|not yet known|not known|to be confirmed|tbc))\b|\b(?:have|has)(?: not|n't) (?:yet )?(?:costed|priced|measured|quantified|worked out the)\b|\bnot (?:yet )?(?:costed|quantified)\b|\b(?:do not|don't|does not|doesn't) (?:yet )?know (?:what|how much) it (?:will )?(?:costs?|saves?|returns?)\b/i,
  },
  {
    rule: 'no_named_result', question: 'strategic_alignment',
    says: 'no result or target has been set',
    pattern: /\b(?:no|without a|without any) (?:clear |specific |defined |agreed )?(?:goal|goals|target|targets|objective|objectives|kpi|kpis|success measure|success measures)\b|\b(?:not sure|unsure|unclear) (?:yet )?(?:what|which|how) (?:it|this) (?:will |would |should )?(?:improve|improves|change|changes|deliver|delivers|help|helps)\b|\b(?:to )?see what happens\b|\bbecause (?:our |the )?(?:competitors|everyone|everybody|others) (?:are|is|do|does|have|has)\b/i,
  },
  {
    rule: 'no_owner_or_time', question: 'change_enablement',
    says: 'nobody owns the change, or nobody has time for it',
    pattern: /\b(?:no|without a|without an|without any) (?:named |clear |dedicated )?(?:owner|sponsor|lead|project lead|change budget|training budget|training|time set aside)\b|\b(?:nobody|no one|no-one) (?:owns|is responsible for|leads|is leading|has time)\b|\bin (?:their|his|her|our|my) spare time\b|\b(?:on|at) the side of (?:their |his |her |our |my |the )?desks?\b|\bon top of (?:their|his|her|our|my) (?:day jobs?|normal jobs?|existing work|current workload)\b/i,
  },
  {
    rule: 'work_unchanged', question: 'work_architecture',
    says: 'the work itself stays as it is today',
    pattern: /\b(?:no|without any|without) (?:changes?|change) to (?:the |our |how |existing |current )*(?:process|processes|workflow|workflows|roles|way we work|ways of working|we work|team|teams)\b|\bwithout (?:changing|redesigning|touching) (?:the |our |how |existing |current |any )*(?:process|processes|workflow|workflows|roles|way we work|ways of working|we work|anything)\b|\b(?:bolt(?:ed)?[- ]on|drop[- ]in|plug(?:ged)? (?:it )?(?:straight )?into)\b|\b(?:existing|current) (?:process|processes|workflow|workflows) (?:stay|stays|remain|remains|will stay|will remain) (?:the same|unchanged|as (?:it is|they are))\b/i,
  },
];

/**
 * A phrase negated earlier in the same clause ("never runs without human
 * review", "not approved without sign-off") says the opposite, so it is skipped.
 */
const NEGATED_BEFORE = /\b(?:not|never|no longer|cannot|can't|won't|nothing|n't)\b[^.,;:!?]{0,24}$/i;

/**
 * Returns at most one finding per question, the first phrase found in the
 * proposal for that question. Input is capped before any matching.
 */
export function readProposal(proposal: string): ProposalFinding[] {
  const text = String(proposal ?? '').slice(0, 4000).replace(/\s+/g, ' ');
  const findings: ProposalFinding[] = [];
  for (const { rule, question, says, pattern } of PROPOSAL_RULES) {
    const global = new RegExp(pattern.source, 'gi');
    for (const match of text.matchAll(global)) {
      const before = text.slice(Math.max(0, match.index! - 32), match.index!);
      if (NEGATED_BEFORE.test(before)) continue;
      findings.push({ rule, question, proposal_words: match[0].trim(), says });
      break;
    }
  }
  return findings;
}
