import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.USERPROFILE = mkdtempSync(join(tmpdir(), 'aibvf-telemetry-'));
process.env.AIBVF_TELEMETRY_URL = 'https://telemetry.test/mcp_calls';
process.env.AIBVF_TELEMETRY_KEY = 'test-key';
process.env.AIBVF_USAGE_ROLE = 'ai_data_leader';

const payloads = [];
globalThis.fetch = async (_url, init) => {
  payloads.push(JSON.parse(init.body));
  return { ok: true };
};

const { flushTelemetry, logCall, VERSION } = await import('./dist/server.js');

const localRequest = logCall('assess_ai_initiative', {
  entry_route: 'stdio',
  assessment_stage: 'verdict',
  work_architecture_status: 'gap',
  industry: 'retail',
  classification: 'Fix',
});
const remoteRequest = logCall('score_initiative', { entry_route: 'remote', assessment_stage: 'verdict' });

await flushTelemetry();

assert.ok(localRequest instanceof Promise);
assert.ok(remoteRequest instanceof Promise);
assert.equal(payloads.length, 2);
assert.equal(payloads[0].package_version, VERSION);
assert.equal(payloads[0].entry_route, 'stdio');
assert.equal(payloads[0].assessment_stage, 'verdict');
assert.equal(payloads[0].work_architecture_status, 'gap');
assert.match(payloads[0].install_hash, /^[a-f0-9]{24}$/);
assert.equal(payloads[0].user_role, 'ai_data_leader');
assert.equal(payloads[1].entry_route, 'remote');
assert.equal(payloads[1].install_hash, null);
assert.equal(payloads[1].user_role, null);
assert.equal('proposal' in payloads[0], false);
assert.equal('revenue_eur' in payloads[0], false);

process.env.AIBVF_TELEMETRY_COHORT = 'internal';
await logCall('server_connect', { entry_route: 'stdio' });
assert.equal(payloads.at(-1).activity_cohort, 'internal');
delete process.env.AIBVF_TELEMETRY_COHORT;
await logCall('assess_ai_initiative', { entry_route: 'remote', cohort: 'automated_test', clientId: '12345678-1234-4234-8234-123456789abc', assessmentId: '12345678-1234-4234-8234-123456789abd', question_key: 'financial_return', proposal: 'SECRET' });
assert.equal(payloads.at(-1).activity_cohort, 'automated_test');
assert.match(payloads.at(-1).install_hash, /^[a-f0-9]{24}$/);
assert.match(payloads.at(-1).assessment_hash, /^[a-f0-9]{24}$/);
assert.equal(JSON.stringify(payloads).includes('SECRET'), false);
await logCall('assess_ai_initiative', { entry_route: 'remote', clientId: 'user@example.com', assessmentId: 'personal-name', question_key: 'SECRET' });
assert.equal(payloads.at(-1).install_hash, null);
assert.equal(payloads.at(-1).assessment_hash, null);
assert.equal(payloads.at(-1).question_key, null);

const { createAibvfServer } = await import('./dist/server.js');
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
const [ct, st] = InMemoryTransport.createLinkedPair();
const server = createAibvfServer({ entryRoute: 'remote', telemetry: { cohort: 'automated_test' } });
const client = new Client({ name: 'measurement-test', version: '1' });
await server.connect(st);
await client.connect(ct);
const first = await client.callTool({ name: 'assess_ai_initiative', arguments: { proposal: 'We are a retailer with 60 staff considering a GenAI customer service assistant.' } });
const firstPayload = JSON.parse(first.content[0].text);
assert.match(firstPayload.assessment_id, /^[a-f0-9-]{36}$/);
await client.callTool({ name: 'assess_ai_initiative', arguments: { proposal: 'We are a retailer with 60 staff considering a GenAI customer service assistant.', confirmed: true, assessment_id: firstPayload.assessment_id } });
assert.equal(payloads.at(-1).assessment_hash, payloads.at(-2).assessment_hash);
assert.equal(payloads.at(-1).activity_cohort, 'automated_test');
await client.close();
await server.close();

console.log('telemetry payload privacy and adoption fields OK');
