import test from 'node:test';
import assert from 'node:assert/strict';
import { assessInitiative, CONTEXT_CHOICES } from './assessInitiative.js';
import {
  FIRST_STEP, GO_AHEAD_STEP, QUESTION_SHORT, QUESTION_WHY, WORDING, WORK_PART_WORDING,
} from './guidedQuestions.js';
import { mapToTaxonomy } from './aliases.js';

const firm = 'We are a 12 person MSP. We want an AI agent to triage helpdesk tickets.';
const bank = 'A bank with 9,000 employees wants autonomous agents in customer service.';
const ok = { confirmed: true };
const clear = { financial_return: 'c', governance_risk: 'c', strategic_alignment: 'c', change_enablement: 'c' } as const;

test('a stop says why in the words of the answer that caused it', () => {
  const v = assessInitiative({ proposal: firm, ...ok, answers: { financial_return: 'a' } }).verdict!;
  assert.equal(v.classification, 'Stop');
  assert.equal(v.summary, 'Stop. It costs more than it saves.');
  assert.deepEqual(v.holding_back, [{
    id: 'financial_return',
    short: 'Cost and return',
    question: 'What does it cost each month, and what does it save or earn?',
    answer: 'It costs more than it saves.',
    needed: 'It pays for itself within two years, on numbers we have checked.',
  }]);
  assert.equal(v.first_step, 'Write down what it costs each month and what it saves, and check the numbers.');
  // The framework reason stays for callers that read it.
  assert.equal(v.reason, 'Financial return too thin to justify scope.');
});

test('the answer that stops the initiative leads, whatever order the questions came in', () => {
  const v = assessInitiative({ proposal: firm, ...ok, answers: { financial_return: 'b', governance_risk: 'a' } }).verdict!;
  assert.equal(v.classification, 'Stop');
  assert.deepEqual(v.holding_back.map((h) => h.id), ['governance_risk', 'financial_return']);
  assert.equal(v.summary, 'Stop. It deals with customers, money or personal data, and nobody checks it.');
  assert.equal(v.first_step, FIRST_STEP.smaller_firm.governance_risk);
});

test('a fix counts what holds it back and names the first thing to do', () => {
  const one = assessInitiative({ proposal: firm, ...ok, answers: { ...clear, change_enablement: 'b' } }).verdict!;
  assert.equal(one.classification, 'Fix');
  assert.equal(one.summary, 'Fix one thing before you go ahead.');
  assert.deepEqual(one.holding_back.map((h) => h.id), ['change_enablement']);
  assert.equal(one.holding_back[0].answer, 'Someone is named, on top of their normal job.');
  assert.equal(one.holding_back[0].needed, 'Someone is named and has time set aside.');
  assert.equal(one.first_step, 'Name who makes this happen and set time aside for them.');

  const three = assessInitiative({ proposal: firm, ...ok, answers: { financial_return: 'b', governance_risk: 'b', strategic_alignment: 'c', change_enablement: 'b' } }).verdict!;
  assert.equal(three.summary, 'Fix three things before you go ahead.');
  assert.deepEqual(three.holding_back.map((h) => h.id), ['financial_return', 'governance_risk', 'change_enablement']);
  assert.equal(three.first_step, FIRST_STEP.smaller_firm.financial_return);
});

test('a gap in the work redesign names the first part still to change', () => {
  const measures = assessInitiative({ proposal: firm, ...ok, answers: { ...clear, work_architecture: 'c' } }).verdict!;
  assert.equal(measures.classification, 'Fix');
  assert.equal(measures.summary, 'Fix one thing before you go ahead.');
  assert.deepEqual(measures.holding_back, [{
    id: 'work_architecture',
    short: 'How the work changes',
    question: 'What changes in how the work gets done?',
    answer: 'We have rewritten the steps, who does what, and who decides or overrides.',
    needed: 'All four: the steps, who does what, who decides, and how we judge good work.',
  }]);
  assert.equal(measures.first_step, 'Change how good work is judged, so people are measured on the new way of working.');

  const nothing = assessInitiative({ proposal: firm, ...ok, answers: { ...clear, work_architecture: 'a' } }).verdict!;
  assert.equal(nothing.first_step, 'Write down the new steps of the job, with the AI in them.');

  const unsure = assessInitiative({ proposal: firm, ...ok, answers: { ...clear, work_architecture: 'unknown' } }).verdict!;
  assert.equal(unsure.classification, 'Fix');
  assert.equal(unsure.holding_back[0].answer, 'I do not know yet.');
  assert.equal(unsure.first_step, WORK_PART_WORDING.smaller_firm.workflow_redesigned.step);
});

test('a go-ahead holds nothing back', () => {
  const v = assessInitiative({ proposal: firm, ...ok, answers: { ...clear, work_architecture: 'd' } }).verdict!;
  assert.equal(v.classification, 'Accelerate');
  assert.equal(v.summary, 'Go ahead. Your answers clear the bar on every question.');
  assert.deepEqual(v.holding_back, []);
  assert.equal(v.first_step, GO_AHEAD_STEP);
});

test('larger organisations get the same result in their own wording', () => {
  const v = assessInitiative({ proposal: bank, ...ok, answers: { governance_risk: 'd', financial_return: 'd', strategic_alignment: 'd', change_enablement: 'd', work_architecture: 'b' } }).verdict!;
  assert.equal(v.classification, 'Fix');
  assert.equal(v.holding_back[0].short, 'Redesign of the work');
  assert.equal(v.holding_back[0].needed, WORDING.enterprise.work_architecture.d);
  assert.equal(v.first_step, 'Rewrite the affected roles and accountabilities.');
});

test('supplied scores and work checks produce a plain result with no answer wording to quote', () => {
  const stop = assessInitiative({ proposal: bank, ...ok, scores: { governance_risk: 82 } }).verdict!;
  assert.equal(stop.summary, 'Stop. The risk is above the level where this can go ahead.');
  assert.equal(stop.holding_back[0].answer, 'A score of 82 out of 100.');
  assert.equal(stop.holding_back[0].needed, 'A score of 40 or less.');

  const thin = assessInitiative({ proposal: bank, ...ok, scores: { financial_return: 10 } }).verdict!;
  assert.equal(thin.summary, 'Stop. The return is too thin for the cost.');
  assert.equal(thin.holding_back[0].needed, 'A score of 60 or more.');

  const gap = assessInitiative({
    proposal: bank, ...ok,
    scores: { strategic_alignment: 75, financial_return: 70, change_enablement: 70, governance_risk: 30 },
    work_architecture: { workflow_redesigned: true, roles_redesigned: false, decision_rights_defined: true, measures_updated: false },
  }).verdict!;
  assert.equal(gap.classification, 'Fix');
  assert.equal(gap.holding_back[0].answer, 'Still to change: the roles, the measures people are judged on.');
  assert.equal(gap.first_step, 'Rewrite the affected roles and accountabilities.');
});

test('each question says why it matters as the rule the engine applies, in the wording for the size', () => {
  const small = assessInitiative({ proposal: firm, ...ok });
  assert.equal(small.question?.why, 'If it costs more than it saves, the answer is stop.');
  const large = assessInitiative({ proposal: bank, ...ok });
  assert.equal(large.question?.why, 'Risk that nobody controls stops the initiative on its own.');
  const unknown = assessInitiative({ proposal: firm, ...ok, answers: { financial_return: 'unknown', governance_risk: 'c', strategic_alignment: 'c', change_enablement: 'unknown' } });
  assert.deepEqual(unknown.to_find_out?.map((f) => f.why), [QUESTION_WHY.smaller_firm.financial_return, QUESTION_WHY.smaller_firm.change_enablement]);
});

test('the context choices are ordered for a form and match the wording the engine reads back', () => {
  assert.equal(CONTEXT_CHOICES.industry.length, 14);
  assert.equal(CONTEXT_CHOICES.industry.at(-1)?.id, 'universal');
  const names = CONTEXT_CHOICES.industry.slice(0, -1).map((c) => c.label.toLowerCase());
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.deepEqual(CONTEXT_CHOICES.ai_tier.map((c) => c.id), ['gen1', 'gen2', 'gen3']);
  assert.equal(CONTEXT_CHOICES.function.length, 8);
  const asked = assessInitiative({ proposal: 'We want to use AI to improve an internal process.' });
  assert.deepEqual(asked.question?.choices, CONTEXT_CHOICES.industry);
});

test('every plain string is free of dashes, framework terms and banned vocabulary', () => {
  const blobs: string[] = [GO_AHEAD_STEP];
  for (const track of ['smaller_firm', 'enterprise'] as const) {
    blobs.push(...Object.values(QUESTION_WHY[track]), ...Object.values(QUESTION_SHORT[track]), ...Object.values(FIRST_STEP[track]));
    for (const part of Object.values(WORK_PART_WORDING[track])) blobs.push(part.name, part.step);
  }
  const proposals = [firm, bank];
  const choices = ['a', 'b', 'c', 'd'] as const;
  for (const proposal of proposals) {
    for (const fr of choices) for (const gr of choices) {
      const r = assessInitiative({ proposal, ...ok, answers: { financial_return: fr, governance_risk: gr, strategic_alignment: 'c', change_enablement: 'b', work_architecture: 'b' } });
      if (r.verdict) blobs.push(r.verdict.summary, r.verdict.first_step, ...r.verdict.holding_back.flatMap((h) => [h.short, h.answer, h.needed]));
    }
  }
  const text = blobs.join('\n');
  assert.doesNotMatch(text, /[—–]/);
  assert.doesNotMatch(text, /work architecture|pillar|governance risk|strategic alignment|change enablement|financial return|Accelerate/i);
  for (const banned of ['boardroom', 'leverage', 'crucial', 'pivotal', 'seamless', 'utilize', 'unlock', 'robust', 'perhaps', 'maybe']) {
    assert.ok(!text.toLowerCase().includes(banned), `banned word found: ${banned}`);
  }
});

test('three phrases the review page relies on resolve to one value', () => {
  assert.equal(mapToTaxonomy({ industry: 'A traditional property company with EUR 600m revenue wants automation for accounts payable.' }).industry?.resolved, 'real_estate');
  assert.equal(mapToTaxonomy({ industry: 'A traditional general business with EUR 500m revenue wants a GenAI assistant for finance.' }).industry?.resolved, 'universal');
  assert.equal(mapToTaxonomy({ function: 'An agile SaaS company with EUR 400m revenue wants an agentic system for platform operations.' }).function?.resolved, 'it');
});
