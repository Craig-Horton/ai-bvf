/**
 * aibvf-mcp as a remote MCP connector.
 *
 * Serves the same thirteen AI BVF tools as the npm package, over MCP
 * Streamable HTTP, so any claude.ai user (web, mobile, Team) can add it
 * under Settings > Connectors with just this URL — no npx, no Desktop,
 * no config files.
 *
 * Stateless mode: a fresh Server + transport per request. Every AI BVF
 * tool is a pure deterministic calculation, so there is no session state
 * to keep, which is exactly what serverless wants. Telemetry contracts
 * are identical to the stdio path.
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
// Relative import into the workspace build output: the function bundler traces
// plain file imports reliably, where package-name imports through workspace
// symlinks (with an ESM-only exports map) resolve as CJS and fail at runtime.
import { createAibvfServer, flushTelemetry } from '../packages/mcp/dist/server.js';

export default async function handler(req: any, res: any) {
  // A human clicking the link in a browser sends GET without the MCP Accept
  // header. Give them a landing page instead of a protocol error.
  const accept = String(req.headers?.accept ?? '');
  if (req.method === 'GET' && !accept.includes('text/event-stream')) {
    serveLandingPage(res);
    return;
  }

  // Stateless JSON mode has no sessions and never sends server-initiated
  // messages, so a GET stream would hang open with nothing to say until the
  // platform kills the function at its timeout ceiling, billed the whole way.
  // The MCP spec's answer for servers that offer no GET stream is 405; the
  // same applies to DELETE, which terminates sessions this server never
  // creates. Only POST carries JSON-RPC here.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. This is a stateless MCP endpoint; send JSON-RPC over POST.' },
      id: null,
    }));
    return;
  }

  // IDs are optional random connector identifiers, never IPs, emails or auth tokens.
  const query = new URL(req.url || '/', 'https://mcp.aibvf.com').searchParams;
  const server = createAibvfServer({ entryRoute: 'remote', telemetry: {
    cohort: String(req.headers?.['x-aibvf-traffic'] || query.get('aibvf_traffic') || ''),
    clientId: String(req.headers?.['x-aibvf-client-id'] || ''),
  } });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no sessions, safe behind serverless
    enableJsonResponse: true,      // plain JSON responses, no SSE stream needed
  });
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  await flushTelemetry();
}

function serveLandingPage(res: any) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    res.end(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI BVF · MCP endpoint</title>
<style>
  body { margin:0; background:#0F1E35; color:#DCE4EF; font-family:Georgia,'Palatino Linotype',serif; display:flex; min-height:100vh; align-items:center; justify-content:center; }
  .card { max-width:560px; padding:48px 40px; }
  .mark { width:44px; height:44px; border:2px solid #B87333; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#B87333; font-weight:700; font-size:13px; letter-spacing:1px; margin-bottom:22px; }
  h1 { color:#F6F9FD; font-size:26px; line-height:1.3; margin:0 0 14px; font-weight:700; }
  p { line-height:1.7; margin:0 0 14px; font-size:16px; }
  .url { font-family:Consolas,Menlo,monospace; font-size:14px; color:#D9A672; background:rgba(184,115,51,0.08); border:1px solid rgba(184,115,51,0.25); border-radius:6px; padding:10px 14px; word-break:break-all; margin:0 0 14px; }
  a { color:#D9A672; }
  .dim { color:#A7B6C9; font-size:14px; }
</style></head><body><div class="card">
<div class="mark">BVF</div>
<h1>This is a live MCP endpoint, built for AI agents rather than browsers.</h1>
<p>It serves the AI Business Value Framework: thirteen deterministic tools that score an AI initiative Stop, Fix or Accelerate before the budget is committed, and return the change plan when the verdict is Fix.</p>
<p>To use it on claude.ai (web or mobile): Settings, then Connectors, then Add custom connector, and paste this URL:</p>
<div class="url">https://mcp.aibvf.com/api/mcp</div>
<p class="dim">Then ask Claude about any AI initiative you are weighing. The protocol, docs and open-source code live at <a href="https://www.aibvf.com/protocol">aibvf.com/protocol</a>.</p>
</div></body></html>`);
}
