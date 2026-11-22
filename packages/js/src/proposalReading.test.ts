import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessInitiative } from './assessInitiative.js';
import { PROPOSAL_RULES, readProposal } from './proposalReading.js';

const ALL_D = { financial_return: 'd', governance_risk: 'd', strategic_alignment: 'd', change_enablement: 'd', work_architecture: 'd' } as const;
const ctx = { industry: 'financial', function: 'risk', ai_tier: 'gen3', employees: 3500, confirmed: true } as const;

function verdictFor(proposal: string, answers: Record<string, string> = ALL_D) {
  const r = assessInitiative({ proposal, ...ctx, answers: answers as never });
  assert.equal(r.status, 'verdict');
  return r.verdict!;
}

test('a proposal that agrees with its answers still earns Accelerate', () => {
  const v = verdictFor('Agents draft consumer loan decisions and an underwriter approves each one.');
  assert.equal(v.classification, 'Accelerate');
  assert.deepEqual(v.contradictions, []);
});

test('no human review in the proposal holds a best-answer verdict at Fix and quotes the words', () => {
  const v = verdictFor('Autonomous agents approve consumer loans without human review.');
  assert.equal(v.classification, 'Fix');
  assert.equal(v.contradictions.length, 1);
  assert.equal(v.contradictions[0].id, 'governance_risk');
  assert.equal(v.contradictions[0].proposal_words, 'without human review');
  assert.equal(v.holding_back[0].proposal_words, 'without human review');
  assert.match(v.first_step, /Your proposal says "without human review"/);
  assert.equal(v.reason, 'The proposal contradicts an answer the go-ahead rests on.');
  assert.ok(v.audit.rules_fired.includes('contradiction:governance_risk'));
  assert.ok(v.audit.rules_fired.includes('cap:Fix(contradiction)'));
  assert.equal(v.scores_supplied.governance_risk, 15, 'a contradiction never changes a score');
});

test('a phrase counts only against a favourable answer', () => {
  const answers = { ...ALL_D, governance_risk: 'b' };
  const v = verdictFor('Autonomous agents approve consumer loans without human review.', answers);
  assert.equal(v.classification, 'Fix');
  assert.deepEqual(v.contradictions, [], 'the answer already agrees with the proposal');
  assert.ok(v.audit.rules_fired.includes('proposal_read:no_human_check'));
});

test('a Stop stays a Stop and still lists the contradiction', () => {
  const answers = { ...ALL_D, financial_return: 'a' };
  const v = verdictFor('Agents approve loans with no oversight.', answers);
  assert.equal(v.classification, 'Stop');
  assert.equal(v.contradictions[0].id, 'governance_risk');
});

test('each published rule fires on its own wording and on nothing neutral', () => {
  const cases: Record<string, string[]> = {
    no_human_check: ['runs without human review', 'there is no human in the loop', 'nobody checks its output', 'it runs unsupervised', 'a fully autonomous agent', 'with no oversight'],
    return_untested: ['there is no business case yet', 'the ROI is unclear', 'we have not costed it', "we don't know what it costs"],
    no_named_result: ['we have no clear target', 'we will see what happens', 'because competitors are doing it', 'not sure what it will improve'],
    no_owner_or_time: ['there is no owner', 'nobody owns it', 'the team does it in their spare time', 'on top of their day job'],
    work_unchanged: ['with no changes to the process', 'without changing how we work', 'a bolt-on to the CRM', 'the existing process stays the same'],
    measures_unchanged: ['the team\'s measures stay as they are for now', 'targets remain unchanged', 'the KPIs will stay the same', 'incentives are left as they are'],
  };
  assert.deepEqual(Object.keys(cases).sort(), PROPOSAL_RULES.map((r) => r.rule).sort());
  for (const [rule, phrases] of Object.entries(cases)) {
    for (const phrase of phrases) {
      const found = readProposal(`A 400-person retailer wants a GenAI assistant and ${phrase}.`);
      assert.ok(found.some((f) => f.rule === rule), `${rule} did not fire on: ${phrase}`);
    }
  }
  const neutral = 'A 400-person retailer wants a GenAI assistant for customer service. A named manager reviews every reply, the cost case is checked by finance and the target is first-contact resolution.';
  assert.deepEqual(readProposal(neutral), []);
});

test('a phrase about the measures counts only against an answer that claims new measures', () => {
  const found = readProposal('The workflow is redesigned, and the team\'s measures stay as they are for now.');
  assert.deepEqual(found.map((f) => [f.rule, f.part, f.proposal_words]), [['measures_unchanged', 'measures_updated', 'measures stay as they are']]);
  assert.deepEqual(readProposal('The measures do not stay as they are: handling time is dropped.'), []);
});

test('a negated phrase is not read as a contradiction', () => {
  assert.deepEqual(readProposal('The agent never runs without human review.'), []);
  assert.deepEqual(readProposal('Loans are not approved without sign-off.'), []);
});

test('long hostile input is read in bounded time', () => {
  const start = Date.now();
  readProposal('without '.repeat(50000) + 'the '.repeat(50000) + ' '.repeat(100000));
  assert.ok(Date.now() - start < 500);
});

test('contradiction text carries no em-dashes and no banned vocabulary', () => {
  const v = verdictFor('Agents approve loans without human review, there is no business case, no clear target, nobody owns it and it is a bolt-on.');
  assert.equal(v.contradictions.length, 5);
  const blob = JSON.stringify([v.summary, v.first_step, v.holding_back, v.contradictions, v.reason, PROPOSAL_RULES.map((r) => r.says)]);
  assert.ok(!blob.includes('—'), 'em-dash found');
  for (const w of ['boardroom', 'leverage', 'crucial', 'pivotal', 'seamless', 'robust', 'unlock']) {
    assert.ok(!blob.toLowerCase().includes(w), `banned word: ${w}`);
  }
});
