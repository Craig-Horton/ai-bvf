import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const expectedCore = '0.10.6';
const expectedMcp = '0.14.14';
const endpoint = 'https://mcp.aibvf.com/api/mcp';
const registryName = 'io.github.Craig-Horton/aibvf-mcp';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}
async function retry(label, task, attempts = 18) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await task(); }
    catch (error) {
      last = error;
      console.log(`WAIT ${label} ${attempt}/${attempts}: ${error.message}`);
      if (attempt < attempts) await delay(10000);
    }
  }
  throw last;
}
const sandbox = await mkdtemp(join(tmpdir(), 'aibvf-release-verification-'));
try {
  for (const [name, version] of [['@aibvf/core', expectedCore], ['aibvf-mcp', expectedMcp]]) {
    const metadata = await retry(`npm ${name}@${version}`, async () => {
      const result = await json(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`);
      assert.equal(result.version, version);
      assert.ok(result.dist?.integrity);
      assert.ok(result.dist?.tarball);
      return result;
    });
    console.log('VERIFIED_NPM_MANIFEST ' + JSON.stringify({ name, version, integrity: metadata.dist.integrity, tarball: metadata.dist.tarball }));
  }
  await writeFile(join(sandbox, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  await retry('npm artifact installation', async () => execFileSync('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-online',
    '--registry=https://registry.npmjs.org', '--cache=' + join(sandbox, 'npm-cache'),
    '--fetch-retries=3', '--fetch-retry-mintimeout=5000',
    `@aibvf/core@${expectedCore}`, `aibvf-mcp@${expectedMcp}`,
  ], { cwd: sandbox, stdio: 'inherit', timeout: 180000 }), 12);
  const coreManifest = JSON.parse(await readFile(join(sandbox, 'node_modules/@aibvf/core/package.json'), 'utf8'));
  const mcpManifest = JSON.parse(await readFile(join(sandbox, 'node_modules/aibvf-mcp/package.json'), 'utf8'));
  assert.equal(coreManifest.version, expectedCore);
  assert.equal(mcpManifest.version, expectedMcp);
  assert.equal(mcpManifest.dependencies['@aibvf/core'], expectedCore);
  const core = await import(pathToFileURL(join(sandbox, 'node_modules/@aibvf/core/dist/index.js')).href);
  assert.equal(core.CORE_VERSION, expectedCore);

  const require = createRequire(join(sandbox, 'node_modules/aibvf-mcp/package.json'));
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
  const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const clientInfo = { name: 'aibvf-release-verification', version: '1.0.0' };
  const proposal = 'A traditional retailer wants a GenAI assistant for customer service. Pilot cost EUR 250k; annual revenue EUR 300m.';
  async function verify(client, route) {
    assert.equal(client.getServerVersion()?.name, registryName);
    assert.equal(client.getServerVersion()?.version, expectedMcp);
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 13);
    assert.equal(new Set(listed.tools.map((tool) => tool.name)).size, 13);
    assert.ok(listed.tools.some((tool) => tool.name === 'assess_ai_initiative'));
    const response = await client.callTool({ name: 'assess_ai_initiative', arguments: { proposal } });
    assert.notEqual(response.isError, true, JSON.stringify(response.content));
    const assessment = response.structuredContent ?? JSON.parse(response.content[0].text);
    assert.equal(assessment.status, 'verdict');
    assert.equal(assessment.resolved_inputs.revenue_eur, 300000000);
    assert.equal(assessment.verdict.classification, 'Fix');
    assert.equal(assessment.verdict.audit.engine_version, expectedCore);
    assert.match(assessment.verdict.interpretation.net_value_eur, /before project build, run and change costs/);
    assert.match(assessment.verdict.interpretation.decision_confidence, /no probability calibration/);
    console.log('VERIFIED_RUNTIME ' + JSON.stringify({
      route, server: client.getServerVersion(), tools: listed.tools.length,
      resolved_revenue_eur: assessment.resolved_inputs.revenue_eur,
      verdict: assessment.verdict.classification, core_version: assessment.verdict.audit.engine_version,
      client_name: clientInfo.name, synthetic: true,
    }));
  }
  const local = new Client(clientInfo);
  try {
    await local.connect(new StdioClientTransport({
      command: process.execPath,
      args: [join(sandbox, 'node_modules/aibvf-mcp/dist/index.js')],
      env: { ...process.env, AIBVF_TELEMETRY_DISABLE: '1' },
    }));
    await verify(local, 'published-npm-stdio');
  } finally { await local.close(); }

  // Hosted checks create synthetic operational events. They do not represent adoption.
  const hosted = await retry('hosted release version', async () => {
    const candidate = new Client(clientInfo);
    try {
      await candidate.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
      // Retry old deployments before issuing any tool calls.
      assert.equal(candidate.getServerVersion()?.version, expectedMcp);
      return candidate;
    } catch (error) {
      await candidate.close();
      throw error;
    }
  });
  try { await verify(hosted, 'hosted-production'); }
  finally { await hosted.close(); }
  const entry = await retry('MCP registry release', async () => {
    const result = await json(`https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(registryName)}/versions/${expectedMcp}`);
    const server = result.server ?? result;
    assert.equal(server.name, registryName);
    assert.equal(server.version, expectedMcp);
    assert.ok(server.packages?.some((pkg) => pkg.registryType === 'npm' && pkg.identifier === 'aibvf-mcp' && pkg.version === expectedMcp));
    return server;
  });
  console.log('VERIFIED_MCP_REGISTRY ' + JSON.stringify({ name: entry.name, version: entry.version, packages: entry.packages, remotes: entry.remotes }));
  try {
    const legacyName = 'io.github.Bahamas1717/aibvf-mcp';
    const legacyResult = await json(`https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(legacyName)}/versions/latest`);
    const legacy = legacyResult.server ?? legacyResult;
    console.log('LEGACY_REGISTRY_METADATA ' + JSON.stringify({ name: legacy.name, version: legacy.version, remotes: legacy.remotes ?? [] }));
  } catch (error) {
    console.log('LEGACY_REGISTRY_METADATA_UNAVAILABLE ' + error.message);
  }
  console.log('Published artifact and hosted runtime verification passed. Hosted availability was checked separately from registry discovery; hosted probes are synthetic operational events.');
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
