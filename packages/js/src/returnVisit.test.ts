/**
 * Two rules for an agent that works from records.
 *
 * Where two records disagree on an answer, the engine picks no winner: the
 * answer is counted as not known and both sets of quotes come back for the
 * owner. And at a return visit the earlier brief link is read back, so the
 * result says which answers changed and which change moved the verdict.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessInitiative, CONFLICT_LABEL, UNANSWERED_LABEL } from './assessInitiative.js';
import { assessInputFromBrief, briefUrlFor, readBriefLink } from './briefLink.js';
import type { AssessInitiativeInput, AssessQuestionId } from './types.js';

const PROPOSAL = 'We are a 400-person online retailer. We want an AI agent to answer first-line customer queries and issue refunds up to 50 euros on its own.';
const QUOTES: Record<AssessQuestionId, { quote: string; source: string }> = {
  financial_return: { quote: 'Finance has checked the saving of 180,000 euros a year against the licence cost.', source: 'Business case v3, 4 November 2026' },
  governance_risk: { quote: 'Refund limits to be agreed after the pilot.', source: 'Steering minutes, 12 November 2026' },
  strategic_alignment: { quote: 'Target: first response under two minutes, owned by the customer director.', source: 'Objectives 2027, page 2' },
  change_enablement: { quote: 'Project lead named, with 40,000 euros set aside for training.', source: 'Project plan, 6 November 2026' },
  work_architecture: { quote: 'The new workflow is drawn end to end. The roles are rewritten. Override rights and team measures are set.', source: 'Process design, 10 November 2026' },
};
const base: AssessInitiativeInput = { proposal: PROPOSAL, confirmed: true, answered_by: 'evidence' };
// Everything clears except the risk answer, so the first verdict is Fix on that one answer.
const FIX = { financial_return: 'c', governance_risk: 'b', strategic_alignment: 'c', change_enablement: 'c', work_architecture: 'd' } as const;
const MINUTES = { quote: 'The returns lead approves every refund exception from 1 December and can switch the agent off.', source: 'Board minutes, 26 November 2026' };
const POLICY = { quote: 'The agent pays refund exceptions of any amount when the customer asks twice.', source: 'Service policy v4, 3 September 2026' };

test('two records that disagree hold the answer as not known and both come back', () => {
  const result = assessInitiative({
    ...base, answers: { ...FIX, governance_risk: 'd' },
    evidence: { ...QUOTES, governance_risk: MINUTES }, evidence_against: { governance_risk: POLICY },
  });
  assert.equal(result.status, 'not_enough_to_judge', 'no rule picks which record applies today');
  assert.equal(result.conflicts?.length, 1);
  const conflict = result.conflicts![0];
  assert.equal(conflict.id, 'governance_risk');
  assert.deepEqual(conflict.evidence, [MINUTES]);
  assert.deepEqual(conflict.against, [POLICY]);
  assert.equal(conflict.ask, 'Two records disagree. Board minutes, 26 November 2026 says "The returns lead approves every refund exception from 1 December and can switch the agent off". Service policy v4, 3 September 2026 says "The agent pays refund exceptions of any amount when the customer asks twice". Which one applies today?');
  assert.match(result.next_question!, /^Not enough to judge yet\. Two records disagree on risk and control\. Ask the owner which record applies today\. /);
  assert.deepEqual(result.to_find_out?.map((item) => item.id), ['governance_risk']);
});

test('the hold works the same whichever record the agent sided with', () => {
  // The agent took the policy as the answer, which alone would stop the initiative, and quoted the minutes against it.
  const sidedWithPolicy = assessInitiative({
    ...base, answers: { ...FIX, governance_risk: 'a' },
    evidence: { ...QUOTES, governance_risk: POLICY }, evidence_against: { governance_risk: [MINUTES] },
  });
  assert.equal(sidedWithPolicy.status, 'not_enough_to_judge');
  assert.equal(sidedWithPolicy.conflicts![0].against[0].source, MINUTES.source);
});

test('a conflict on one answer does not hide a stop on another', () => {
  const thin = { quote: 'The licence costs more than the saving in every year of the plan.', source: 'Business case v3, 4 November 2026' };
  const result = assessInitiative({
    ...base, answers: { ...FIX, financial_return: 'a', governance_risk: 'd' },
    evidence: { ...QUOTES, financial_return: thin, governance_risk: MINUTES }, evidence_against: { governance_risk: POLICY },
  });
  assert.equal(result.status, 'verdict');
  assert.equal(result.verdict!.classification, 'Stop');
  assert.equal(result.conflicts?.[0].id, 'governance_risk', 'the conflict is still reported beside the verdict');
  assert.ok(result.verdict!.audit.rules_fired.includes('conflict:governance_risk'));
  assert.deepEqual((result.verdict!.audit.inputs_used as any).evidence_conflicts, ['governance_risk']);
});

test('words against an answer count only with a source, and only in evidence mode', () => {
  const noSource = assessInitiative({
    ...base, answers: { ...FIX, governance_risk: 'd' },
    evidence: { ...QUOTES, governance_risk: MINUTES }, evidence_against: { governance_risk: { quote: POLICY.quote, source: '' } },
  });
  assert.equal(noSource.conflicts, undefined);
  assert.notEqual(noSource.verdict?.classification, 'Accelerate');
  assert.deepEqual(noSource.evidence_missing, ['governance_risk']);
  const byOwner = assessInitiative({ proposal: PROPOSAL, confirmed: true, answers: { ...FIX, governance_risk: 'd' }, evidence_against: { governance_risk: POLICY } });
  assert.equal(byOwner.conflicts, undefined, 'a person who answers has already said which record applies');
});

test('a conflict travels in the brief link and is rebuilt from it', () => {
  const thin = { quote: 'The licence costs more than the saving in every year of the plan.', source: 'Business case v3, 4 November 2026' };
  const input: AssessInitiativeInput = {
    ...base, answers: { ...FIX, financial_return: 'a', governance_risk: 'd' },
    evidence: { ...QUOTES, financial_return: thin, governance_risk: MINUTES }, evidence_against: { governance_risk: POLICY },
  };
  const result = assessInitiative(input);
  const link = briefUrlFor(input, result, '2026-11-22')!;
  const brief = readBriefLink(link)!;
  assert.equal(brief.answers.governance_risk, 'unknown', 'an older brief page reads it as not known and reaches the same verdict');
  assert.deepEqual(brief.conflicts?.governance_risk, { choice: 'd', evidence: [MINUTES], against: [POLICY] });
  const rebuilt = assessInitiative(assessInputFromBrief(brief));
  assert.equal(rebuilt.verdict!.classification, 'Stop');
  assert.deepEqual(rebuilt.conflicts, result.conflicts);
});

test('a brief link reads back to the verdict it came with', () => {
  const input = { ...base, answers: FIX, evidence: QUOTES };
  const first = assessInitiative(input);
  assert.equal(first.verdict!.classification, 'Fix');
  const link = briefUrlFor(input, first, '2026-10-12')!;
  const brief = readBriefLink(link)!;
  assert.equal(brief.date, '2026-10-12');
  assert.deepEqual(brief.answers, FIX);
  assert.deepEqual(brief.evidence?.governance_risk, [QUOTES.governance_risk]);
  assert.equal(assessInitiative(assessInputFromBrief(brief)).verdict!.classification, 'Fix');
  assert.deepEqual(readBriefLink(link.split('#')[1]), brief, 'the part after the # sign is enough');
  for (const bad of ['', 'https://www.aibvf.com/verdict', 'https://www.aibvf.com/verdict#not-a-brief', 'https://bit.ly/3xYz']) {
    assert.equal(readBriefLink(bad), undefined, bad);
  }
});

test('a return visit says which answer changed and that it moved the verdict', () => {
  const firstInput = { ...base, answers: FIX, evidence: QUOTES };
  const link = briefUrlFor(firstInput, assessInitiative(firstInput), '2026-10-12')!;
  const second = assessInitiative({
    ...base, answers: { ...FIX, governance_risk: 'd' }, evidence: { ...QUOTES, governance_risk: MINUTES },
    review: { previous_brief: link },
  });
  assert.equal(second.verdict!.classification, 'Accelerate');
  const since = second.review!.since_last!;
  assert.equal(second.review!.previous_verdict, 'Fix');
  assert.equal(since.previous_date, '2026-10-12');
  assert.equal(since.verdict_changed, true);
  assert.equal(since.unchanged, 4);
  assert.equal(since.changes.length, 1);
  const change = since.changes[0];
  assert.equal(change.id, 'governance_risk');
  assert.equal(change.moved_verdict, true);
  assert.deepEqual(change.from.evidence, [QUOTES.governance_risk], 'the earlier quote comes back beside the new one');
  assert.deepEqual(change.to.evidence, [MINUTES]);
  assert.equal(change.line, `Risk and control. Before: ${change.from.label} Now: ${change.to.label}`);
  assert.equal(since.statement, 'The verdict moved from Fix to Accelerate. One answer changed since 12 October 2026. This change moved the verdict: Risk and control.');
});

test('a change that leaves the verdict where it was is listed and not credited', () => {
  const firstInput = { ...base, answers: FIX, evidence: QUOTES };
  const link = briefUrlFor(firstInput, assessInitiative(firstInput), '2026-10-12')!;
  const better = { quote: 'Finance signed off the business case and has tracked the saving for two quarters.', source: 'Finance review, 20 November 2026' };
  const second = assessInitiative({
    ...base, answers: { ...FIX, financial_return: 'd' }, evidence: { ...QUOTES, financial_return: better },
    review: { previous_brief: link, outcome: 'no_decision', evidence: { quote: 'No decision on the refund limits yet.', source: 'Steering minutes, 19 November 2026' } },
  });
  const since = second.review!.since_last!;
  assert.equal(second.verdict!.classification, 'Fix');
  assert.equal(since.verdict_changed, false);
  assert.equal(since.changes[0].moved_verdict, false);
  assert.equal(since.statement, 'The verdict is still Fix. One answer changed since 12 October 2026.');
  assert.equal(second.review!.outcome, 'no_decision', 'what happened since is still kept beside it');

  const same = assessInitiative({ ...firstInput, review: { previous_brief: link } });
  assert.equal(same.review!.since_last!.statement, 'The verdict is still Fix. No answers changed since 12 October 2026.');
  assert.equal(same.review!.since_last!.unchanged, 5);
});

test('a return visit that finds two records in conflict says the verdict now waits', () => {
  const firstInput = { ...base, answers: FIX, evidence: QUOTES };
  const link = briefUrlFor(firstInput, assessInitiative(firstInput), '2026-10-12')!;
  const second = assessInitiative({
    ...base, answers: { ...FIX, governance_risk: 'd' }, evidence: { ...QUOTES, governance_risk: MINUTES },
    evidence_against: { governance_risk: POLICY }, review: { previous_brief: link },
  });
  assert.equal(second.status, 'not_enough_to_judge');
  const since = second.review!.since_last!;
  assert.equal(since.now, 'Not enough to judge yet');
  assert.equal(since.changes[0].to.label, CONFLICT_LABEL);
  assert.equal(since.statement, 'The earlier verdict was Fix. There is not enough to judge yet. One answer changed since 12 October 2026. This change moved the verdict: Risk and control.');
});

test('the earlier verdict and the changes travel in the new brief link', () => {
  const firstInput = { ...base, answers: FIX, evidence: QUOTES };
  const link = briefUrlFor(firstInput, assessInitiative(firstInput), '2026-10-12')!;
  const input: AssessInitiativeInput = {
    ...base, answers: { ...FIX, governance_risk: 'd' }, evidence: { ...QUOTES, governance_risk: MINUTES }, review: { previous_brief: link },
  };
  const brief = readBriefLink(briefUrlFor(input, assessInitiative(input), '2026-11-22')!)!;
  assert.deepEqual(brief.previous, { verdict: 'Fix', date: '2026-10-12', answers: { governance_risk: 'b' }, moved: ['governance_risk'] });
});

test('a person can come back with the earlier link and no quotes', () => {
  const firstInput: AssessInitiativeInput = { proposal: PROPOSAL, confirmed: true, answers: { financial_return: 'c', governance_risk: 'b', strategic_alignment: 'c', change_enablement: 'c' } };
  const first = assessInitiative(firstInput);
  assert.equal(first.verdict!.classification, 'Fix');
  const link = briefUrlFor(firstInput, first, '2026-10-12')!;
  const second = assessInitiative({ ...firstInput, answers: { ...firstInput.answers, governance_risk: 'd', work_architecture: 'd' }, review: { previous_brief: link } });
  assert.equal(second.verdict!.classification, 'Accelerate');
  const since = second.review!.since_last!;
  assert.deepEqual(since.changes.map((change) => change.id), ['governance_risk', 'work_architecture']);
  assert.equal(since.changes[1].from.label, UNANSWERED_LABEL);
  assert.match(since.statement, /^The verdict moved from Fix to Accelerate\. Two answers changed since 12 October 2026\./);
});

test('a link that is no brief link is refused in plain words', () => {
  assert.throws(() => assessInitiative({ ...base, answers: FIX, evidence: QUOTES, review: { previous_brief: 'https://bit.ly/3xYz' } }), /must be the brief link the earlier verdict came with/);
  assert.throws(() => assessInitiative({ ...base, answers: FIX, evidence: QUOTES, review: { previous_verdict: 'Fix' } }), /review needs previous_brief/);
});

test('nothing the two rules say carries an em-dash', () => {
  const firstInput = { ...base, answers: FIX, evidence: QUOTES };
  const link = briefUrlFor(firstInput, assessInitiative(firstInput), '2026-10-12')!;
  const result = assessInitiative({
    ...base, answers: { ...FIX, governance_risk: 'd' }, evidence: { ...QUOTES, governance_risk: MINUTES },
    evidence_against: { governance_risk: POLICY }, review: { previous_brief: link },
  });
  assert.doesNotMatch(JSON.stringify(result), /—|–/);
});
