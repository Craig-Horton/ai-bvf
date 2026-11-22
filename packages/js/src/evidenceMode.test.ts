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
  assert.deepEqual(verdict.answers_given.governance_risk?.evidence, [QUOTES.governance_risk]);
  const risk = verdict.holding_back.find((item) => item.id === 'governance_risk');
  assert.deepEqual(risk?.evidence, [QUOTES.governance_risk], 'what holds it back carries the words it rests on');
  assert.ok(verdict.audit.rules_fired.includes('answered_by:evidence'));
  assert.ok(verdict.audit.rules_fired.includes('evidence:governance_risk'));
  assert.deepEqual((verdict.audit.inputs_used as any).evidence_sources.financial_return, [QUOTES.financial_return.source]);
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

test('the refusal of the four work checks says how to answer instead', () => {
  assert.throws(
    () => assessInitiative({ ...base, work_architecture: { workflow_redesigned: true } }),
    /answer work_architecture in answers with a to d, and quote it in evidence/,
  );
});

test('an agent is shown every open question with its choices, so it answers all five in one call', () => {
  const first = assessInitiative(base);
  assert.equal(first.status, 'not_enough_to_judge');
  assert.deepEqual(first.open_questions?.map((q) => q.id).sort(), ['change_enablement', 'financial_return', 'governance_risk', 'strategic_alignment', 'work_architecture']);
  for (const q of first.open_questions!) {
    assert.deepEqual(q.choices.map((c) => c.id), ['a', 'b', 'c', 'd', 'unknown'], `${q.id} lists its choices`);
    assert.ok(q.where_to_look.length > 20, `${q.id} says where to look`);
    assert.equal(q.answer_in, `answers.${q.id}`);
  }
  // The four pillars alone give the verdict. The question on how the work changes stays open, and says so.
  const { work_architecture: _work, ...four } = ANSWERS;
  const judged = assessInitiative({ ...base, answers: four, evidence: QUOTES });
  assert.equal(judged.status, 'verdict');
  assert.deepEqual(judged.open_questions?.map((q) => q.id), ['work_architecture']);
  assert.equal(judged.verdict!.answers_given.work_architecture, undefined);
  // Answered from the choices shown, it is kept with its quote and the verdict stands.
  const full = assessInitiative({ ...base, answers: ANSWERS, evidence: QUOTES });
  assert.equal(full.open_questions, undefined);
  assert.equal(full.verdict!.classification, judged.verdict!.classification);
  assert.deepEqual(full.verdict!.answers_given.work_architecture?.evidence, [QUOTES.work_architecture]);
});

test('a question answered unknown, or with no quote, stays in the open list', () => {
  const result = assessInitiative({ ...base, answers: { ...ANSWERS, work_architecture: 'unknown', change_enablement: 'c' }, evidence: { ...QUOTES, change_enablement: undefined as any } });
  assert.deepEqual(result.open_questions?.map((q) => q.id), ['change_enablement', 'work_architecture']);
});

test('a person is asked one question at a time and never sees the open list', () => {
  const result = assessInitiative({ proposal: PROPOSAL, confirmed: true });
  assert.equal(result.status, 'not_enough_to_judge');
  assert.equal(result.open_questions, undefined);
  const judged = assessInitiative({ proposal: PROPOSAL, confirmed: true, answers: { financial_return: 'c', governance_risk: 'b', strategic_alignment: 'c', change_enablement: 'c' } });
  assert.equal(judged.status, 'verdict');
  assert.equal(judged.open_questions, undefined);
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

test('an answer that rests on two documents carries a quote from each, with its own source', () => {
  const calm = 'We are a 400-person online retailer. We want GenAI to draft replies to customer queries.';
  const all = { financial_return: 'd', governance_risk: 'd', strategic_alignment: 'd', change_enablement: 'd', work_architecture: 'd' } as const;
  const design = { quote: 'The new workflow is drawn end to end. The roles are rewritten. Override rights are set.', source: 'Process design, 10 November 2026' };
  const measures = { quote: 'From January the returns team is measured on first response time and on reversed refunds.', source: 'Steering minutes, 10 December 2026' };
  const input = { ...base, proposal: calm, answers: all, evidence: { ...QUOTES, work_architecture: [design, measures] } };
  const result = assessInitiative(input);
  assert.equal(result.verdict!.classification, 'Accelerate');
  assert.deepEqual(result.verdict!.answers_given.work_architecture?.evidence, [design, measures]);
  assert.deepEqual((result.verdict!.audit.inputs_used as any).evidence_sources.work_architecture, [design.source, measures.source]);
  const carried = JSON.parse(Buffer.from(briefUrlFor(input, result, '2026-11-21')!.split('#')[1], 'base64url').toString('utf8'));
  assert.deepEqual(carried.q.work_architecture, [[design.quote, design.source], [measures.quote, measures.source]]);

  // No more than three quotes are kept, and an entry that is no evidence is dropped.
  const many = assessInitiative({ ...input, evidence: { ...QUOTES, work_architecture: [design, { quote: 'ok', source: 'x' }, measures, design, measures] } });
  assert.equal(many.verdict!.answers_given.work_architecture?.evidence?.length, 3);
  const none = assessInitiative({ ...input, evidence: { ...QUOTES, work_architecture: [{ quote: 'ok', source: 'x' }] } });
  assert.deepEqual(none.evidence_missing, ['work_architecture']);

  // The second quote is read as closely as the first.
  const second = assessInitiative({ ...input, evidence: { ...QUOTES, work_architecture: [design, { quote: 'It is a bolt-on to the existing process for now.', source: 'Vendor note, 2 December 2026' }] } });
  assert.equal(second.verdict!.classification, 'Fix');
  assert.equal(second.verdict!.contradictions[0].found_in, 'evidence');
  assert.equal(second.verdict!.contradictions[0].proposal_words, 'bolt-on');
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
  assert.deepEqual(data.q.governance_risk, [[QUOTES.governance_risk.quote, QUOTES.governance_risk.source]]);
  assert.equal(data.p, undefined, 'the wording of the proposal stays out unless the owner says otherwise');
  // A quote pasted with line breaks travels as the engine kept it: one line, trimmed.
  const untidy = { ...input, evidence: { ...QUOTES, governance_risk: { quote: '  Refund limits to be agreed\n\nafter the pilot. ', source: ' Steering minutes,\n12 November 2026 ' } } };
  const tidy = JSON.parse(Buffer.from(briefUrlFor(untidy, assessInitiative(untidy), '2026-11-21')!.split('#')[1], 'base64url').toString('utf8'));
  assert.deepEqual(tidy.q.governance_risk, [['Refund limits to be agreed after the pilot.', 'Steering minutes, 12 November 2026']]);
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
  for (const field of ['assess_ai_initiative', 'answered_by', 'evidence', 'confirmed', 'where_to_look', 'open_questions', 'brief_url', 'review', 'unknown']) {
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

test('the brief takes a direct instruction to run as consent, and keeps the brief link whole', () => {
  assert.ok(AGENT_BRIEF.includes('When the owner has told you directly to run, that is consent'), 'a direct instruction has to count as consent');
  assert.ok(AGENT_BRIEF.includes('Otherwise ask the owner once'), 'with no instruction to run, the agent still asks once');
  assert.ok(AGENT_BRIEF.includes('The owner can change the mandate at any time.'));
  assert.ok(AGENT_BRIEF.includes('behind the words "Open the brief"'), 'the long link has to sit behind short words where the chat allows');
  assert.ok(AGENT_BRIEF.includes('never pass it to a link shortener'), 'a shortener would hand the quotes to a third party');
});

test('choice b asks for figures on cost and return, and for the organisation on the business result', () => {
  // Seven replies from four assistants split on these two choices. An opinion with no figure,
  // and a vendor's claim about its other clients, are both "I do not know yet".
  const open = assessInitiative({ proposal: PROPOSAL, confirmed: true, answered_by: 'evidence' }).open_questions ?? [];
  const label = (id: string) => open.find((question) => question.id === id)?.choices.find((choice) => choice.id === 'b')?.label ?? '';
  assert.match(label('financial_return'), /written down in figures/);
  assert.match(label('strategic_alignment'), /^The organisation has named a result/);

  const small = assessInitiative({ proposal: 'We are a 40-person retailer and we want a GenAI chatbot to draft replies in customer service.', confirmed: true, answered_by: 'evidence' }).open_questions ?? [];
  assert.match(small.find((question) => question.id === 'financial_return')?.choices.find((choice) => choice.id === 'b')?.label ?? '', /rough numbers that nobody has checked/);
});
