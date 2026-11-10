import test from 'node:test';
import assert from 'node:assert/strict';
import { assessInitiative, extractEmployees } from './assessInitiative.js';
import { CHOICE_SCORES, WORDING } from './guidedQuestions.js';

const firm = 'We are a 40-person accountancy firm and we want a chatbot to speed up our month-end bookkeeping.';
const bank = 'A bank with 9,000 employees wants autonomous agents in customer service.';
const retailer = 'A retailer with 3,000 staff wants a GenAI assistant for customer service.';
const ok = { confirmed: true };

// ── context ────────────────────────────────────────────────────────────────

test('the front door needs industry, function, AI type and headcount, and nothing about revenue or operating model', () => {
  const r = assessInitiative({ proposal: firm });
  assert.deepEqual(r.resolved_inputs, { industry: 'professional', function: 'finance', ai_tier: 'gen2', employees: 40, track: 'smaller_firm' });
  assert.deepEqual(r.missing_fields, []);
  assert.deepEqual(r.inferred_fields, ['industry', 'function', 'ai_tier', 'employees']);
  assert.doesNotMatch(JSON.stringify(r), /revenue|readiness|agile|siloed/);
});

test('missing context is asked for one item at a time, with choices in everyday words', () => {
  const first = assessInitiative({ proposal: 'We want to use AI to improve an internal process.' });
  assert.equal(first.status, 'needs_input');
  assert.deepEqual(first.missing_fields, ['industry', 'function', 'ai_tier', 'employees']);
  assert.equal(first.next_question, 'Which industry is the organisation in?');
  assert.equal(first.question?.id, 'industry');
  assert.equal(first.question?.answer_in, 'industry');
  assert.ok(first.question?.choices?.some((c) => c.id === 'professional' && c.label === 'professional services'));

  const second = assessInitiative({ proposal: first.proposal, industry: 'retail' });
  assert.equal(second.next_question, 'Which part of the business will use it?');
  const third = assessInitiative({ proposal: first.proposal, industry: 'retail', function: 'customer service' });
  assert.equal(third.question?.id, 'ai_tier');
  assert.deepEqual(third.question?.choices?.map((c) => c.id), ['gen1', 'gen2', 'gen3']);
  const fourth = assessInitiative({ proposal: first.proposal, industry: 'retail', function: 'customer service', ai_tier: 'chatbot' });
  assert.equal(fourth.next_question, 'How many people work in the organisation?');
  assert.equal(fourth.question?.choices, undefined);
});

test('a two-way reading is asked as a choice between the two', () => {
  const r = assessInitiative({ proposal: 'A software company with 80 employees selling to hospitals wants a copilot for customer service.' });
  assert.equal(r.status, 'needs_input');
  assert.equal(r.next_question, 'The proposal points to more than one industry: healthcare or technology. Which one applies?');
  assert.deepEqual(r.question?.choices?.map((c) => c.id), ['healthcare', 'technology']);
  assert.deepEqual(r.ambiguous_fields, { industry: ['healthcare', 'technology'] });
});

test('headcount is read from descriptions of the organisation and never from a bare group of people', () => {
  assert.equal(extractEmployees('We are a 40-person accountancy firm.')?.value, 40);
  assert.equal(extractEmployees('We are a 12 person MSP.')?.value, 12);
  assert.equal(extractEmployees('Copilot for all 600 staff.')?.value, 600);
  assert.equal(extractEmployees('A bank with 9,000 employees.')?.value, 9000);
  assert.equal(extractEmployees('A design agency of 9 people.')?.value, 9);
  assert.equal(extractEmployees('We want AI to help 40 people in finance.'), undefined);
  assert.equal(extractEmployees('A 2 billion euro bank.'), undefined);
  assert.equal(extractEmployees('We have 300 staff in the UK and 80 staff in Spain.'), undefined);
  const padded = `A retailer wants a chatbot. ${`12${' '.repeat(20_000)}`.repeat(3)}people`;
  const started = performance.now();
  extractEmployees(padded);
  assert.ok(performance.now() - started < 1_000);
});

test('the size line sits at 250 people', () => {
  assert.equal(assessInitiative({ proposal: firm, employees: 249 }).resolved_inputs.track, 'smaller_firm');
  assert.equal(assessInitiative({ proposal: firm, employees: 250 }).resolved_inputs.track, 'enterprise');
});

// ── confirmation ───────────────────────────────────────────────────────────

test('the reading is confirmed before any question is asked', () => {
  const r = assessInitiative({ proposal: firm });
  assert.equal(r.status, 'needs_confirmation');
  assert.equal(r.understood, 'Read as: industry professional services; business function finance; AI type GenAI; 40 people, so the questions are worded for a smaller firm. Correct any item that is wrong.');
  assert.equal(r.next_question, 'Is this reading right? Confirm it, or correct any item.');
  assert.equal(r.question?.id, 'confirmation');
  assert.equal(r.decides, undefined);
  assert.equal(r.verdict, undefined);

  const corrected = assessInitiative({ proposal: firm, function: 'customer service' });
  assert.equal(corrected.status, 'needs_confirmation');
  assert.equal(corrected.resolved_inputs.function, 'cx');
  assert.ok(!corrected.inferred_fields.includes('function'));

  assert.equal(assessInitiative({ proposal: firm, ...ok }).status, 'not_enough_to_judge');
});

test('nothing read from the wording means nothing to confirm', () => {
  const r = assessInitiative({ proposal: 'An idea.', industry: 'retail', function: 'cx', ai_tier: 'gen2', employees: 30 });
  assert.deepEqual(r.inferred_fields, []);
  assert.equal(r.status, 'not_enough_to_judge');
});

// ── guided questions ───────────────────────────────────────────────────────

test('questions come one at a time, the two that can stop the initiative first', () => {
  const r = assessInitiative({ proposal: firm, ...ok });
  assert.equal(r.status, 'not_enough_to_judge');
  assert.equal(r.question?.id, 'financial_return');
  assert.equal(r.question?.number, 1);
  assert.equal(r.question?.of_at_most, 5);
  assert.equal(r.next_question, 'Not enough to judge yet. Question 1 of at most 5: What does it cost each month, and what does it save or earn?');
  assert.deepEqual(r.question?.choices?.map((c) => c.id), ['a', 'b', 'c', 'd', 'unknown']);
  assert.deepEqual(r.decides?.map((d) => d.id), ['financial_return', 'governance_risk', 'strategic_alignment']);
  assert.deepEqual(r.also_open, ['change_enablement', 'work_architecture']);

  const next = assessInitiative({ proposal: firm, ...ok, answers: { financial_return: 'c' } });
  assert.equal(next.question?.id, 'governance_risk');
  assert.equal(next.question?.number, 2);
  assert.equal(next.next_question, 'Question 2 of at most 5: What could go wrong, and who can step in?');
  assert.doesNotMatch(JSON.stringify(next), /net_value|gross_value|estimated|scores_used/);
});

test('smaller firms and larger organisations get different wording and the same scores', () => {
  const small = assessInitiative({ proposal: firm, ...ok });
  const large = assessInitiative({ proposal: retailer, ...ok });
  assert.equal(small.question?.question, 'What does it cost each month, and what does it save or earn?');
  assert.equal(large.question?.question, 'What does it cost to build and run, and what does it return each year?');
  assert.equal(small.question?.choices?.[2].label, 'It pays for itself within two years, on numbers we have checked.');
  assert.equal(large.question?.choices?.[2].label, 'The return covers the cost within two years, on figures finance has checked.');

  const answers = { financial_return: 'c', governance_risk: 'c', strategic_alignment: 'c', change_enablement: 'b' } as const;
  const smallVerdict = assessInitiative({ proposal: firm, ...ok, answers }).verdict;
  const largeVerdict = assessInitiative({ proposal: retailer, ...ok, answers }).verdict;
  assert.equal(smallVerdict?.classification, 'Fix');
  assert.equal(largeVerdict?.classification, 'Fix');
  assert.deepEqual(smallVerdict?.scores_supplied, largeVerdict?.scores_supplied);
  assert.equal(smallVerdict?.confidence, largeVerdict?.confidence);
});

test('every question has four answers in both wordings, and the scores sit on the right side of the thresholds', () => {
  for (const track of ['smaller_firm', 'enterprise'] as const) {
    for (const wording of Object.values(WORDING[track])) {
      for (const text of [wording.question, wording.a, wording.b, wording.c, wording.d]) {
        assert.ok(text.length > 5);
        assert.doesNotMatch(text, /[—–]/);
      }
    }
  }
  assert.ok(CHOICE_SCORES.financial_return.a <= 20);
  assert.ok(CHOICE_SCORES.governance_risk.a >= 70);
  for (const pillar of ['financial_return', 'strategic_alignment', 'change_enablement'] as const) {
    assert.ok(CHOICE_SCORES[pillar].b < 60 && CHOICE_SCORES[pillar].c >= 60);
  }
  assert.ok(CHOICE_SCORES.governance_risk.b > 40 && CHOICE_SCORES.governance_risk.c <= 40);
});

test('one answer can stop the initiative on its own, with no further questions', () => {
  const thin = assessInitiative({ proposal: firm, ...ok, answers: { financial_return: 'a' } });
  assert.equal(thin.status, 'verdict');
  assert.equal(thin.verdict?.classification, 'Stop');
  assert.equal(thin.verdict?.reason, 'Financial return too thin to justify scope.');
  assert.deepEqual(thin.verdict?.answers_given.financial_return, { choice: 'a', label: 'It costs more than it saves.', score: 15 });
  assert.equal(thin.verdict?.confidence, undefined);

  const risk = assessInitiative({ proposal: bank, ...ok, answers: { governance_risk: 'a' } });
  assert.equal(risk.verdict?.classification, 'Stop');
  assert.equal(risk.verdict?.reason, 'Governance risk above the safe threshold.');
});

test('agentic AI in a regulated setting asks governance first, with a warning', () => {
  const r = assessInitiative({ proposal: bank, ...ok });
  assert.equal(r.status, 'not_enough_to_judge');
  assert.equal(r.question?.id, 'governance_risk');
  assert.equal(r.warning, 'Agentic AI in a regulated setting cannot proceed until its controls are shown. Answer the governance question first.');
  const answered = assessInitiative({ proposal: bank, ...ok, answers: { governance_risk: 'c' } });
  assert.equal(answered.warning, undefined);
  assert.equal(answered.question?.id, 'financial_return');
});

test('four answers that do not clear the bar return Fix without asking about work redesign', () => {
  const r = assessInitiative({
    proposal: firm, ...ok,
    answers: { financial_return: 'c', governance_risk: 'c', strategic_alignment: 'c', change_enablement: 'b' },
  });
  assert.equal(r.status, 'verdict');
  assert.equal(r.verdict?.classification, 'Fix');
  assert.equal(r.verdict?.reason, 'Workable, but change enablement is a risk. Close the gap before scaling.');
  assert.ok(r.verdict?.verdict_flips?.length);
  assert.match(r.verdict?.value_note ?? '', /own volumes, hours and costs/);
  assert.ok(r.verdict?.audit.rules_fired.includes('track:smaller_firm'));
  assert.ok(r.verdict?.audit.rules_fired.includes('answer:change_enablement=b(45)'));
  assert.ok(r.verdict?.audit.rules_fired.includes('front_door:value_withheld'));
  assert.doesNotMatch(JSON.stringify(r), /net_value|gross_value|revenue|estimated/);
});

test('four answers that clear the bar bring the fifth question, and all four parts of the work redesign unlock Accelerate', () => {
  const answers = { financial_return: 'd', governance_risk: 'd', strategic_alignment: 'c', change_enablement: 'c' } as const;
  const fifth = assessInitiative({ proposal: firm, ...ok, answers });
  assert.equal(fifth.status, 'not_enough_to_judge');
  assert.equal(fifth.question?.id, 'work_architecture');
  assert.equal(fifth.question?.number, 5);
  assert.equal(fifth.question?.question, 'What changes in how the work gets done?');

  const go = assessInitiative({ proposal: firm, ...ok, answers: { ...answers, work_architecture: 'd' } });
  assert.equal(go.verdict?.classification, 'Accelerate');
  assert.equal(go.verdict?.work_architecture.status, 'ready');

  const partly = assessInitiative({ proposal: firm, ...ok, answers: { ...answers, work_architecture: 'b' } });
  assert.equal(partly.verdict?.classification, 'Fix');
  assert.ok(partly.verdict?.audit.rules_fired.includes('gate:work_architecture_gap'));

  const unsure = assessInitiative({ proposal: firm, ...ok, answers: { ...answers, work_architecture: 'unknown' } });
  assert.equal(unsure.verdict?.classification, 'Fix');
  assert.ok(unsure.verdict?.reason.includes('not evidenced'));
});

test('"I do not know yet" fills nothing in: the question stays open and is listed to find out', () => {
  const r = assessInitiative({ proposal: firm, ...ok, answers: { financial_return: 'unknown' } });
  assert.equal(r.status, 'not_enough_to_judge');
  assert.equal(r.question?.id, 'governance_risk');
  assert.equal(r.question?.number, 2);
  assert.deepEqual(r.to_find_out?.map((d) => d.id), ['financial_return']);

  const done = assessInitiative({
    proposal: firm, ...ok,
    answers: { financial_return: 'unknown', governance_risk: 'c', strategic_alignment: 'c', change_enablement: 'unknown' },
  });
  assert.equal(done.status, 'not_enough_to_judge');
  assert.equal(done.question, undefined);
  assert.equal(done.verdict, undefined);
  assert.equal(done.next_question, 'Not enough to judge yet. Find out and come back: 1. What does it cost each month, and what does it save or earn? 2. Who makes this happen, and do they have the time?');
});

test('an answer outside the choices is refused', () => {
  assert.throws(() => assessInitiative({ proposal: firm, ...ok, answers: { financial_return: 'z' as never } }), /must be one of a, b, c, d or unknown/);
});

// ── callers that already hold scores ───────────────────────────────────────

const allFour = { strategic_alignment: 75, financial_return: 70, change_enablement: 70, governance_risk: 30 };
const ready = { workflow_redesigned: true, roles_redesigned: true, decision_rights_defined: true, measures_updated: true };

test('supplied 0 to 100 scores still work and take precedence over an answer', () => {
  const go = assessInitiative({ proposal: retailer, ...ok, scores: allFour, work_architecture: ready });
  assert.equal(go.verdict?.classification, 'Accelerate');
  assert.equal(go.verdict?.confidence, 71);
  assert.deepEqual(go.verdict?.scores_supplied, allFour);
  assert.deepEqual(go.verdict?.answers_given, {});

  const gap = assessInitiative({
    proposal: retailer, ...ok, scores: allFour,
    work_architecture: { workflow_redesigned: true, roles_redesigned: false, decision_rights_defined: true, measures_updated: true },
  });
  assert.equal(gap.verdict?.classification, 'Fix');
  assert.deepEqual(gap.verdict?.work_architecture.gaps, ['affected roles and accountabilities redesigned']);

  const mixed = assessInitiative({ proposal: retailer, ...ok, scores: { governance_risk: 82 }, answers: { governance_risk: 'd' } });
  assert.equal(mixed.verdict?.classification, 'Stop');
  assert.deepEqual(mixed.verdict?.scores_supplied, { governance_risk: 82 });
});

test('the same input returns the same result', () => {
  const input = { proposal: firm, ...ok, answers: { financial_return: 'c', governance_risk: 'b' } } as const;
  assert.deepEqual(assessInitiative(input), assessInitiative(input));
});
