/**
 * The funding record: what is asked for the next stage, the alternative, and
 * the results agreed to release more money. It sits beside the verdict, every
 * figure in it is the organisation's own, and the engine never says whether
 * to fund.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessInitiative } from './assessInitiative.js';
import { briefUrlFor, readBriefLink } from './briefLink.js';
import { FUNDING_DECISIONS, FUNDING_DECISION_LABEL, FUNDING_NOTE, fundingRecord, plainNumber, withUnit } from './funding.js';
import type { AssessFundingInput, AssessInitiativeInput } from './types.js';

// A made-up service desk. The four answers give Fix, and the funding record changes none of it.
const PROPOSAL = 'We are a 180-person software firm. We want GenAI to sort incoming service desk tickets and suggest the team to send each one to. A person approves each one.';
const ANSWERS = { financial_return: 'b', governance_risk: 'c', strategic_alignment: 'c', change_enablement: 'c' } as const;
const base: AssessInitiativeInput = { proposal: PROPOSAL, confirmed: true, answers: ANSWERS };
const FUNDING: AssessFundingInput = {
  stage: 'pilot', ask: { amount_eur: 5000 },
  alternative: { description: 'Rewrite the ticket form so customers pick the team themselves.' },
  thresholds: [
    { measure: 'Cost per resolved ticket', unit: 'euros', direction: 'at_most', target: 10, baseline: 12, baseline_kind: 'measured' },
    { measure: 'Reopened tickets', unit: 'percent', direction: 'at_most', target: 6, baseline: 6, baseline_kind: 'measured' },
  ],
};

test('the funding record sits beside the verdict and never changes it', () => {
  const plain = assessInitiative(base);
  const funded = assessInitiative({ ...base, funding: FUNDING });
  assert.equal(plain.funding, undefined);
  assert.equal(funded.verdict!.classification, plain.verdict!.classification);
  assert.deepEqual(funded.verdict!.holding_back, plain.verdict!.holding_back);
  const funding = funded.funding!;
  assert.equal(funding.statement, 'The next stage is a pilot. The ask is €5,000. The alternative: Rewrite the ticket form so customers pick the team themselves. Two results are agreed for the review.');
  assert.deepEqual(funding.gaps, []);
  assert.equal(funding.thresholds[0].line, 'Cost per resolved ticket. Today: €12, measured. Agreed: at most €10.');
  assert.equal(funding.note, FUNDING_NOTE);
  assert.equal(funding.review, undefined, 'nothing is checked before a result is in');
});

test('it never says whether to fund, and gives no figure of its own', () => {
  const said = JSON.stringify(assessInitiative({ ...base, funding: { ...FUNDING, results: [{ measure: 'Cost per resolved ticket', value: 9.5, kind: 'measured' }] } }).funding);
  for (const phrase of ['should fund', 'do not fund', 'recommend', 'release the', 'approve the']) assert.ok(!said.toLowerCase().includes(phrase), phrase);
  assert.match(said, /That decision stays with the person who holds the budget\./);
  assert.doesNotMatch(said, /—|–/);
});

test('what is missing is listed, most important first', () => {
  const bare = assessInitiative({ ...base, funding: {} }).funding!;
  assert.deepEqual(bare.gaps, [
    'The stage is not known: a pilot or a rollout.',
    'The amount asked for the next stage is not known.',
    'No alternative is named, such as fixing the process as it is.',
    'No result is agreed that would release more money.',
  ]);
  assert.equal(bare.statement, 'Four points are still open.');
  const estimated = assessInitiative({ ...base, funding: { ...FUNDING, thresholds: [{ measure: 'Reopened tickets', unit: 'percent', direction: 'at_most', target: 6, baseline: 6 }, { measure: 'First response', unit: 'minutes', direction: 'at_most', target: 30 }] } }).funding!;
  assert.deepEqual(estimated.gaps, ['Reopened tickets: today\'s figure is an estimate. Nobody has measured it.', 'First response: today\'s figure is not known.']);
  assert.match(estimated.statement, /Two points are still open\.$/);
});

test('at the return visit the results sit beside the agreement the earlier brief carried', () => {
  const firstInput = { ...base, funding: FUNDING };
  const link = briefUrlFor(firstInput, assessInitiative(firstInput), '2026-11-23')!;
  const carried = readBriefLink(link)!.funding!;
  assert.equal(carried.ask!.amount_eur, 5000);
  assert.deepEqual(carried.thresholds.map((item) => [item.measure, item.target, item.baseline]), [['Cost per resolved ticket', 10, 12], ['Reopened tickets', 6, 6]]);

  // Today only the results are passed. The agreement comes back from the link.
  const back = assessInitiative({
    ...base, review: { previous_brief: link },
    funding: { results: [{ measure: 'Cost per resolved ticket', value: 9.5, kind: 'measured' }, { measure: 'reopened tickets', value: 10, kind: 'measured' }], decision: 'deferred' },
  });
  const funding = back.funding!;
  assert.deepEqual(funding.review, { met: 1, of: 2, statement: 'Two results were agreed on 23 November 2026. One is met and one is not. Not met: Reopened tickets, at most 6 percent agreed, 10 percent measured.' });
  assert.deepEqual(funding.thresholds.map((item) => item.met), [true, false]);
  assert.equal(funding.thresholds[0].line, 'Cost per resolved ticket. Agreed: at most €10. Result: €9.50, measured. Met.');
  assert.equal(funding.thresholds[1].line, 'Reopened tickets. Agreed: at most 6 percent. Result: 10 percent, measured. Not met.');
  assert.equal(funding.ask!.amount_eur, 5000, 'the ask comes back with the agreement');
  assert.equal(funding.decision, 'deferred');
  assert.equal(back.verdict!.classification, 'Fix', 'a result against a threshold does not move the verdict');
  // The new link carries the results too.
  const again = readBriefLink(briefUrlFor({ ...base, review: { previous_brief: link }, funding: { results: [{ measure: 'Reopened tickets', value: 10, kind: 'measured' }] } }, back, '2027-01-04')!)!.funding!;
  assert.equal(again.review!.met, 1);
  assert.equal(again.decision, 'deferred');
});

test('results agreed today never quietly replace the earlier agreement', () => {
  const firstInput = { ...base, funding: FUNDING };
  const link = briefUrlFor(firstInput, assessInitiative(firstInput), '2026-11-23')!;
  const easier = assessInitiative({
    ...base, review: { previous_brief: link },
    funding: { thresholds: [{ measure: 'Reopened tickets', unit: 'percent', direction: 'at_most', target: 12 }], results: [{ measure: 'Reopened tickets', value: 10, kind: 'measured' }] },
  }).funding!;
  assert.equal(easier.agreement_changed, true);
  assert.equal(easier.thresholds.length, 2, 'the earlier two are kept');
  assert.equal(easier.thresholds[1].target, 6);
  assert.equal(easier.thresholds[1].met, false);
  assert.match(easier.statement, /The results passed today differ from those agreed earlier\. The check uses the earlier ones\./);
});

test('an estimate is kept apart from a measured result, and a result nobody agreed is named', () => {
  const funding = fundingRecord({ ...FUNDING, results: [{ measure: 'Cost per resolved ticket', value: 9 }, { measure: 'Customer satisfaction', value: 4.4, kind: 'measured' }] }, false)!;
  assert.equal(funding.thresholds[0].line, 'Cost per resolved ticket. Agreed: at most €10. Result: €9, an estimate. Met.');
  assert.deepEqual(funding.gaps, [
    'Cost per resolved ticket: the result is an estimate. Nobody has measured it.',
    'Reopened tickets: there is no result yet.',
    'Customer satisfaction: a result was given, and no such result was agreed.',
  ]);
  assert.equal(funding.review!.statement, 'Two results were agreed. One has a result so far, and it is met.');
});

test('an agent keeps a figure only where it can quote it', () => {
  const quoted = { quote: 'We ask for 5,000 euros to run the triage pilot for eight weeks.', source: 'Pilot request, 18 November 2026' };
  const agreed = { quote: 'Release rollout funds if cost per resolved ticket falls to 10 euros or less.', source: 'Sponsor note, 20 November 2026' };
  const funding = fundingRecord({
    stage: 'pilot', ask: { amount_eur: 5000, evidence: quoted },
    alternative: { description: 'Rewrite the ticket form.' },
    thresholds: [
      { measure: 'Cost per resolved ticket', unit: 'euros', direction: 'at_most', target: 10, baseline: 12, baseline_kind: 'measured', evidence: agreed },
      { measure: 'Reopened tickets', unit: 'percent', direction: 'at_most', target: 6 },
    ],
    results: [{ measure: 'Cost per resolved ticket', value: 9.5, kind: 'measured' }],
  }, true)!;
  assert.deepEqual(funding.ask, { amount_eur: 5000, evidence: quoted });
  assert.equal(funding.alternative, undefined, 'an alternative with no quote is not kept');
  assert.equal(funding.thresholds.length, 1, 'an agreed result with no quote is not kept');
  assert.equal(funding.thresholds[0].result, undefined, 'a result with no quote is not counted');
  assert.ok(funding.gaps.includes('No alternative is named, such as fixing the process as it is.'));
  const unquoted = fundingRecord({ ask: { amount_eur: 5000 } }, true)!;
  assert.equal(unquoted.ask, undefined);
});

test('the quotes behind the figures travel in the link, and are left out before the link is lost', () => {
  const quoted = { quote: 'We ask for 5,000 euros to run the triage pilot for eight weeks.', source: 'Pilot request, 18 November 2026' };
  const input = { ...base, funding: { ...FUNDING, ask: { amount_eur: 5000, evidence: quoted } } };
  const carried = readBriefLink(briefUrlFor(input, assessInitiative(input), '2026-11-23')!)!.funding!;
  assert.deepEqual(carried.ask!.evidence, quoted);
});

test('malformed input is refused in plain words', () => {
  assert.throws(() => assessInitiative({ ...base, funding: { stage: 'trial' as any } }), /funding\.stage must be pilot or rollout/);
  assert.throws(() => assessInitiative({ ...base, funding: { ask: { amount_eur: -1 } } }), /funding\.ask\.amount_eur must be a number, 0 or more/);
  assert.throws(() => assessInitiative({ ...base, funding: { thresholds: [{ measure: 'Cost', direction: 'lower' as any, target: 1 }] } }), /direction must be at_most or at_least/);
  assert.throws(() => assessInitiative({ ...base, funding: { thresholds: Array(4).fill({ measure: 'Cost', direction: 'at_most', target: 1 }) } }), /takes 3 at most/);
  assert.throws(() => assessInitiative({ ...base, funding: { decision: 'approved' as any } }), /funding\.decision must be one of released, deferred, withdrew/);
  assert.deepEqual(Object.keys(FUNDING_DECISION_LABEL), [...FUNDING_DECISIONS]);
});

test('numbers are written the way a person writes them', () => {
  assert.equal(plainNumber(1234567.891), '1,234,567.89');
  assert.equal(withUnit(5000, 'euros'), '€5,000');
  assert.equal(withUnit(9.5, 'EUR'), '€9.50');
  assert.equal(withUnit(6, 'percent'), '6 percent');
  assert.equal(withUnit(30), '30');
});
