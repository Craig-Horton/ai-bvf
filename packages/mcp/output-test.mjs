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
    assert.deepEqual(improved.structuredContent, plan);
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
