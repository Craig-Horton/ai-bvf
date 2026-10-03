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


test('revenue extraction separates company revenue from initiative costs and benefits', () => {
  for (const proposal of [
    'A EUR 250k pilot for a retailer with EUR 300m annual revenue.',
    'Pilot EUR 250k; company annual revenue EUR 300m.',
    'Company revenue EUR 300 million; implementation costs EUR 250k.',
    'Project adds EUR 2m incremental revenue; company revenue is EUR 300m.',
    'Project revenue EUR 2m; company turnover EUR 300m.',
  ]) {
    assert.equal(extractRevenueEur(proposal), 300_000_000, proposal);
  }
  for (const proposal of [
    'Pilot cost EUR 250k; annual operating cost EUR 50k.',
    'Company revenue is undisclosed; project budget EUR 250k.',
    'We expect EUR 2m incremental revenue from the project.',
    'An investment of EUR 2m in a traditional retailer.',
    'Annual revenue USD 300m; project budget EUR 250k.',
    'Revenue 300 million dollars; a EUR 250k pilot.',
    'Company revenue 300m BRL.',
    'Company revenue 300m rupees.',
  ]) {
    assert.equal(extractRevenueEur(proposal), undefined, proposal);
  }
});

test('conflicting amounts require clarification while repeated equivalent revenue resolves', () => {
  for (const proposal of [
    'Annual revenue EUR 300m; annual revenue EUR 400m.',
    'Revenue EUR 300m in 2024 and EUR 350m in 2025.',
    'Revenue EUR 300m EUR 400m.',
    'An EUR 300m retailer and an EUR 400m bank.',
    'Revenue EUR 300m and an unexplained EUR 250k.',
    'Revenue EUR 300-400m.',
    'Revenue EUR 300m to EUR 400m.',
    'Revenue EUR 300m or 400m.',
  ]) {
    assert.equal(extractRevenueEur(proposal), undefined, proposal);
  }
  assert.equal(
    extractRevenueEur('Annual revenue EUR 300m, also reported as EUR 300,000,000.'),
    300_000_000,
  );
});

test('revenue extraction handles full scales, decimal commas and grouped EUR amounts', () => {
  for (const [proposal, expected] of [
    ['A EUR300m retailer.', 300_000_000],
    ['Annual revenue EUR 1.5 billion.', 1_500_000_000],
    ['Annual revenue EUR 1,5 million.', 1_500_000],
    ['Annual revenue EUR 1,500,000.50.', 1_500_001],
    ['Annual revenue EUR 1.500.000,50.', 1_500_001],
    ['Annual revenue EUR 1 500 000.', 1_500_000],
    ['Annual revenue EUR\u202f1\u202f500\u202f000.', 1_500_000],
    ['Annual turnover: 2bn.', 2_000_000_000],
    ['Annual turnover: EUR 250 thousand.', 250_000],
    ['Annual revenue EUR 0.', 0],
    ['Annual revenue EUR 300 monthly.', 300],
  ] as const) {
    assert.equal(extractRevenueEur(proposal), expected, proposal);
  }
  for (const proposal of [
    'Annual revenue EUR 1,200 million.',
    'Annual revenue EUR 1,20,000.',
    'Annual revenue EUR 12 34 567.',
    'Annual revenue EUR 300m2.',
    'Annual revenue -EUR 300m.',
    'Annual revenue EUR 999999999999999999999 billion.',
  ]) {
    assert.equal(extractRevenueEur(proposal), undefined, proposal);
  }
});

test('assessment asks for company revenue when the only amount is a project budget', () => {
  const result = assessInitiative({
    proposal: 'A traditional retailer wants a GenAI assistant for customer service with a project budget of EUR 250k.',
  });
  assert.equal(result.status, 'needs_input');
  assert.deepEqual(result.missing_fields, ['revenue_eur']);
  assert.equal(result.next_question, "What is the organisation's approximate annual revenue in EUR?");
  assert.equal(result.verdict, undefined);
});

test('an explicit revenue answer resolves an ambiguous proposal', () => {
  const proposal = 'A traditional retailer wants a GenAI assistant for customer service. Annual revenue EUR 300m in 2024 and EUR 350m in 2025.';
  const ambiguous = assessInitiative({ proposal });
  assert.equal(ambiguous.status, 'needs_input');
  assert.deepEqual(ambiguous.missing_fields, ['revenue_eur']);
  assert.equal(ambiguous.verdict, undefined);

  const answered = assessInitiative({ proposal, revenue_eur: 350_000_000 });
  assert.equal(answered.status, 'verdict');
  assert.equal(answered.resolved_inputs.revenue_eur, 350_000_000);
  assert.ok(answered.resolutions.includes('revenue_eur resolved as 350000000 from provided value.'));
});

test('a proposal with a cost before revenue uses company revenue in the verdict', () => {
  const result = assessInitiative({
    proposal: 'A traditional retailer wants a EUR 250k GenAI assistant for customer service. Its annual revenue is EUR 300m.',
  });
  // An unlabelled spend still needs clarification rather than silently becoming revenue.
  assert.equal(result.status, 'needs_input');
  const clear = assessInitiative({
    proposal: 'A traditional retailer wants a GenAI assistant for customer service. Pilot cost EUR 250k; annual revenue EUR 300m.',
  });
  assert.equal(clear.status, 'verdict');
  assert.equal(clear.resolved_inputs.revenue_eur, 300_000_000);
});
