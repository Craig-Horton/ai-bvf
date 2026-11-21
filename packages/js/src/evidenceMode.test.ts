/**
 * Evidence mode: an agent working alone answers from evidence it can quote.
 * The engine holds the one rule a model cannot be trusted to hold by itself:
 * an answer without a quote and a source is counted as not known.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessInitiative, EVIDENCE_STATEMENT, REVIEW_OUTCOMES, REVIEW_OUTCOME_LABEL } from './assessInitiative.js';
import { AGENT_BRIEF, AGENT_CONNECTOR_URL } from './agentBrief.js';
import { briefUrl, briefUrlFor } from './briefLink.js';
import { WHERE_TO_LOOK, AGENT_RISK_WHERE_TO_LOOK } from './guidedQuestions.js';
import type { AssessInitiativeInput, AssessQuestionId } from './types.js';

const PROPOSAL = 'We are a 400-person online retailer. We want an AI agent to answer first-line customer queries and issue refunds up to 50 euros on its own.';
const QUOTES: Record<AssessQuestionId, { quote: string; source: string }> = {
  financial_return: { quote: 'Finance has checked the saving of 180,000 euros a year against the licence cost.', source: 'Business case v3, 4 November 2026' },
  governance_risk: { quote: 'Refund limits to be agreed after the pilot.', source: 'Steering minutes, 12 November 2026' },
  strategic_alignment: { quote: 'Target: first response under two minutes, owned by the customer director.', source: 'Objectives 2027, page 2' },
  change_enablement: { quote: 'Project lead named, with 40,000 euros set aside for training.', source: 'Project plan, 6 November 2026' },
  work_architecture: { quote: 'New workflow, team roles and override rights are designed. Team measures stay as they are.', source: 'Process design, 10 November 2026' },
};
const base: AssessInitiativeInput = { proposal: PROPOSAL, confirmed: true, answered_by: 'evidence' };
const ANSWERS = { financial_return: 'c', governance_risk: 'b', strategic_alignment: 'c', change_enablement: 'c', work_architecture: 'c' } as const;

test('an agent that quotes its evidence gets a verdict that says who answered', () => {
  const result = assessInitiative({ ...base, answers: ANSWERS, evidence: QUOTES });
  assert.equal(result.status, 'verdict');
  assert.equal(result.answered_by, 'evidence');
  const verdict = result.verdict!;
  assert.equal(verdict.classification, 'Fix');
  assert.deepEqual(verdict.provenance, { answered_by: 'evidence', statement: EVIDENCE_STATEMENT, answers_with_evidence: 5 });
  assert.deepEqual(verdict.answers_given.governance_risk?.evidence, QUOTES.governance_risk);
  const risk = verdict.holding_back.find((item) => item.id === 'governance_risk');
  assert.deepEqual(risk?.evidence, QUOTES.governance_risk, 'what holds it back carries the words it rests on');
  assert.ok(verdict.audit.rules_fired.includes('answered_by:evidence'));
  assert.ok(verdict.audit.rules_fired.includes('evidence:governance_risk'));
  assert.deepEqual((verdict.audit.inputs_used as any).evidence_sources.financial_return, QUOTES.financial_return.source);
});

test('the same answers give the same verdict whoever answered', () => {
  const byOwner = assessInitiative({ proposal: PROPOSAL, confirmed: true, answers: ANSWERS });
  const byAgent = assessInitiative({ ...base, answers: ANSWERS, evidence: QUOTES });
  assert.equal(byAgent.verdict!.classification, byOwner.verdict!.classification);
  assert.deepEqual(byAgent.verdict!.scores_supplied, byOwner.verdict!.scores_supplied);
  assert.equal(byAgent.verdict!.first_step, byOwner.verdict!.first_step);
  assert.equal(byOwner.answered_by, undefined);
  assert.equal(byOwner.verdict!.provenance, undefined, 'a person-answered verdict is unchanged');
});

test('an answer with no evidence is counted as not known', () => {
  const { governance_risk: _dropped, ...partial } = QUOTES;
  const result = assessInitiative({ ...base, answers: ANSWERS, evidence: partial });
  assert.equal(result.status, 'not_enough_to_judge', 'no verdict rests on an answer nobody can check');
  assert.deepEqual(result.evidence_missing, ['governance_risk']);
  const open = result.to_find_out?.find((item) => item.id === 'governance_risk');
  assert.ok(open, 'the unsupported question is listed to find out');
  assert.equal(open!.where_to_look, AGENT_RISK_WHERE_TO_LOOK);
});

test('a few characters, or a missing source, are no evidence', () => {
  for (const weak of [{ quote: 'ok', source: 'Business case' }, { quote: 'Finance has checked the figures.', source: '' }, { quote: 'Finance has checked the figures.' }, 'Finance has checked the figures.']) {
    const result = assessInitiative({ ...base, answers: ANSWERS, evidence: { ...QUOTES, financial_return: weak as any } });
    assert.deepEqual(result.evidence_missing, ['financial_return'], JSON.stringify(weak));
    assert.equal(result.status, 'not_enough_to_judge');
  }
});

test('unknown needs no evidence, and a stopping answer still stops on its own', () => {
  const result = assessInitiative({
    ...base,
    answers: { governance_risk: 'a', financial_return: 'unknown' },
    evidence: { governance_risk: { quote: 'The agent may issue refunds of any amount with no approval step.', source: 'Vendor design note, 3 November 2026' } },
  });
  assert.equal(result.status, 'verdict');
  assert.equal(result.verdict!.classification, 'Stop');
  assert.equal(result.evidence_missing, undefined);
  assert.equal(result.verdict!.provenance?.answers_with_evidence, 1);
});

test('numeric scores are refused in evidence mode', () => {
  assert.throws(() => assessInitiative({ ...base, scores: { financial_return: 90 } }), /quote the evidence/);
  assert.throws(() => assessInitiative({ ...base, work_architecture: { workflow_redesigned: true } }), /quote the evidence/);
  assert.throws(() => assessInitiative({ ...base, answered_by: 'me' as any }), /owner or evidence/);
});

test('evidence that says the opposite of its answer holds the verdict at Fix', () => {
  const all = { financial_return: 'd', governance_risk: 'd', strategic_alignment: 'd', change_enablement: 'd', work_architecture: 'd' } as const;
  const clean = assessInitiative({ ...base, proposal: 'We are a 400-person online retailer. We want GenAI to draft replies to customer queries.', answers: all, evidence: QUOTES });
  assert.equal(clean.verdict!.classification, 'Accelerate');
  assert.equal(clean.verdict!.summary, 'Go ahead. The evidence clears the bar on every question.');

  const contradicted = assessInitiative({
    ...base, proposal: 'We are a 400-person online retailer. We want GenAI to draft replies to customer queries.', answers: all,
    evidence: { ...QUOTES, governance_risk: { quote: 'Replies go out with no human review once the pilot ends.', source: 'Design note, 9 November 2026' } },
  });
  assert.equal(contradicted.verdict!.classification, 'Fix');
  const found = contradicted.verdict!.contradictions[0];
  assert.equal(found.id, 'governance_risk');
  assert.equal(found.found_in, 'evidence');
  assert.equal(found.proposal_words, 'with no human review');
  assert.match(contradicted.verdict!.first_step, /^The evidence says "with no human review"/);
  assert.equal(contradicted.verdict!.reason, 'The evidence contradicts an answer the go-ahead rests on.');
  assert.ok(contradicted.verdict!.audit.rules_fired.includes('evidence_read:no_human_check'));
  assert.ok(contradicted.verdict!.audit.rules_fired.includes('cap:Fix(contradiction)'));
});

test('every question says where its answer is usually written down', () => {
  const asking = assessInitiative({ proposal: PROPOSAL, confirmed: true });
  assert.equal(asking.question?.where_to_look, WHERE_TO_LOOK.financial_return);
  for (const item of asking.decides ?? []) assert.ok(item.where_to_look.length > 20, item.id);
  const risk = assessInitiative({ proposal: PROPOSAL, confirmed: true, answers: { financial_return: 'c' } });
  assert.equal(risk.question?.where_to_look, AGENT_RISK_WHERE_TO_LOOK, 'an agent gets guidance specific to an agent');
});

test('a review is kept beside the verdict and never changes it', () => {
  const plain = assessInitiative({ ...base, answers: ANSWERS, evidence: QUOTES });
  const reviewed = assessInitiative({
    ...base, answers: ANSWERS, evidence: QUOTES,
    review: { previous_verdict: 'Fix', outcome: 'fixed_then_went_ahead', evidence: { quote: 'Limits signed off on 2 December, agent live from 9 December.', source: 'Steering minutes, 10 December 2026' } },
  });
  assert.equal(reviewed.verdict!.classification, plain.verdict!.classification);
  assert.equal(reviewed.review?.accepted, true);
  assert.equal(reviewed.review?.outcome, 'fixed_then_went_ahead');

  const unsupported = assessInitiative({ ...base, answers: ANSWERS, evidence: QUOTES, review: { previous_verdict: 'Fix', outcome: 'delivering' } });
  assert.equal(unsupported.review?.accepted, false, 'an agent cannot report an outcome it cannot quote');

  const byOwner = assessInitiative({ proposal: PROPOSAL, confirmed: true, answers: ANSWERS, review: { previous_verdict: 'Stop', outcome: 'paused_or_stopped' } });
  assert.equal(byOwner.review?.accepted, true, 'a person needs no quote for what they saw happen');
  assert.throws(() => assessInitiative({ proposal: PROPOSAL, review: { previous_verdict: 'Fix', outcome: 'went well' as any } }), /review needs/);
  assert.deepEqual(Object.keys(REVIEW_OUTCOME_LABEL), [...REVIEW_OUTCOMES]);
});

test('the brief link carries the answers and the evidence, and nothing is stored', () => {
  const input = { ...base, answers: ANSWERS, evidence: QUOTES };
  const result = assessInitiative(input);
  const url = briefUrlFor(input, result, '2026-11-21')!;
  assert.match(url, /^https:\/\/www\.aibvf\.com\/verdict#[A-Za-z0-9_-]+$/);
  const data = JSON.parse(Buffer.from(url.split('#')[1], 'base64url').toString('utf8'));
  assert.deepEqual(data.c, { i: 'retail', f: 'cx', t: 'gen3', e: 400 });
  assert.deepEqual(data.a, ANSWERS);
  assert.equal(data.d, '2026-11-21');
  assert.equal(data.b, 'e');
  assert.deepEqual(data.q.governance_risk, [QUOTES.governance_risk.quote, QUOTES.governance_risk.source]);
  assert.equal(data.p, undefined, 'the wording of the proposal stays out unless the owner says otherwise');
  const shared = JSON.parse(Buffer.from(briefUrlFor(input, result, '2026-11-21', { include_proposal: true })!.split('#')[1], 'base64url').toString('utf8'));
  assert.equal(shared.p, PROPOSAL);

  // A person-answered verdict keeps the link format the page already reads.
  const ownerInput = { proposal: PROPOSAL, confirmed: true, answers: ANSWERS };
  const owner = JSON.parse(Buffer.from(briefUrlFor(ownerInput, assessInitiative(ownerInput), '2026-11-21')!.split('#')[1], 'base64url').toString('utf8'));
  assert.deepEqual(Object.keys(owner).sort(), ['a', 'c', 'd', 'v']);

  // A verdict that rests on a supplied score cannot be rebuilt from answers, so it has no link.
  const scored = { proposal: PROPOSAL, confirmed: true, scores: { strategic_alignment: 70, financial_return: 70, change_enablement: 70, governance_risk: 30 }, answers: { work_architecture: 'd' as const } };
  assert.equal(briefUrlFor(scored, assessInitiative(scored), '2026-11-21'), undefined);
  assert.equal(briefUrlFor(ownerInput, assessInitiative({ proposal: PROPOSAL }), '2026-11-21'), undefined, 'no verdict, no link');
  assert.throws(() => briefUrl({ context: { industry: 'retail', function: 'cx', ai_tier: 'gen3', employees: 400 }, answers: {}, date: 'today' }), /YYYY-MM-DD/);
});

test('the operating brief names the tool fields it relies on and keeps the house voice', () => {
  for (const field of ['assess_ai_initiative', 'answered_by', 'evidence', 'confirmed', 'where_to_look', 'brief_url', 'review', 'unknown']) {
    assert.ok(AGENT_BRIEF.includes(field), `the brief does not mention ${field}`);
  }
  assert.ok(AGENT_BRIEF.includes(AGENT_CONNECTOR_URL));
  assert.ok(AGENT_BRIEF.includes('Evidence or unknown.'));
  assert.ok(!AGENT_BRIEF.includes('—'), 'em-dash found');
  for (const banned of ['boardroom', 'leverage', 'crucial', 'pivotal', 'seamless', 'utilize', 'unlock', 'harness', 'robust', 'delve', 'perhaps', 'maybe']) {
    assert.ok(!AGENT_BRIEF.toLowerCase().includes(banned), `banned word: ${banned}`);
  }
  assert.ok(AGENT_BRIEF.length < 4000, 'the brief has to stay short enough to paste into any assistant');
});
