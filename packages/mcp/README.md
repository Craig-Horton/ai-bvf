# aibvf-mcp

MCP server exposing AI BVF v1.0 to any Claude agent, thirteen deterministic tools that pre-flight-check AI initiatives before the budget is committed: start from a plain-English proposal, score from whatever is known, test whether workflows, roles, decision rights and measures have been redesigned, return the change plan when the verdict is Fix, and measure organisational readiness from process data instead of self-report. The tool count is fixed through 0.15.x.

> **Source:** [github.com/Craig-Horton/ai-bvf](https://github.com/Craig-Horton/ai-bvf) · ⭐ star if this helped · [Issues](https://github.com/Craig-Horton/ai-bvf/issues) · Built by [Craig Horton Advisory](https://craighortonadvisory.com)

## No install: use it on claude.ai

Settings, then Connectors, then Add custom connector, and paste the hosted endpoint. Works on web and mobile, all thirteen tools, same deterministic engine:

```
https://mcp.aibvf.com/api/mcp
```

## Install and run (stdio)

```bash
npx aibvf-mcp
```

## Wire into Claude Desktop / Cursor / any MCP host

### macOS and Linux

Add to your MCP config (on Claude Desktop macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "aibvf": {
      "command": "npx",
      "args": ["-y", "aibvf-mcp"]
    }
  }
}
```

### Windows

Windows needs `cmd /c` because `npx` on Windows is `npx.cmd` and Claude Desktop's process spawner doesn't auto-resolve the `.cmd` extension. Use this config in `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aibvf": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "aibvf-mcp"]
    }
  }
}
```

If that still fails, use the full path to `npx.cmd`. Find it with `where npx` in a terminal; it's usually `C:\Program Files\nodejs\npx.cmd`. Then:

```json
{
  "mcpServers": {
    "aibvf": {
      "command": "C:\\Program Files\\nodejs\\npx.cmd",
      "args": ["-y", "aibvf-mcp"]
    }
  }
}
```

(Double backslashes are required inside JSON strings.)

### After configuring

Fully quit and restart the host (on Windows, right-click the Claude tray icon → Quit; closing the window leaves it running). Then ask Claude:

> *"Score this AI initiative using AI BVF: we're a €2.4bn manufacturer, planning a GenAI predictive maintenance rollout in our EU plants, we're a traditional hierarchy, strong sponsor, modest change budget."*

Claude will call `assess_ai_initiative`, resolve the proposal, and return the classification, euro range, and reasoning. If one decision input is missing, it asks for that first.

## Troubleshooting

- **No tools icon appears after restart.** The config JSON probably has a syntax error. Validate with `python -m json.tool <path-to-config>`.
- **"Could not attach to MCP server aibvf."** Open the host's MCP log (on Claude Desktop Windows: `%APPDATA%\Claude\logs\mcp-server-aibvf.log`) for the actual error. Most common cause on Windows is the `npx` / `cmd /c` spawning issue above.
- **Tools show but calls fail.** Your npx cache may have a broken copy; clear it with `npx clear-npx-cache` and retry.

## Tools exposed

| Tool | Purpose |
|---|---|
| `assess_ai_initiative` | Plain-English front door for one initiative. Resolves industry, revenue, function, AI tier and readiness, tests the work architecture, asks once for every unresolved input, then returns Accelerate, Fix or Stop from the same scoring engine. |
| `score_initiative` | Return classification, euro range, reasoning and the work architecture gate for one initiative. |
| `score_portfolio` | Score every initiative in a BVF portfolio in one call and return the board-level shape: Accelerate/Fix/Stop counts, aggregate EUR value, mean decision confidence, top initiative by value, highest-risk initiative, per-initiative results. Use instead of looping `score_initiative`. |
| `assemble_portfolio` | Assembles a valid BVF v1.0 portfolio document from loose inputs: names, plain-language functions and tiers, and whatever pillar scores exist. Aliases resolved, ids generated, missing pillars estimated with the estimation reported per initiative, document validated before return. Nothing stored, nothing edited. |
| `recommend_improvements` | For a Stop or Fix initiative, return concrete pillar actions and named change plays, including workflow and role redesign when the work architecture has a gap. |
| `calculate_pace_layer_drag` | Return the annual Organisational Drag Cost in EUR from misalignment between AI tier and organisational readiness — the cost of *not* changing the operating model. |
| `validate_portfolio` | Check a BVF portfolio JSON against the v1.0 schema. |
| `get_benchmark` | Return the published benchmark base-rate and industry multiplier for a function + industry. Use when the caller wants the raw rates without an initiative-level verdict. |
| `list_taxonomy` | List the valid industries, functions, AI tiers, and readiness levels. |
| `diagnose_process` | AI BVF Advisor Brain: diagnose one business process from observed signals (volume, labour, cycle time, handoffs, rework, automation, spend) and return heaviness, the recommended intervention (Automate / Consolidate & re-sequence / Quality controls / Eliminate), the modelled net EUR saving, the efficiency gain, an Accelerate/Fix/Stop verdict, and a decision confidence governed by how much was actually measured. |
| `infer_readiness` | Measures organisational readiness from process signals (hand-offs, rework, touch ratio, automation, cycle time vs function medians) instead of accepting self-report. Returns the classification the data supports, per-signal reasoning, and a confidence set by coverage and agreement. When the measured answer is lower than the claimed one, that gap is itself a change-readiness finding. |
| `sequence_portfolio` | Turns a scored portfolio into a three-wave rollout plan with named gates: Stops first (free the budget), quick Accelerates second (buy trust), complex work and Fixes third. Enforces change capacity per function, because ten good ideas can still break an organisation if they all land in one place. |
| `map_to_taxonomy` | Maps everyday business language (customer service, procurement, banking, GenAI copilot, bureaucratic) onto the canonical enums, deterministically, with suggestions instead of guesses when there is no confident match. |

The portfolio chain, in order: `assemble_portfolio` gets messy inputs into the right shape, `validate_portfolio` checks the document, `score_portfolio` returns the verdicts, `sequence_portfolio` turns them into a rollout plan. The assembler structures, the scores advise.

## Spec

<https://www.aibvf.com/protocol>

## Anonymous Usage Telemetry

To separate real agent traffic from scanner noise, aibvf-mcp can send a small, anonymous event on each tool call. The payload is:

- `ts` — timestamp
- `tool_name` — one of the tool names above
- `bvf_version` — the protocol version
- `package_version` — the published `aibvf-mcp` release
- `entry_route` — `stdio` for a local installation or `remote` for the hosted connector
- `assessment_stage` — whether `assess_ai_initiative` asked for an input or returned a verdict
- `work_architecture_status` — `ready`, `gap`, or `unknown` when a verdict tests the work around the AI
- `caller_hash` — a daily-rotated, one-way hash for daily activity counts
- `install_hash` — a stable one-way hash sent by local stdio installations only, for repeat-use measurement across days
- `industry`, `function`, `ai_tier`, `readiness` — the taxonomy values (never the numeric scores, revenue, or portfolio content)
- `user_role` — an optional broad role sent only when a local user explicitly sets `AIBVF_USAGE_ROLE`; it is never inferred

No user IDs, no PII, no portfolio data, no scoring results, no stack traces.

**How the hashes work.** On first run the local server generates 16 random bytes and stores them in `~/.config/aibvf/install-id`. Neither hash is derived from a hostname, username, account or machine identifier, and the random seed never leaves the machine. `caller_hash` changes every 24 hours for daily activity counts. `install_hash` is stable across days so repeat local use can be measured, and is left empty for remote calls because a serverless process cannot identify the person using it. Set `AIBVF_TELEMETRY_DISABLE=1` to prevent the dotfile and every telemetry event.

The install-id file is created only when an event is actually sent. If you opt out, no file is written. If the file cannot be written (read-only filesystem, locked-down container), the server uses a per-process random seed instead and that run counts as its own caller. To reset your anonymous identity at any time, delete `~/.config/aibvf/install-id`.

To add a broad role, set `AIBVF_USAGE_ROLE` to one of `board_executive`, `ai_data_leader`, `business_function_leader`, `transformation_change`, `technology_delivery`, `risk_governance`, `finance_commercial`, `consultant_adviser`, `research_education`, or `other`. For example, add `"env": { "AIBVF_USAGE_ROLE": "ai_data_leader" }` to the local MCP server configuration. Leaving it unset records no role.

**Opt out** by setting `AIBVF_TELEMETRY_DISABLE=1` in your environment — no events are sent and no install-id file is created. **Redirect** to your own backend by setting `AIBVF_TELEMETRY_URL` and `AIBVF_TELEMETRY_KEY`.

## License

MIT.
