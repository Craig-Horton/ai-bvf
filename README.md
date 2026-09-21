# AI BVF MCP: Stop Bad AI Projects Before Agents Recommend Them

The scoring tool your Claude agent calls before it recommends an AI deployment. It checks the business case, operating-model readiness, change enablement, governance exposure and whether the work itself has been redesigned, then returns **Accelerate**, **Fix**, or **Stop** with modelled EUR value, decision confidence, and a specific list of what to do next.

[![npm](https://img.shields.io/npm/v/aibvf-mcp?color=111&label=npm)](https://www.npmjs.com/package/aibvf-mcp)
[![mcp registry](https://img.shields.io/badge/mcp--registry-active-111)](https://registry.modelcontextprotocol.io/v0/servers?search=aibvf)
[![Glama score](https://glama.ai/mcp/servers/Craig-Horton/ai-bvf/badges/score.svg)](https://glama.ai/mcp/servers/Craig-Horton/ai-bvf)
[![npm downloads](https://img.shields.io/npm/dm/aibvf-mcp?color=111&label=downloads%2Fmo)](https://www.npmjs.com/package/aibvf-mcp)
[![GitHub stars](https://img.shields.io/github/stars/Craig-Horton/ai-bvf?style=social)](https://github.com/Craig-Horton/ai-bvf/stargazers)
[![license](https://img.shields.io/badge/license-MIT-111)](LICENSE)

> If you think AI agents should check business value, governance risk, and change readiness before recommending deployment, [star this repo](https://github.com/Craig-Horton/ai-bvf/stargazers). The signal helps other agents discover the BVF and keeps the benchmarks improving in public.

## What You Get Back

Ask your agent:

> Score a gen2 CX AI initiative for a EUR 400M retailer with traditional readiness, Strategic Alignment 70, Financial Return 50, Change Enablement 55, Governance Risk 45.

Expected shape of the answer:

```text
Classification: Fix
Decision confidence: 54
Net value range: EUR 10.8M-EUR 37.8M
Applied modules: four_pillar_base, readiness_capture_traditional, retail_cx_benchmark
Why: Strategic alignment is credible, but change enablement and financial return are not yet strong enough to defend an Accelerate call.
Next: raise Change Enablement by 15 points, name an accountable owner, fund adoption, and rerun recommend_improvements.
```

This is the missing pre-flight check for agentic AI work: not "can we build it?", but **should this work survive a board review?**

## What It Does

Thirteen tools, callable from any MCP-compatible agent over stdio (npx) or as a hosted remote connector at https://mcp.aibvf.com/api/mcp (claude.ai: Settings, Connectors, Add custom connector). The tool count is fixed through 0.15.x while the next two releases improve the route into the verdict.

| Tool | Purpose |
|---|---|
| `assess_ai_initiative` | Plain-English front door for one AI decision: resolves the five scoring inputs, tests the work architecture, asks once for every unresolved input, then returns the verdict. |
| `score_initiative` | Four-pillar score plus a work architecture gate returns Accelerate, Fix, or Stop with EUR value range, decision confidence, applied modules and reasoning. |
| `score_portfolio` | Scores every initiative in a BVF portfolio in one call and returns the board-level shape: Accelerate/Fix/Stop counts, aggregate EUR value, mean decision confidence, top initiative by value, highest-risk initiative. |
| `assemble_portfolio` | Assembles a valid BVF v1.0 portfolio document from loose inputs: names, plain-language functions and tiers, and whatever pillar scores exist. Aliases resolved, ids generated, missing pillars estimated with the estimation reported per initiative, document validated before return. Nothing stored, nothing edited. |
| `recommend_improvements` | For Stop or Fix, returns the pillar raises and named change plays, including workflow and role redesign when the work architecture has a gap. |
| `calculate_pace_layer_drag` | Annual Organisational Drag Cost in EUR from AI-tier vs operating-model misalignment. |
| `validate_portfolio` | Validates a portfolio JSON document against the BVF v1.0 schema. |
| `get_benchmark` | Looks up the disclosed AI BVF planning rates for a business function and industry, with evidence status and use guidance. |
| `list_taxonomy` | Returns valid values for industries, functions, AI tiers, readiness levels. |
| `diagnose_process` | AI BVF Advisor Brain: diagnoses one business process from observed signals (volume, labour, cycle time, handoffs, rework, automation, spend) and returns heaviness, intervention, net EUR saving, efficiency gain, verdict, and decision confidence. |
| `infer_readiness` | Measures organisational readiness from process signals (hand-offs, rework, touch ratio, automation, cycle time vs function medians) instead of accepting self-report. Returns the classification the data supports, per-signal reasoning, and a confidence set by coverage and agreement. When the measured answer is lower than the claimed one, that gap is itself a change-readiness finding. |
| `sequence_portfolio` | Turns a scored portfolio into a three-wave rollout plan with named gates: Stops first (free the budget), quick Accelerates second (buy trust), complex work and Fixes third. Enforces change capacity per function, because ten good ideas can still break an organisation if they all land in one place. |
| `map_to_taxonomy` | Maps everyday business language (customer service, procurement, banking, GenAI copilot, bureaucratic) onto the canonical enums, deterministically, with suggestions instead of guesses when there is no confident match. |

The portfolio chain, in order: `assemble_portfolio` gets messy inputs into the right shape, `validate_portfolio` checks the document, `score_portfolio` returns the verdicts, `sequence_portfolio` turns them into a rollout plan. The assembler structures, the scores advise.

## 30-Second Install

Run it directly:

```bash
npx -y aibvf-mcp
```

Or install globally:

```bash
npm install -g aibvf-mcp
```

Register with Claude Desktop, Claude Code, or any MCP client:

```json
{
  "mcpServers": {
    "aibvf": { "command": "aibvf-mcp" }
  }
}
```

Ask your agent: "score a gen2 CX AI initiative for a 400M EUR retailer, traditional readiness, SA 70, FR 50, CE 55, GR 45," and the agent will call `score_initiative`, return a Fix classification with a concrete gap list, and offer to call `recommend_improvements` next.

## Why This Exists

Agents confidently recommend AI projects with no reference to the business case, no reference to operating-model readiness, and no reference to governance exposure. The scoring belongs upstream of the slide deck, inside the agent's pre-flight check before the budget gets committed.

The protocol is open, the benchmarks cite McKinsey, Gartner, BCG, Deloitte, Forrester, Accenture, ServiceNow, and readiness capture rates come from EY/Oxford and Prosci change-success research.

## About The Methodology

aibvf-mcp is the runtime arm of the AI Business Value Framework, the methodology I have been building since going independent in 2024 to evaluate AI investments against the measurable outcomes that survive a board review. The framework sits inside the AI Readiness Blueprint, a six-driver diagnostic informed by the EY/Oxford research on transformation success. The weekly applied case studies live in The Transformation Brief, where the calibration gets argued in public.

The advisory practice puts the framework in front of senior leaders making AI investment decisions inside enterprises with EUR 500m or more revenue. The MCP server makes the same scoring available to anyone running a Claude agent.

## The Four Pillars

Every initiative is scored on four pillars, 0 to 100, honest self-assessment.

1. **Strategic Alignment**, how clearly this moves a board-level KPI.
2. **Financial Return**, strength of the modelled return.
3. **Change Enablement**, sponsor in place, owner named, change budget funded.
4. **Governance Risk**, regulatory and reputational exposure. Higher value means more risk.

Rules are deterministic, no network, no dependencies. `GR >= 70` or `FR <= 20` returns Stop, all four pillars at or above 60 with `GR <= 40` returns Accelerate, anything else returns Fix with a specific gap list.

The work architecture gate then tests four questions: has the end-to-end workflow been redesigned, have affected roles and accountabilities changed, are human decision and override rights named, and do the measures support the new work? Any explicit gap holds an otherwise green initiative at Fix until the work has been redesigned and re-scored.

See `docs/scoring-formulas.md` for every formula and `docs/worked-example.md` for a full run on a healthcare portfolio.

## Example: Scoring an Agentic Healthcare Initiative

```js
import { score, recommendImprovements, calculatePaceLayerDrag } from '@aibvf/core';

const r = score({
  industry: 'healthcare',
  revenue_eur: 800_000_000,
  function: 'cx',
  ai_tier: 'gen3',
  readiness: 'traditional',
  scores: {
    strategic_alignment: 75,
    financial_return:    55,
    change_enablement:   40,
    governance_risk:     55,
  },
});
// { classification: 'Fix', net_low_eur: 23_760_000, net_high_eur: 83_160_000,
//   confidence: 54, applied_modules: ['four_pillar_base',
//   'readiness_capture_traditional', 'healthcare_clinical_validation',
//   'healthcare_regulatory_overhead'], ... }
```

Same inputs through `recommendImprovements` return three pillar raises, each with a named action, and project a new decision confidence of 68 with target classification Accelerate. `calculatePaceLayerDrag({ revenue_eur: 800_000_000, ai_tier: 'gen3', readiness: 'traditional' })` returns 20M to 36M EUR of annual Organisational Drag Cost, the structural friction cost of running gen3 in a traditional operating model, separate from the AI build.

## Packages

| Package | Version | Purpose |
|---|---|---|
| [`aibvf-mcp`](packages/mcp) | 0.14.9 | MCP server, 13 tools, stdio plus hosted Streamable HTTP at mcp.aibvf.com. |
| [`aibvf-check`](packages/cli) | 0.1.1 | CI/CD pre-flight gate ("SonarQube for AI") + GitHub Action. |
| [`@aibvf/core`](packages/js) | 0.10.3 | TypeScript scoring engine, plain-English assessment, work architecture gate, change-leader plans, readiness inference, and Advisor Brain. |
| [`aibvf`](packages/py) | 0.2.2 | Python scoring engine and validator. |

## Anonymous Usage Telemetry

The MCP server reports a small anonymous payload on each tool call (`tool_name`, BVF version, taxonomy fields, a daily-rotated caller hash, and classification plus confidence for `score_initiative`) and a single `server_connect` event when the server first wires into a client. No portfolio content, no revenue figures, no user identifiers. Opt out with `AIBVF_TELEMETRY_DISABLE=1`. Point at your own backend with `AIBVF_TELEMETRY_URL` and `AIBVF_TELEMETRY_KEY`.

## Protocol

Full schema at `spec/bvf-protocol.schema.json`. Protocol page at [www.aibvf.com/protocol](https://www.aibvf.com/protocol).

## Contributing

The benchmark ranges are directional, the industry multipliers are a starting calibration, and the protocol depends on public review to improve. File an issue or push a PR. The calibration will argue itself out in public.

## License

The scoring engine and the MCP server are **MIT** licensed — see [`LICENSE`](LICENSE). The AI BVF Protocol specification and JSON Schema under `./spec/` are **CC-BY-4.0**, and the "AI BVF" / "AI BVF Certified" names and logo are trademarks; both are covered in [`NOTICE`](NOTICE). The benchmark corpus and certification marks are proprietary.

## About The Author

Craig Horton is an independent transformation lead based in Amsterdam, with twenty years supplier-side at HPE, Atos, Microsoft, Salesforce, and Accenture. He runs Craig Horton Advisory and writes The Transformation Brief, a weekly publication for senior leaders making AI investment decisions, with executive education at Saïd Business School, Oxford, and an AMBA-accredited Global Executive MBA with AI in progress at the University of Hertfordshire. Find the Brief at [brief.craighortonadvisory.com](https://brief.craighortonadvisory.com), and reach out at [linkedin.com/in/Craig-Horton-ai](https://linkedin.com/in/Craig-Horton-ai).
