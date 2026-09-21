import test from 'node:test';
import assert from 'node:assert/strict';
import { assessInitiative, extractRevenueEur } from './assessInitiative.js';

const examples = [
  {
    proposal: 'We are a 300 million euro retailer, a traditional organisation, considering a GenAI assistant for customer service.',
    expected: { industry: 'retail', revenue_eur: 300_000_000, function: 'cx', ai_tier: 'gen2', readiness: 'traditional' },
  },
  {
    proposal: 'A siloed hospital group with EUR 1.2 billion revenue is considering an agentic prior-authorisation agent for compliance.',
    expected: { industry: 'healthcare', revenue_eur: 1_200_000_000, function: 'risk', ai_tier: 'gen3', readiness: 'siloed' },
  },
  {
    proposal: 'An established bank with annual revenue of EUR 2bn wants RPA automation for accounts payable.',
    expected: { industry: 'financial', revenue_eur: 2_000_000_000, function: 'finance', ai_tier: 'gen1', readiness: 'traditional' },
  },
];

test('extractRevenueEur reads common EUR business formats', () => {
  assert.equal(extractRevenueEur('a EUR 300m retailer'), 300_000_000);
  assert.equal(extractRevenueEur('turnover of 1.2 billion'), 1_200_000_000);
  assert.equal(extractRevenueEur('300 million euro retailer'), 300_000_000);
});

test('prepared sector examples resolve and return a deterministic verdict', () => {
  for (const example of examples) {
    const first = assessInitiative({ proposal: example.proposal });
    const second = assessInitiative({ proposal: example.proposal });
    assert.equal(first.status, 'verdict');
    assert.deepEqual(first.resolved_inputs, example.expected);
    assert.ok(first.verdict);
    assert.deepEqual(second, first);
  }
});

test('asks one question when a required field is missing', () => {
  const result = assessInitiative({
    proposal: 'A traditional retailer wants a GenAI assistant for customer service.',
  });
  assert.equal(result.status, 'needs_input');
  assert.deepEqual(result.missing_fields, ['revenue_eur']);
  assert.equal(result.next_question, "What is the organisation's approximate annual revenue in EUR?");
  assert.equal(result.verdict, undefined);
});

test('provided values override proposal resolution', () => {
  const result = assessInitiative({
    proposal: 'A traditional retailer with EUR 300m revenue wants a GenAI assistant for customer service.',
    readiness: 'agile',
  });
  assert.equal(result.resolved_inputs.readiness, 'agile');
  assert.equal(result.status, 'verdict');
});

test('asks for every unresolved input in one clarification', () => {
  const result = assessInitiative({
    proposal: 'We want to use AI to improve an internal process.',
  });
  assert.equal(result.status, 'needs_input');
  assert.deepEqual(result.missing_fields, ['industry', 'revenue_eur', 'function', 'ai_tier', 'readiness']);
  assert.match(result.next_question ?? '', /industry/);
  assert.match(result.next_question ?? '', /annual revenue in EUR/);
  assert.match(result.next_question ?? '', /owning business function/);
  assert.match(result.next_question ?? '', /automation, GenAI, or agentic/);
  assert.match(result.next_question ?? '', /agile, traditional, or siloed/);
});

test('hyphenated industry aliases resolve inside a full proposal', () => {
  const nonprofit = assessInitiative({
    proposal: 'A traditional non-profit with EUR 100m revenue wants a GenAI assistant for recruiting.',
  });
  const universal = assessInitiative({
    proposal: 'A traditional cross-industry business with EUR 500m revenue wants a GenAI assistant for finance.',
  });
  assert.equal(nonprofit.status, 'verdict');
  assert.equal(nonprofit.resolved_inputs.industry, 'nonprofit');
  assert.equal(universal.status, 'verdict');
  assert.equal(universal.resolved_inputs.industry, 'universal');
});

test('returns the work architecture question when evidence is absent', () => {
  const result = assessInitiative({ proposal: examples[0].proposal });
  assert.equal(result.status, 'verdict');
  assert.equal(result.verdict?.work_architecture.status, 'unknown');
  assert.equal(result.verdict?.work_architecture.blocks_accelerate, true);
  assert.equal(result.verdict?.work_architecture.unknowns.length, 4);
  assert.ok(result.verdict?.work_architecture.next_question?.includes('affected roles'));
});

test('unknown work architecture blocks an otherwise Accelerate verdict', () => {
  const result = assessInitiative({
    proposal: examples[0].proposal,
    scores: { strategic_alignment: 80, financial_return: 75, change_enablement: 70, governance_risk: 30 },
  });
  assert.equal(result.status, 'verdict');
  assert.equal(result.verdict?.classification, 'Fix');
  assert.equal(result.verdict?.work_architecture.status, 'unknown');
  assert.ok(result.verdict?.reason.includes('not evidenced'));
  assert.ok(result.verdict?.audit.rules_fired.includes('gate:work_architecture_gap'));
});

test('a stated work architecture gap blocks an otherwise Accelerate verdict', () => {
  const result = assessInitiative({
    proposal: examples[0].proposal,
    scores: { strategic_alignment: 80, financial_return: 75, change_enablement: 70, governance_risk: 30 },
    work_architecture: {
      workflow_redesigned: true,
      roles_redesigned: false,
      decision_rights_defined: true,
      measures_updated: false,
    },
  });
  assert.equal(result.status, 'verdict');
  assert.equal(result.verdict?.classification, 'Fix');
  assert.deepEqual(result.verdict?.work_architecture.gaps, [
    'affected roles and accountabilities redesigned',
    'performance measures and incentives updated',
  ]);
  assert.deepEqual(result.verdict?.work_architecture.unknowns, []);
  assert.ok(result.verdict?.audit.rules_fired.includes('gate:work_architecture_gap'));
});

test('evidenced work architecture allows the four pillars to return Accelerate', () => {
  const result = assessInitiative({
    proposal: examples[0].proposal,
    scores: { strategic_alignment: 80, financial_return: 75, change_enablement: 70, governance_risk: 30 },
    work_architecture: {
      workflow_redesigned: true,
      roles_redesigned: true,
      decision_rights_defined: true,
      measures_updated: true,
    },
  });
  assert.equal(result.verdict?.classification, 'Accelerate');
  assert.equal(result.verdict?.work_architecture.status, 'ready');
  assert.deepEqual(result.verdict?.work_architecture.unknowns, []);
  assert.equal(result.verdict?.work_architecture.next_question, undefined);
});
