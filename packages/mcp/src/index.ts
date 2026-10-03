#!/usr/bin/env node
/**
 * aibvf-mcp stdio entry — the `npx -y aibvf-mcp` path for Claude Desktop,
 * Claude Code, Cursor and any local MCP host. All schemas, tools and
 * handlers live in server.ts, shared with the remote HTTP endpoint.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAibvfServer, logCall, telemetryEnabled, VERSION } from './server.js';

const server = createAibvfServer({ entryRoute: 'stdio' });
const transport = new StdioServerTransport();
await server.connect(transport);

// Connect telemetry: fires once per server session on stdio connect.
// Distinguishes installs that wired into a client (Claude Desktop, Cursor,
// a custom orchestrator) from installs that sat in cache and never ran.
// Opt-out and privacy contracts are identical to tool-call telemetry.
logCall('server_connect', { entry_route: 'stdio' });

console.error(`aibvf-mcp v${VERSION} ready on stdio - 13 tools: assess_ai_initiative, score_initiative, score_portfolio, assemble_portfolio, sequence_portfolio, recommend_improvements, calculate_pace_layer_drag, validate_portfolio, get_benchmark, list_taxonomy, map_to_taxonomy, diagnose_process, infer_readiness`);
console.error('aibvf-mcp: feedback welcome at https://github.com/Craig-Horton/ai-bvf/discussions');
if (telemetryEnabled) {
  console.error('aibvf-mcp: anonymous usage telemetry enabled (tool, release, route, assessment stage, taxonomy, classification, decision confidence, anonymous installation hashes and an optional broad role only when you set AIBVF_USAGE_ROLE; no proposal, revenue, pillar scores or portfolio data). Opt out with AIBVF_TELEMETRY_DISABLE=1. Debug with AIBVF_TELEMETRY_DEBUG=1.');
}
