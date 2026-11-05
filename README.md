# AI BVF: review one AI investment decision

Turn an AI proposal into a decision brief: the verdict, the evidence gaps and the next action for the person who owns the work.

## Try one proposal in your browser

Open [aibvf.com/start](https://www.aibvf.com/start). Your first assessment needs no account or installation.

Paste this synthetic example, or describe a proposal you are reviewing:

> We are a EUR 2.4bn manufacturer considering GenAI for predictive maintenance in our supply chain. Our operating model is traditional. We have a sponsor, but the affected roles, human override rights and performance measures still need review.

Run the assessment, check how the proposal was interpreted, and correct the assumptions. The assessment asks for unresolved inputs and marks estimated pillar scores. Keep the action list, name an owner and return with evidence when the work changes.

### The decision brief

The result brings the following questions together. This is an illustrative reading guide for the example, with the engine's field names documented below.

| Part of the brief | What to review |
|---|---|
| Verdict | Stop, Fix or Accelerate, with the rule that produced the call. An initial proposal with estimated pillars remains provisional. |
| Evidence gaps | Which inputs were supplied, which were estimated, and what remains unknown about workflow, roles, decision rights and measures. |
| Planning benefit | A readiness-adjusted EUR scenario. Build costs, operating costs, change costs and financial timing still need a separate business case. |
| Decision score | A 0 to 100 summary of pillar inputs and input completeness. It has no calibrated probability interpretation. |
| Next action | The evidence or work change needed before another review, with an accountable owner assigned by the team. |

For the example above, the first useful action is to evidence the proposed workflow and its owners. An Accelerate verdict requires the pillar thresholds to clear and all four work architecture checks to be met.

[See the reproducible worked example](docs/worked-example.md) for exact inputs, calculations and a re-score that stays at Fix until the work architecture is evidenced.

## Bring the assessment into your existing workflow

The browser is the first-use route. The hosted connector and local MCP package let an assistant repeat the assessment while you work on a proposal.

### Hosted connector on claude.ai

Open Settings, then Connectors, then Add custom connector, and paste:

```text
https://mcp.aibvf.com/api/mcp
```

Then ask:

> Assess this AI initiative using AI BVF: we are a EUR 2.4bn manufacturer considering GenAI predictive maintenance, with a traditional operating model. Resolve the inputs, show the assumptions and identify the evidence needed for the next decision.

### Local with Claude Desktop, Claude Code or Cursor

Add this configuration to your MCP client:

```json
{
  "mcpServers": {
    "aibvf": { "command": "npx", "args": ["-y", "aibvf-mcp"] }
  }
}
```

Quit and restart the client. Windows uses `cmd /c`; the [client setup and troubleshooting guide](packages/mcp/README.md#wire-into-claude-desktop--cursor--any-mcp-host) contains the complete configuration.

Start with `assess_ai_initiative`. Use `recommend_improvements` for a Fix or Stop, review the proposed actions with the people who own the work, and re-score after the evidence changes.

## How to read a result

AI BVF is a deterministic planning model with disclosed assumptions. The source and formulas can be inspected, and identical inputs produce identical outputs for a given engine version.

The four pillars are Strategic Alignment, Financial Return, Change Enablement and Governance Risk. `GR >= 70` or `FR <= 20` returns Stop; `SA >= 60`, `FR >= 60`, `CE >= 60` and `GR <= 40` clear the pillar test for Accelerate. A gap, partial assessment or missing work architecture evidence holds an otherwise green initiative at Fix.

Keep these boundaries with the result:

- **Decision score.** Existing API fields `confidence`, `decision_confidence` and `projected_confidence` retain their names for compatibility. These are rule-based scores, with no measured probability of project success or prediction accuracy.
- **Planning benefit.** The scorer's `net_low_eur`, `net_high_eur` and MCP `net_value_eur` apply a readiness capture assumption to a revenue-based benefit scenario. Project costs, margins, timing and overlap are outside that calculation.
- **Research context.** External research informs the questions. It does not publish or validate the AI BVF function rates, industry multipliers, readiness capture percentages or drag rates.
- **Module labels.** `applied_modules` records implementation context. Labels such as `healthcare_clinical_validation` and `financial_dora_module` do not perform clinical validation or certify regulatory compliance.
- **Supplied evidence.** The engine records supplied values and work architecture checks. The organisation remains responsible for reviewing the evidence behind them.

Read the [scoring formulas](docs/scoring-formulas.md) and [worked example](docs/worked-example.md) before using the outputs in a funding decision.

## Tools for developers

Thirteen tools are exposed through local stdio and the hosted Streamable HTTP connector.

| Tool | Purpose |
|---|---|
| `assess_ai_initiative` | Resolve a plain-English proposal, request missing decision inputs and return the assessment. |
| `score_initiative` | Score explicit inputs, apply the work architecture gate, and return reasoning, audit and sensitivity. |
| `recommend_improvements` | Propose pillar actions and work redesign steps for a Fix or Stop. Re-score evidence before accepting a projected outcome. |
| `assemble_portfolio` | Structure loose portfolio inputs, resolve aliases and disclose estimated pillars. |
| `validate_portfolio` | Validate a portfolio document against the published JSON Schema. |
| `score_portfolio` | Score a portfolio and return its aggregate shape. Review benefit overlap before using a total. |
| `sequence_portfolio` | Produce rollout waves with change-capacity constraints and named gates. |
| `diagnose_process` | Evaluate observed process signals and return an intervention with its modelled effect. |
| `infer_readiness` | Infer a readiness classification from supplied process signals and report coverage. |
| `calculate_pace_layer_drag` | Return a directional scenario for operating-model friction using disclosed rates. |
| `get_benchmark` | Return AI BVF planning rates with evidence status and use guidance. |
| `list_taxonomy` | List the accepted industries, functions, AI tiers and readiness levels. |
| `map_to_taxonomy` | Map everyday business terms to the supported taxonomy and expose unresolved terms. |

For portfolios, use `assemble_portfolio`, `validate_portfolio`, `score_portfolio`, then `sequence_portfolio`. An aggregate modelled range needs a separate review of overlapping work and shared benefits.

## Packages and public specification

| Package | Version | Purpose |
|---|---|---|
| [`aibvf-mcp`](packages/mcp) | 0.14.15 | MCP server, 13 tools, stdio plus hosted Streamable HTTP at mcp.aibvf.com. |
| [`aibvf-check`](packages/cli) | 0.1.1 | Policy checks for a declared AI initiative manifest in CI. |
| [`@aibvf/core`](packages/js) | 0.10.6 | TypeScript assessment and scoring engine. |
| [`aibvf`](packages/py) | 0.2.2 | Python scoring engine and validator. Check its documented feature coverage before substituting it for the TypeScript implementation. |

The [public portfolio specification](spec/bvf-protocol.schema.json) is version 1.0. That document format has a separate version from the packages implementing it; the package version identifies the code and behaviour used for a particular assessment.

[Protocol page](https://www.aibvf.com/protocol) · [npm package](https://www.npmjs.com/package/aibvf-mcp) · [MCP registry](https://registry.modelcontextprotocol.io/v0/servers?search=aibvf) · [Release history](CHANGELOG.md)

## Anonymous usage telemetry

The MCP server can report tool calls and a `server_connect` event. Events include protocol and package versions, entry route, assessment stage, work architecture status, taxonomy fields, a daily-rotated caller hash, and classification plus confidence where supplied.

Local stdio calls also include a stable one-way `install_hash` for repeat-use measurement, derived from a random local seed. Hosted calls send no stable install hash, and a broad `user_role` is sent only when a local user explicitly sets `AIBVF_USAGE_ROLE`.

No portfolio content, revenue figures, numeric pillar scores or personal identifiers are included. Set `AIBVF_TELEMETRY_DISABLE=1` to prevent events and creation of the local install-id file. Point at your own backend with `AIBVF_TELEMETRY_URL` and `AIBVF_TELEMETRY_KEY`.

Package downloads include repeat installs, dependencies and automation. Use completed assessments and subsequent decision reviews to evaluate adoption.

## Contribute a case or a correction

Bring a reproducible counterexample: the inputs, actual output, expected decision, supporting evidence and engine version. The [contribution guide](CONTRIBUTING.md) includes a template and explains the review and licensing boundaries.

The [ten-team pilot pack](docs/adoption-pilot.md) defines the first-use and return-use checks, interview prompts and tracker. Examples in this repository are synthetic unless a case explicitly records consent and its evidence.

If AI BVF helped you review a decision, [star the repository](https://github.com/Craig-Horton/ai-bvf) or share a counterexample. Both give the project useful feedback.

## License

Repository source code is MIT licensed under [LICENSE](LICENSE). The specification and JSON Schema under `spec/` are CC-BY-4.0, and the AI BVF names and logo are trademarks, as set out in [NOTICE](NOTICE).

Private benchmark material and certification marks are outside the source-code contribution route. The [contribution guide](CONTRIBUTING.md#licensing-and-contribution-boundaries) explains how to discuss those materials without changing the rights granted by the repository licenses.

## About the author

Craig Horton is an independent transformation lead based in Amsterdam and the author of the AI Business Value Framework. His work connects AI investment decisions with organisational readiness and the redesign of work.

[The Transformation Brief](https://brief.craighortonadvisory.com) · [Craig Horton on LinkedIn](https://linkedin.com/in/Craig-Horton-ai)
