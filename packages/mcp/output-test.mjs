import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { score, recommendImprovements } from '@aibvf/core';

process.env.AIBVF_TELEMETRY_DISABLE = '1';
const { createAibvfServer } = await import('./dist/server.js');
const input = {
  industry: 'retail', revenue_eur: 300_000_000, function: 'cx',
  ai_tier: 'gen2', readiness: 'traditional',
  scores: { strategic_alignment: 80, financial_return: 75, change_enablement: 70, governance_risk: 30 },
  work_architecture: { workflow_redesigned: true, roles_redesigned: false,
    decision_rights_defined: true, measures_updated: false },
};

test('MCP scoring and improvement responses retain engine evidence', { timeout: 10000 }, async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createAibvfServer();
  const client = new Client({ name: 'output-regression', version: '1.0.0' });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const scored = await client.callTool({ name: 'score_initiative', arguments: input });
    assert.notEqual(scored.isError, true);
    const text = JSON.parse(scored.content[0].text);
    assert.deepEqual(scored.structuredContent, text);
    const expected = score(input);
    assert.deepEqual(text.audit, expected.audit);
    assert.deepEqual(text.sensitivity, expected.sensitivity);
    assert.ok(text.audit.rules_fired.length > 0);
    assert.equal(text.classification, 'Fix');
    assert.equal(text.work_architecture.status, 'gap');

    const improved = await client.callTool({ name: 'recommend_improvements', arguments: input });
    assert.notEqual(improved.isError, true);
    const plan = JSON.parse(improved.content[0].text);
    // In-memory transport retains optional undefined properties; JSON wire transport omits them.
    assert.deepEqual(JSON.parse(JSON.stringify(improved.structuredContent)), plan);
    assert.deepEqual(plan.audit, recommendImprovements(input).audit);
    assert.ok(plan.audit.rules_fired.length > 0);

    const assessment = await client.callTool({
      name: 'assess_ai_initiative',
      arguments: { proposal: 'We are a 300 million euro retailer, a traditional organisation, considering a GenAI assistant for customer service.' },
    });
    assert.notEqual(assessment.isError, true);
    assert.equal(assessment.structuredContent.status, 'verdict');
    assert.equal(assessment.structuredContent.verdict.classification, 'Fix');
    assert.ok(assessment.structuredContent.verdict.audit);
    assert.ok(assessment.structuredContent.verdict.sensitivity);
  } finally {
    await client.close();
    await server.close();
  }
});

const readyWork = {
  workflow_redesigned: true, roles_redesigned: true,
  decision_rights_defined: true, measures_updated: true,
};
const pillars = Object.keys(input.scores);
const organization = { name: 'Regression retailer', industry: 'retail', revenue_eur: 300_000_000 };

async function withMcp(run) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createAibvfServer();
  const client = new Client({ name: 'portfolio-output-regression', version: '1.0.0' });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return await run(async (name, args) => {
      const response = await client.callTool({ name, arguments: args });
      assert.notEqual(response.isError, true, JSON.stringify(response.content));
      const payload = JSON.parse(response.content[0].text);
      assert.deepEqual(JSON.parse(JSON.stringify(response.structuredContent)), payload);
      return payload;
    }, client);
  } finally {
    await client.close();
    await server.close();
  }
}

function portfolioItem(id, extra = {}) {
  return { id, name: id, function: 'cx', ai_tier: 'gen2', scores: { ...input.scores }, ...extra };
}

test('MCP portfolio preserves ready, missing and failed work architecture gates', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const result = await call('score_portfolio', {
      readiness: 'traditional',
      portfolio: {
        bvf_version: '1.0', organization,
        initiatives: [
          portfolioItem('ready', { work_architecture: readyWork }),
          portfolioItem('missing'),
          portfolioItem('gap', { work_architecture: { ...readyWork, roles_redesigned: false } }),
          portfolioItem('stop', { work_architecture: readyWork, scores: { ...input.scores, governance_risk: 80 } }),
        ],
      },
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.summary, { accelerate: 1, fix: 2, stop: 1, skipped: 0 });
    const [ready, missing, gap, stop] = result.scored_initiatives;
    assert.equal(ready.classification, 'Accelerate');
    assert.equal(ready.work_architecture.status, 'ready');
    assert.deepEqual(ready.audit.inputs_used.work_architecture, readyWork);
    assert.equal(missing.classification, 'Fix');
    assert.equal(missing.work_architecture.status, 'unknown');
    assert.equal(gap.classification, 'Fix');
    assert.equal(gap.work_architecture.status, 'gap');
    assert.equal(stop.classification, 'Stop');
    assert.ok(ready.audit.rules_fired.length);
    assert.ok(ready.sensitivity);
    assert.match(result.interpretation.aggregate_net_value_eur, /overlapping scope/);
  });
});

test('MCP assembly retains work design and estimated provenance through scoring', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const assembled = await call('assemble_portfolio', {
      organization, readiness: 'traditional',
      initiatives: [
        { name: 'Supplied', function: 'customer service', ai_tier: 'copilot', scores: input.scores, work_architecture: readyWork },
        { name: 'Estimated', function: 'customer service', ai_tier: 'copilot', work_architecture: readyWork, signal_completeness: 1 },
        { name: 'Mixed', function: 'customer service', ai_tier: 'copilot', scores: { strategic_alignment: 80 }, work_architecture: readyWork },
      ],
    });
    assert.equal(assembled.validation.valid, true);
    const [supplied, estimated, mixed] = assembled.portfolio.initiatives;
    assert.deepEqual(supplied.work_architecture, readyWork);
    assert.ok(pillars.every((pillar) => estimated.pillar_basis[pillar] === 'estimated'));
    assert.equal(mixed.pillar_basis.strategic_alignment, 'given');
    const result = await call('score_portfolio', { portfolio: assembled.portfolio, readiness: 'traditional' });
    assert.equal(result.scored_initiatives[0].classification, 'Accelerate');
    const scored = result.scored_initiatives[1];
    assert.equal(scored.classification, 'Fix');
    assert.ok(pillars.every((pillar) => scored.pillar_basis[pillar] === 'estimated'));
    assert.equal(scored.signal_completeness, 0.4);
    assert.match(scored.caveat, /Estimated pillars/);
    const expected = score({ ...input, scores: {}, work_architecture: readyWork, signal_completeness: 0.4 });
    assert.equal(scored.decision_confidence, expected.confidence);
    const asSupplied = score({ ...input, scores: scored.scores_used, work_architecture: readyWork });
    assert.ok(scored.decision_confidence < asSupplied.confidence);
    assert.equal(result.scored_initiatives[2].pillar_basis.strategic_alignment, 'given');
    assert.equal(result.scored_initiatives[2].pillar_basis.financial_return, 'estimated');
    const changedContext = await call('score_portfolio', { portfolio: assembled.portfolio, readiness: 'siloed' });
    assert.equal(changedContext.scored_initiatives[1].scores_used.change_enablement, 32);
  });
});

test('MCP portfolio retains weak supplied evidence without relabelling it estimated', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const scores = Object.fromEntries(pillars.map((pillar) => [pillar, { value: input.scores[pillar], confidence: 20 }]));
    const result = await call('score_portfolio', {
      readiness: 'traditional',
      portfolio: { bvf_version: '1.0', organization, initiatives: [portfolioItem('weak-evidence', {
        scores, work_architecture: readyWork, signal_completeness: 0.9,
      })] },
    });
    const scored = result.scored_initiatives[0];
    assert.equal(scored.signal_completeness, 0.2);
    assert.ok(pillars.every((pillar) => scored.pillar_basis[pillar] === 'given'));
    assert.equal(scored.decision_confidence, score({ ...input, work_architecture: readyWork, signal_completeness: 0.2 }).confidence);
    const lower = await call('score_portfolio', {
      readiness: 'traditional',
      portfolio: { bvf_version: '1.0', organization, initiatives: [portfolioItem('explicit-quality', {
        work_architecture: readyWork, signal_completeness: 0.1,
      })] },
    });
    assert.equal(lower.scored_initiatives[0].signal_completeness, 0.1);
  });
});

test('MCP assembly keeps evidence attached when invalid entries are skipped and names repeat', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const result = await call('assemble_portfolio', {
      organization, readiness: 'traditional',
      initiatives: [
        { name: 'Same name', function: 'not-a-business-function', ai_tier: 'copilot', work_architecture: { roles_redesigned: false } },
        { name: 'Same name', function: 'cx', ai_tier: 'gen2', scores: input.scores, work_architecture: readyWork },
        { name: 'Same name', function: 'cx', ai_tier: 'gen2', scores: input.scores, work_architecture: { ...readyWork, measures_updated: false } },
      ],
    });
    assert.equal(result.portfolio.initiatives.length, 2);
    assert.deepEqual(result.portfolio.initiatives[0].work_architecture, readyWork);
    assert.equal(result.portfolio.initiatives[1].work_architecture.measures_updated, false);
    assert.notEqual(result.portfolio.initiatives[0].id, result.portfolio.initiatives[1].id);
  });
});

test('MCP explanations disclose compatibility field limits on tool listings and responses', { timeout: 10000 }, async () => {
  await withMcp(async (call, client) => {
    const tools = await client.listTools();
    const schema = tools.tools.find((tool) => tool.name === 'score_initiative').outputSchema;
    assert.match(schema.properties.decision_confidence.description, /no probability calibration/);
    assert.match(schema.properties.net_value_eur.description, /before project build, run and change costs/);
    assert.match(schema.properties.applied_modules.description, /do not certify/);
    const single = await call('score_initiative', { ...input, industry: 'healthcare', function: 'risk' });
    assert.ok(single.applied_modules.includes('healthcare_hipaa_module'));
    assert.match(single.interpretation.applied_modules, /do not certify/);
    assert.match(single.interpretation.net_value_eur, /before project build, run and change costs/);
    const assessment = await call('assess_ai_initiative', {
      proposal: 'We are a 300 million euro retailer, a traditional organisation, considering a GenAI assistant for customer service.',
    });
    assert.match(assessment.verdict.interpretation.decision_confidence, /no probability calibration/);
    const improved = await call('recommend_improvements', input);
    assert.match(improved.interpretation.target_classification, /conditional on work-architecture readiness/);
  });
});
