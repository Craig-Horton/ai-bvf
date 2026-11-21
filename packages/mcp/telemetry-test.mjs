import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.USERPROFILE = mkdtempSync(join(tmpdir(), 'aibvf-telemetry-'));
process.env.HOME = process.env.USERPROFILE;
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
const ci = process.env.CI;
delete process.env.CI;
await logCall('server_connect', { entry_route: 'stdio' });
assert.equal(payloads.at(-1).activity_cohort, 'internal');
process.env.CI = 'true';
await logCall('server_connect', { entry_route: 'stdio' });
assert.equal(payloads.at(-1).activity_cohort, 'automated_test');
if (ci === undefined) delete process.env.CI;
else process.env.CI = ci;
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
// The context the engine could not read is recorded by field name, never by its text.
await client.callTool({ name: 'assess_ai_initiative', arguments: { proposal: 'We want AI to improve things.' } });
assert.equal(payloads.at(-1).assessment_stage, 'needs_input');
assert.ok(['industry', 'function', 'ai_tier', 'employees'].includes(payloads.at(-1).question_key));
assert.equal(JSON.stringify(payloads.at(-1)).includes('improve things'), false);
// A deliberate refusal is recorded as refused, a fault as error, and the caller still gets the message.
const refusal = await client.callTool({ name: 'infer_readiness', arguments: { function: 'finance' } });
assert.equal(refusal.isError, true);
assert.match(refusal.content[0].text, /needs at least two measured signals/);
assert.equal(payloads.at(-1).tool_name, 'infer_readiness');
assert.equal(payloads.at(-1).outcome, 'refused');
assert.equal(payloads.at(-1).assessment_stage, 'refused');
await client.callTool({ name: 'sequence_portfolio', arguments: { readiness: 'agile' } });
assert.equal(payloads.at(-1).outcome, 'refused');
const { isInputRefusal, InternalFault } = await import('./dist/server.js');
assert.equal(isInputRefusal(new Error('needs input')), true);
assert.equal(isInputRefusal(new TypeError('fault')), false);
assert.equal(isInputRefusal(new InternalFault('fault')), false);
assert.equal(isInputRefusal('fault'), false);
await logCall('score_initiative', { entry_route: 'remote', outcome: 'error' });
assert.equal(payloads.at(-1).outcome, 'error');
// Who answered is recorded as a category. The quote, its source and the proposal never are.
const agentCall = {
  proposal: 'We are a 400-person online retailer. We want an AI agent to answer first-line customer queries.',
  confirmed: true, answered_by: 'evidence',
  answers: { governance_risk: 'a' },
  evidence: { governance_risk: { quote: 'The agent may issue refunds of any amount with no approval step.', source: 'Vendor design note, 3 November 2026' } },
  review: { previous_verdict: 'Fix', outcome: 'paused_or_stopped', evidence: { quote: 'Programme paused by the board on 1 December.', source: 'Board minutes, 1 December 2026' } },
};
await client.callTool({ name: 'assess_ai_initiative', arguments: agentCall });
assert.equal(payloads.at(-1).answered_by, 'evidence');
assert.equal(payloads.at(-1).classification, 'Stop');
assert.equal(payloads.at(-1).review_previous_verdict, 'Fix');
assert.equal(payloads.at(-1).review_outcome, 'paused_or_stopped');
for (const secret of ['no approval step', 'Vendor design note', 'Board minutes', 'online retailer']) {
  assert.equal(JSON.stringify(payloads.at(-1)).includes(secret), false, `telemetry carried "${secret}"`);
}
// An outcome an agent could not quote is not recorded.
await client.callTool({ name: 'assess_ai_initiative', arguments: { ...agentCall, review: { previous_verdict: 'Fix', outcome: 'delivering' } } });
assert.equal(payloads.at(-1).review_outcome, null);
assert.equal(payloads.at(-1).review_previous_verdict, null);
await client.callTool({ name: 'assess_ai_initiative', arguments: { proposal: agentCall.proposal, confirmed: true, answers: { governance_risk: 'a' } } });
assert.equal(payloads.at(-1).answered_by, 'owner');
await logCall('score_initiative', { entry_route: 'remote', answered_by: 'someone', review_outcome: 'went well' });
assert.equal(payloads.at(-1).answered_by, null);
assert.equal(payloads.at(-1).review_outcome, null);
await client.close();
await server.close();

console.log('telemetry payload privacy and adoption fields OK');
