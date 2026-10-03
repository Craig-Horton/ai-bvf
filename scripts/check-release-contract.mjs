#!/usr/bin/env node
// Run after npm run build. This checks release metadata against the built MCP server.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Set this before importing AI BVF modules or creating an MCP connection.
process.env.AIBVF_TELEMETRY_DISABLE = '1';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));
const [core, mcp, cli, registry, readme, pythonManifest] = await Promise.all([
  readJson('packages/js/package.json'),
  readJson('packages/mcp/package.json'),
  readJson('packages/cli/package.json'),
  readJson('server.json'),
  read('README.md'),
  read('packages/py/pyproject.toml'),
]);

// Only the literal name/version fields in [project] are needed from TOML.
const python = {};
let inProject = false;
for (const line of pythonManifest.split(/\r?\n/)) {
  if (/^\[/.test(line)) {
    if (inProject) break;
    inProject = line.trim() === '[project]';
    continue;
  }
  if (!inProject) continue;
  const match = line.match(/^\s*(name|version)\s*=\s*["']([^"']+)["']\s*$/);
  if (match) python[match[1]] = match[2];
}
assert.ok(python.name && python.version, 'Python [project] name/version must be literal manifest values.');

function tableRows(firstHeader) {
  const lines = readme.split(/\r?\n/);
  const cells = (line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim());
  const starts = lines.flatMap((line, index) => {
    if (!line.trim().startsWith('|') || !line.trim().endsWith('|')) return [];
    return cells(line)[0]?.toLowerCase() === firstHeader.toLowerCase() ? [index] : [];
  });
  assert.equal(starts.length, 1, `README must contain one ${firstHeader} table.`);
  const header = cells(lines[starts[0]]);
  const rows = [];
  for (let index = starts[0] + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) break;
    const row = cells(line);
    if (row.every((cell) => /^:?-+:?$/.test(cell))) continue;
    rows.push(row);
  }
  return { header, rows };
}

const packageTable = tableRows('Package');
const versionColumn = packageTable.header.findIndex((cell) => cell.toLowerCase() === 'version');
assert.ok(versionColumn >= 0, 'README package table needs a Version column.');
for (const manifest of [core, mcp, cli, python]) {
  const matches = packageTable.rows.filter((row) => row[0].includes('`' + manifest.name + '`'));
  assert.equal(matches.length, 1, `README must contain one package row for ${manifest.name}.`);
  assert.equal(matches[0][versionColumn].replaceAll('`', ''), manifest.version,
    `README version for ${manifest.name} differs from its package manifest.`);
}

assert.equal(mcp.dependencies?.[core.name], core.version,
  'The MCP package must pin the current core package version.');
assert.equal(registry.name, mcp.mcpName, 'MCP registry name differs from the package mcpName.');
assert.equal(registry.version, mcp.version, 'MCP registry version differs from the package version.');
const npmEntries = registry.packages?.filter((entry) => entry.registryType === 'npm' && entry.identifier === mcp.name) ?? [];
assert.equal(npmEntries.length, 1, 'server.json must contain one npm entry for the MCP package.');
assert.equal(npmEntries[0].version, mcp.version, 'MCP registry npm version differs from the package version.');

const [{ CORE_VERSION }, { VERSION, createAibvfServer }, { Client }, { InMemoryTransport }] = await Promise.all([
  import('../packages/js/dist/index.js'),
  import('../packages/mcp/dist/server.js'),
  import('@modelcontextprotocol/sdk/client/index.js'),
  import('@modelcontextprotocol/sdk/inMemory.js'),
]);
assert.equal(CORE_VERSION, core.version, 'Built CORE_VERSION differs from the core package manifest.');
assert.equal(VERSION, mcp.version, 'Built MCP VERSION differs from the MCP package manifest.');

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = createAibvfServer({ entryRoute: 'stdio' });
const client = new Client({ name: 'aibvf-release-contract', version: '1.0.0' });
try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  assert.equal(client.getServerVersion()?.version, mcp.version,
    'MCP initialize response differs from the package version.');
  assert.equal(client.getServerVersion()?.name, registry.name,
    'MCP initialize server name differs from server.json.');
  const listed = await client.listTools();
  assert.equal(listed.nextCursor, undefined, 'Read every page before checking a paginated MCP catalogue.');
  const names = listed.tools.map((tool) => tool.name);
  assert.equal(names.length, 13, 'The released tool catalogue has 13 tools. Update the contract and documentation together when adding tools.');
  assert.equal(new Set(names).size, names.length, 'MCP tool names must be unique.');
  const documented = tableRows('Tool').rows.map((row) => {
    const name = row[0].match(/`([^`]+)`/)?.[1];
    assert.ok(name, 'README tool rows must name the literal MCP tool in code formatting.');
    return name;
  });
  assert.deepEqual(documented.sort(), [...names].sort(),
    'README Tool table differs from the tools exposed by the built MCP server.');
  console.log(`Release contract verified: core ${core.version}, MCP ${mcp.version}, ${names.length} tools; package table and registry metadata agree.`);
} finally {
  await client.close();
  await server.close();
}
