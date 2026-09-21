// Local smoke test: spawn the MCP server, send a real tool-call, print the result.
// Run from packages/mcp after `npm run build`.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const server = spawn('node', [join(here, 'dist', 'index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, AIBVF_TELEMETRY_DISABLE: '1' },
});
let buf = '';
const responses = [];
server.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines) {
    if (line.trim()) {
      try { responses.push(JSON.parse(line)); }
      catch { console.error('bad line:', line); }
    }
  }
});
server.stderr.on('data', (chunk) => process.stderr.write('[stderr] ' + chunk));

const send = (m) => server.stdin.write(JSON.stringify(m) + '\n');

send({ jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '0.1.0' } } });
await new Promise(r => setTimeout(r, 300));
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
await new Promise(r => setTimeout(r, 200));
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
await new Promise(r => setTimeout(r, 200));
send({ jsonrpc: '2.0', id: 3, method: 'tools/call',
  params: {
    name: 'assess_ai_initiative',
    arguments: { proposal: 'We are a 300 million euro retailer, a traditional organisation, considering a GenAI assistant for customer service.' },
  }});
await new Promise(r => setTimeout(r, 300));
send({ jsonrpc: '2.0', id: 4, method: 'tools/call',
  params: {
    name: 'score_initiative',
    arguments: {
      industry: 'manufacturing', revenue_eur: 2_400_000_000,
      function: 'supply', ai_tier: 'gen2', readiness: 'traditional',
      scores: { strategic_alignment: 72, financial_return: 64, change_enablement: 48, governance_risk: 35 },
    },
  }});
await new Promise(r => setTimeout(r, 500));
send({ jsonrpc: '2.0', id: 5, method: 'tools/call',
  params: { name: 'list_taxonomy', arguments: {} } });
await new Promise(r => setTimeout(r, 300));
const architectureGap = {
  workflow_redesigned: true,
  roles_redesigned: false,
  decision_rights_defined: true,
  measures_updated: false,
};
const greenPillars = { strategic_alignment: 80, financial_return: 75, change_enablement: 70, governance_risk: 30 };
send({ jsonrpc: '2.0', id: 6, method: 'tools/call',
  params: {
    name: 'score_initiative',
    arguments: {
      industry: 'retail', revenue_eur: 300_000_000, function: 'cx',
      ai_tier: 'gen2', readiness: 'traditional', scores: greenPillars,
      work_architecture: architectureGap,
    },
  }});
await new Promise(r => setTimeout(r, 300));
send({ jsonrpc: '2.0', id: 7, method: 'tools/call',
  params: {
    name: 'recommend_improvements',
    arguments: {
      industry: 'retail', revenue_eur: 300_000_000, function: 'cx',
      ai_tier: 'gen2', readiness: 'traditional', scores: greenPillars,
      work_architecture: architectureGap,
    },
  }});
await new Promise(r => setTimeout(r, 500));
server.kill();

console.log('\n=== SMOKE TEST RESULTS ===');
if (responses.length === 0) {
  console.error('The MCP server returned no JSON-RPC responses.');
  process.exitCode = 1;
}
for (const r of responses) {
  if (r.id === 1) console.log(`init OK · protocol ${r.result?.protocolVersion} · ${r.result?.serverInfo?.name}@${r.result?.serverInfo?.version}`);
  else if (r.id === 2) {
    if (r.result?.tools?.length !== 13 || r.result?.tools?.[0]?.name !== 'assess_ai_initiative') {
      console.error('Front-door tool is missing or the tool count is not frozen at 13.');
      process.exitCode = 1;
    }
    console.log(`tools/list OK · ${r.result?.tools?.length} tools: ${r.result?.tools?.map(t => t.name).join(', ')}`);
  }
  else if (r.id === 3) {
    const parsed = JSON.parse(r.result?.content?.[0]?.text);
    if (parsed.status !== 'verdict' || parsed.verdict?.classification !== 'Fix' || parsed.resolved_inputs?.industry !== 'retail') {
      console.error('assess_ai_initiative did not resolve and score the retail example.');
      process.exitCode = 1;
    } else console.log(`assess_ai_initiative OK · ${parsed.verdict.classification} · conf ${parsed.verdict.decision_confidence}`);
  } else if (r.id === 4) {
    const parsed = JSON.parse(r.result?.content?.[0]?.text);
    if (parsed.classification !== 'Fix'
      || parsed.feedback?.question !== 'Did this change what you will do next, what should AI BVF do more of, and what should it stop doing?'
      || parsed.feedback?.url !== 'https://www.aibvf.com/feedback?classification=Fix&route=mcp&industry=manufacturing') {
      console.error('Fix verdict did not carry the expected feedback route.');
      process.exitCode = 1;
    } else {
      console.log('feedback route OK');
    }
    console.log(`score_initiative OK · ${parsed.classification} · €${Math.round(parsed.net_value_eur.low/1e6)}M–€${Math.round(parsed.net_value_eur.high/1e6)}M · conf ${parsed.decision_confidence}`);
  } else if (r.id === 5) {
    const parsed = JSON.parse(r.result?.content?.[0]?.text);
    console.log(`list_taxonomy OK · ${parsed.industries.length} industries · ${parsed.functions.length} functions · ${parsed.ai_tiers.length} tiers`);
  } else if (r.id === 6) {
    const parsed = JSON.parse(r.result?.content?.[0]?.text);
    if (parsed.classification !== 'Fix' || parsed.work_architecture?.status !== 'gap' || parsed.work_architecture?.gaps?.length !== 2) {
      console.error('Work architecture gap did not hold the green pillars at Fix.');
      process.exitCode = 1;
    } else console.log(`work architecture gate OK: ${parsed.work_architecture.gaps.length} gaps, verdict ${parsed.classification}`);
  } else if (r.id === 7) {
    const parsed = JSON.parse(r.result?.content?.[0]?.text);
    const play = parsed.change_plan?.plays?.find(p => p.id === 'work-architecture-redesign');
    if (!play || !play.owner || !play.stop_condition) {
      console.error('Work architecture redesign play is incomplete.');
      process.exitCode = 1;
    } else console.log(`work architecture play OK: owner ${play.owner}`);
  } else console.log('? id=' + r.id + ':', JSON.stringify(r).slice(0, 200));
}
process.exit(process.exitCode ?? 0);
