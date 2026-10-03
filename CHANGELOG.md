# Changelog

All notable changes to `aibvf-mcp`, `@aibvf/core`, `aibvf-check`, and `aibvf`, in reverse chronological order.

## 0.14.14 (aibvf-mcp), 0.10.6 (@aibvf/core), 3 October 2026

Fixed: plain-English assessment distinguishes company revenue from project budgets and project income. Ambiguous amounts, ranges, foreign currencies and non-annual revenue require clarification.

Fixed: MCP portfolio assembly and scoring preserve work architecture and supplied-versus-estimated provenance. Portfolio responses retain per-initiative audit, sensitivity and input-quality evidence.

Changed: result interpretation identifies the decision score as a heuristic and the EUR range as a benefit scenario before project costs. Sector labels do not certify compliance, and portfolio sums require an overlap review.

Changed: onboarding starts with one browser assessment. Adoption reporting distinguishes observed connections, tool use, completed assessments and repeat tool-use days. A ten-team pilot pack defines the next validation work.

Added: executable worked-example and release-contract checks. GitHub releases are created after package publication succeeds.

Distribution: the current MCP registry listing publishes the npm package. The registry assigns the hosted URL to the previous io.github.Bahamas1717/aibvf-mcp identity; migrating that ownership remains a follow-up. The hosted connector remains available through its documented URL.

Scope: scoring formulas and existing response fields remain compatible. Direct core portfolio assembly retains its previous metadata behavior. Pilot targets are proposed validation criteria; no pilot outcomes are claimed.

## 0.14.13 (aibvf-mcp), 3 October 2026

Fixed: `score_initiative` returns the audit trail and sensitivity analysis. `recommend_improvements` returns its audit evidence.

Added: MCP response regression tests exercise actual client and server calls. Pull requests and package publication run the full test suite.

Changed: onboarding guides begin with a plain English assessment. Telemetry documentation describes the optional verdict, confidence and anonymous installation identifier accurately.

## 0.14.6 (aibvf-mcp), 23 August 2026

Changed: every tool input now explains its intent, accepted ranges, defaults and interaction with neighbouring tools. `recommend_improvements` names when it should and should not be called, while `sequence_portfolio` and `assemble_portfolio` now describe every input field. The tool count, scoring rules and verdicts are unchanged.

## 0.14.5 (aibvf-mcp), 23 August 2026

Changed: Fix and Stop verdicts now open the shared AI BVF feedback page, where a user can answer Yes, Partly or No and optionally say what the framework should do more of or stop doing. Responses are anonymous, no assessment content is attached, and the tool count remains frozen at thirteen.

## 0.14.4 (aibvf-mcp), 20 August 2026

Changed: the voluntary Fix and Stop feedback route now asks whether the verdict changed the next decision, what AI BVF should do more of, and what it should stop doing. The prefilled email carries only those questions, with no proposal, organisation, revenue, score or portfolio data added automatically.

## 0.14.3 (aibvf-mcp), 18 August 2026

Fixed: hosted tool calls now complete the anonymous telemetry write before returning the MCP response, while local stdio calls remain non-blocking. The database allowlist now covers the complete thirteen-tool surface, including `assess_ai_initiative` and `assemble_portfolio`.

## 0.14.2 (aibvf-mcp), 18 August 2026

Fixed: remote Vercel requests now stay alive briefly while anonymous telemetry is written, so the response cannot close before the adoption event reaches Supabase.

## 0.14.1 (aibvf-mcp), 18 August 2026

Changed: anonymous telemetry now separates the published package release from the AI BVF protocol version, records whether a call came through a local stdio installation or the remote connector, and records whether `assess_ai_initiative` asked for evidence or returned a verdict. Work architecture status is recorded with the verdict, while proposal text, organisation names, revenue, scores and portfolio content remain outside telemetry.

Added: local stdio installations send a stable one-way hash derived from the existing random installation seed, so repeat use can be measured across days without collecting a machine, account or user identifier. Remote calls leave this field empty because a serverless process cannot identify the person calling it.

Fixed: the hosted endpoint copy now reports the current thirteen-tool surface.

## 0.14.0 (aibvf-mcp) / 0.10.0 (@aibvf/core), 1 August 2026

Added: a deterministic work architecture gate inside the existing assessment and improvement tools, with no increase in the thirteen-tool surface. `assess_ai_initiative` and `score_initiative` now test four pieces of evidence: the end-to-end workflow has been redesigned, affected roles and accountabilities have been rewritten, human decision and override rights are named, and performance measures support the new work.

Changed: any explicit work architecture gap holds an otherwise green initiative at Fix. The verdict reports every check as met, gap or unknown, names the gaps, returns the next question and records the gate in the audit trail. Omitted evidence remains visible as unknown and does not silently become a pass.

Added: `recommend_improvements` turns a stated gap into a `work-architecture-redesign` play with an operating-model owner, role transition, sequenced steps, diagnostic questions, a stop condition and a re-score gate. The organisation now has to redesign the work around the technology before the verdict can become Accelerate.

## 0.13.0 (aibvf-mcp) / 0.9.0 (@aibvf/core), 22 July 2026

Added: `assess_ai_initiative`, the plain-English front door for one AI investment decision. It resolves industry, revenue, business function, AI tier and organisational readiness from the proposal, names every resolution, and asks one question for the first missing input. When all five inputs exist, it runs the same deterministic score as `score_initiative` and returns Accelerate, Fix or Stop with the value range, confidence, assumptions and audit trail. Explicit corrections override proposal inference, unresolved values are never guessed, and proposal text never enters telemetry.

Added to `@aibvf/core`: `assessInitiative()` and `extractRevenueEur()`, shared by the MCP server and browser experience. Three prepared sector cases cover retail, healthcare and financial services, alongside the missing-input and explicit-override tests.

Changed: the public `/start` page begins with the working plain-English assessment and the three prepared cases. Connector instructions follow the result.

Release rule: the MCP surface is fixed at thirteen tools through 0.15.x. The next two releases will improve activation, output and measurement without adding another tool.

## 0.12.3 (aibvf-mcp), 13 July 2026

Added: `score_initiative`, `score_portfolio` and `recommend_improvements` now return one voluntary question on Fix and Stop verdicts: “Did this change what you will do next? Tell me in one line.” The route is a prefilled email to Craig, no response is recorded unless the user chooses to send it. Accelerate verdicts carry no feedback prompt.

## 0.12.2 (aibvf-mcp), 13 July 2026

Changed: every MCP tool description now says when to call it, what its inputs change, what its defaults mean and which sibling tool applies when it does not. `calculate_pace_layer_drag` now distinguishes the cost of organisational delay from an AI build cost, directs process questions to `diagnose_process`, investment questions to `score_initiative`, and Fix plans to `recommend_improvements`. The calculation and its output contract are unchanged.

## 0.8.1 (@aibvf/core) / aibvf-check 0.1.1, 8 July 2026

Fixed: the assembler's id dedupe could loop forever on duplicate names whose slugs sit at the 64-character cap, because appending a suffix and truncating back reproduced the same string. The suffix now gets room inside the cap. Rare input, ugly failure, easy fix; regression test drives three identical 80-character names.

Bumped: `aibvf-check` finally moves its `@aibvf/core` range from `^0.3.4` to `^0.8.0`, five minors of engine behind it, including optional pillars with estimation, the audit block, sensitivity, and the assembler. 7/7 gate tests pass against the new engine.

## 0.12.0 (aibvf-mcp) / 0.8.0 (@aibvf/core), 8 July 2026

Added: **`assemble_portfolio`**, the twelfth tool, closing the one gap Glama's review named (no way to create a portfolio, only validate and score it). It assembles the canonical BVF v1.0 document from loose conversational inputs: aliases resolved through the same taxonomy mapping as `map_to_taxonomy` (pharma → healthcare, accounts payable → finance, agentic → gen3), ids generated from names and deduplicated deterministically, missing pillars estimated from readiness, tier, function and the published benchmarks with the estimation reported per initiative in `estimated_pillars` and carried at low confidence in the document, and the finished document validated before it is returned. The read-only contract holds: the document exists in the response only, nothing is stored, nothing is edited, no state between calls. Core exports `assemblePortfolio()`; the CLI gate can reuse it. 64/64 tests including determinism, alias resolution, id dedupe, estimation provenance, blocked-assembly suggestions, and the voice rules on all new output text.

Also: the hosted endpoint answers 405 to non-POST requests instead of holding a dead SSE stream open until the platform's 300-second timeout (the MCP spec's answer for servers that offer no GET stream), and `vercel.json` caps the function at 30 seconds.

## 0.11.3 (aibvf-mcp), 8 July 2026

Security: the `@modelcontextprotocol/sdk` dependency floor rises from `^1.0.0` to `^1.26.0`, in the package and in the hosted endpoint's root manifest. The old range admitted SDK versions carrying three published advisories (a high-severity ReDoS, DNS rebinding protection off by default, and a cross-client data leak via shared transport reuse, GHSA-8r9q-7v3j-jr4g, GHSA-w48q-cv73-mx4w, GHSA-345p-7cg4-v4c7); 1.26.0 is the first version clean of all three. No aibvf-mcp release ever shipped a vulnerable resolution (the lockfile resolved 1.29.0), and the hosted endpoint creates a fresh server and transport per request, so the leak pattern never applied. This closes the range on paper the way it was already closed in practice, which is what Snyk scores.

## 0.11.2 (aibvf-mcp) / 0.7.1 (@aibvf/core), 6 July 2026

Fixed: pillar scores accept bare numbers everywhere — `score_initiative`, `score_portfolio`, and the sequencer all take `strategic_alignment: 72` without requiring the object wrapper.

## 0.11.1 (aibvf-mcp), 5 July 2026

Fixed: `sequence_portfolio` accepts the document `score_portfolio` returns, so the natural two-step (score the portfolio, then sequence it) works without reshaping the payload between calls.

## 0.11.0 (aibvf-mcp) / 0.7.0 (@aibvf/core), 5 July 2026 — the board instrument release

Added, trust and friction: an **audit block on every scoring call** (engine version, rules fired, resolved inputs) so a challenged verdict reproduces months later without asking any model to remember anything — deterministic, no timestamps. **Sensitivity on `score_initiative`**: value at readiness one notch down, revenue minus 20 percent, and the nearest single-pillar movements that flip the verdict, because boards trust ranges with visible assumptions. **`claimed_readiness` on `infer_readiness`**: claimed vs measured compared, the gap returned as a finding — the organisation whose self-image runs ahead of its process data has just told you where the change work starts. **`map_to_taxonomy`**: plain language onto the taxonomy (customer service → cx, banking → financial, autonomous agents → gen3), suggestions instead of guesses on no match.

Added, the Sequencer: **`sequence_portfolio`** brings the Workflow Coroner's three-wave logic into the engine — Stops first (free the budget), quick Accelerates second (buy trust), complex work and Fixes third behind re-score gates, with change capacity enforced per function and every deferral reported as a conflict. Eleven tools. 55/55 tests including determinism, capacity conflicts, gap findings, alias resolution, and the voice rules on all new output text.

## 0.10.0 (aibvf-mcp) / 0.6.0 (@aibvf/core), 5 July 2026

Added: **`infer_readiness`** — measures organisational readiness from process signals (cycle times, rework, handoffs) instead of self-report. Ninth tool. 0.10.1 was a docs pass: nine tools everywhere, connector first on the npm page.

## 0.9.0 / 0.9.1 (aibvf-mcp), 5 July 2026

Added: `aibvf-mcp` served as a **hosted remote MCP connector** — Streamable HTTP at `mcp.aibvf.com/api/mcp`, listed in the MCP registry, with a browser-friendly landing page on the endpoint itself. claude.ai connects via Settings → Connectors → Add custom connector; no local install. 0.9.1 registered the remote in the MCP registry and put the connector on the site.

## 0.8.0 (aibvf-mcp) / 0.5.0 (@aibvf/core), 5 July 2026

Added: **pillar scores optional with deterministic estimation** — `score` accepts partial or absent pillar scores and fills the gaps deterministically from taxonomy and readiness, with `signal_completeness` haircutting confidence accordingly. A fully estimated pass can never return Accelerate.

## 0.7.0 (aibvf-mcp) / 0.4.0 (@aibvf/core), 5 July 2026

Added: **change-leader layer on `recommend_improvements`** — the change plan returned alongside the pillar recommendations when the verdict is Fix, in the change leader's language rather than the analyst's.

## aibvf-check 0.1.0, 30 June 2026

Added: a new package and the project's first non-MCP surface — **`aibvf-check`**, the AI BVF CI/CD pre-flight gate ("SonarQube for AI"). It reads a declared manifest of AI initiatives (`.aibvf.json`), scores each with the existing deterministic `@aibvf/core` engine, applies a policy, prints a scorecard, and exits non-zero when any initiative trips the gate — so a CI pipeline goes red on AI work that would not survive a board review. The scoring belongs upstream of the slide deck; this puts it in the one place a team already trusts to block bad work.

Policy supports `fail_on` (classifications that fail, default `["Stop"]`), `max_governance_risk` (hard ceiling regardless of verdict), and `min_decision_confidence` (floor). Per-initiative `signal_completeness` forwards to `score()`, so estimated inputs honestly haircut confidence and surface a caveat instead of sailing through on a confident-looking number — the 0.6.0 metadata-burden work, now enforceable in CI. Exit codes: `0` pass, `1` gate failed, `2` config error.

Distribution is the point: ships as `npx aibvf-check` and as a composite **GitHub Action** (`uses: Craig-Horton/ai-bvf@<tag>` with an optional `manifest` input) so adoption is a few lines in a workflow, discoverable in the GitHub Marketplace. The gate logic is a pure, unit-tested function (`runCheck`) with side effects isolated in the CLI entry; 7 tests cover pass, each policy lever, default policy, multi-initiative aggregation, and manifest linting. Reuses 100% of the scoring engine — no new scoring maths. Manifest is human/PR-authored JSON (not auto-scraped), keeping the `signal_completeness` honesty discipline. Zero runtime dependencies beyond `@aibvf/core`. A worked example ships at `.aibvf.example.json`.


## 0.6.0 (aibvf-mcp) / 0.3.4 (@aibvf/core), 30 June 2026

Added: an optional `signal_completeness` (0–1) input on `score_initiative`, and a matching `caveat` output field. This answers the most substantive piece of external feedback on the framework — the "metadata burden" critique that the scoring is only as good as the change-readiness and risk metadata an organisation feeds it, so soft inputs produce a falsely confident verdict. `score_initiative` now mirrors what `diagnose_process` already does with its own `signal_completeness`: when the four pillar scores are estimated rather than measured, the caller sets `signal_completeness` below 1, decision confidence is haircut proportionally (`confidence = base × (0.5 + 0.5 × signal_completeness)`), and a `caveat` is attached telling the reader the verdict rests on soft inputs and should be re-run with measured scores before committing budget. "Garbage in" now yields "low-confidence, stated honestly" instead of "confident garbage out".

Backward compatible by construction: `signal_completeness` defaults to 1 (treated as measured), at which the multiplier is exactly 1.0 and confidence is byte-identical to the pre-0.3.4 formula. Existing callers, the worked examples, and the smoke-test fixture (manufacturing GenAI predictive maintenance, confidence 62) are unaffected. `recommend_improvements` keeps the plain input schema and is unchanged; only `score_initiative` exposes the new field. `score()` clamps the value to [0,1] and never lets it change the classification — only the confidence and the caveat.

Added: `packages/js/src/score.test.ts` covering the default-unchanged property, the monotonic haircut, clamping, classification-invariance, and the caveat threshold (0.7).

Bumped: `@aibvf/core` 0.3.3 → 0.3.4 (new optional input + output field on `score`), `aibvf-mcp` 0.5.1 → 0.6.0 (new tool capability), and the MCP dependency range to `^0.3.4`. Version synced across the `Server({ version })` handshake, startup banner, `packages/mcp/package.json`, and `server.json`.

## 0.5.1 (aibvf-mcp), 28 June 2026

Changed: rewrote the `diagnose_process` tool description, which Glama's first v0.5.0 scan scored 4.1/5 — the lowest of the eight tools and, because the server-level Tool Definition Quality score is 60% mean + 40% minimum, the one pinning the whole server's TDQS. The previous description explained what the tool does in a single run-on sentence but never told an agent when to reach for it versus `score_initiative` (the Usage Guidelines dimension) and was dense to parse (Conciseness & Structure). The new description leads with a "CALL THIS WHEN the user describes a real, running process…" trigger, explicitly frames the tool as the operational counterpart to `score_initiative` (diagnose an existing process vs score a proposed initiative), points at `list_taxonomy` for the function enum, and adds the partial-signals guidance that the high-scoring tools carry (pass what you have, set `signal_completeness` accordingly). `score_initiative`'s description gains a reciprocal pointer at `diagnose_process` so the two are cross-linked both ways. Description-only edits; no change to any handler, input/output schema, or computed value.

Bumped: `aibvf-mcp` from 0.5.0 to 0.5.1 across the `Server({ version })` handshake, the startup banner, `packages/mcp/package.json`, and `server.json` (server-level and `packages[0]`). `@aibvf/core` unchanged at 0.3.3.

## 0.5.0 (aibvf-mcp), 26 June 2026

Added: an eighth tool, `score_portfolio`, that takes an AI BVF v1.0 portfolio document plus a single organisational `readiness` value and returns the board-level shape in one call — Accelerate/Fix/Stop counts, aggregate modelled EUR value range (integer EUR via the shared `eurRange` helper), mean decision confidence, the top initiative by mid-point value, the highest-risk initiative (worst classification, tie-broken by lowest decision confidence), and the per-initiative scoring results. Schema validation runs first; on a malformed portfolio the response sets `valid=false` and reports the validation errors without attempting to score. Initiatives that cannot be scored (missing `organization.revenue_eur`, unknown function/ai_tier) appear in `skipped_initiatives` rather than failing the call. Closes the Glama Server Coherence "Completeness" gap: previously `validate_portfolio` existed but no tool scored a portfolio in one call, so agents had to loop `score_initiative` per initiative. The portfolio schema does not carry per-initiative readiness, so this tool takes one organisational readiness value and applies it across all initiatives — realistic for a single organisation and explicit in the parameter description.

Added: MCP 2025-06-18 `annotations` on every tool (`title`, `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`). All eight BVF tools are pure reads against in-process data — the prose descriptions already said as much, but the annotations make the contract machine-readable, which is what Glama's Behavioural Transparency dimension scores against. No behavioural change to any handler.

Changed: `get_benchmark` description now states when to use it instead of `score_initiative` — the Glama Tool Definition Quality "Usage Guidelines" gap that was holding the min-weighted TDQS at 4.50. `score_initiative`'s description now ends with a pointer at `score_portfolio` so an agent looking at a portfolio is routed to the right tool. `list_taxonomy`'s "call this first when unsure" list now names `score_portfolio` and `diagnose_process` alongside the existing routes. `validate_portfolio` now mentions both single-initiative and whole-portfolio scoring as the next step after validation. All description-only edits; no behavioural change to any handler.

Bumped: `aibvf-mcp` from 0.4.4 to 0.5.0 across the `Server({ version })` handshake, the startup banner (now reads `8 tools: ..., score_portfolio, ..., diagnose_process`), `packages/mcp/package.json`, and `server.json` (server-level and `packages[0]` entries; the latter was on 0.4.3 against the package's 0.4.4, now synced). `@aibvf/core` is unchanged at 0.3.3 — `score_portfolio` reuses the existing `score()` and `validate()` exports.

## 0.4.2 (aibvf-mcp), 15 June 2026

Changed: the advisory call-to-action returned on Fix and Stop verdicts now leads with a booking link (a 20-minute teardown via Calendly) instead of only an email address. The CTA fires on exactly the verdicts where a human conversation pays, so this turns a high-intent moment into a low-friction next step rather than a passive email mention. Email remains as a fallback. No change to scoring, classification, or any computed value.

## 0.4.1 (aibvf-mcp), 14 June 2026

Fixed: the MCP confidence schema (decision_confidence / projected_decision_confidence were documented as 0-1 but the values are 0-100) and EUR rounding at the MCP layer (net/gross value ranges are now rounded to integer EUR via a shared helper, removing floating-point dust from the structured output).

## 0.4.0 (aibvf-mcp), 10 June 2026

Added: a declared `outputSchema` on all six tools, plus a `structuredContent` field on every tool response, hand-matched to each tool's real return shape. Through 0.3.x the tools advertised no output schema, so an MCP host (and Glama's scorer) had to infer the result format from prose — Glama read `calculate_pace_layer_drag` as returning a bare EUR number when it actually returns a low/high range, a drag rate, a pace-gap severity, drivers, and a source. Each tool now ships a JSON Schema describing its output and returns `structuredContent` conforming to it alongside the existing pretty-printed `text` block, so hosts get typed, machine-readable results and the contract is self-documenting. No change to the computed values or classification logic — the numbers and verdicts are identical to 0.3.5.

Two range shapes exist in the wire format and both are now schema-documented: `{low,high}` for modelled EUR/value ranges (`score_initiative`, `calculate_pace_layer_drag`) and `{lo,hi}` for the raw benchmark rates (`get_benchmark`).

Changed: tool descriptions now disclose that every tool is a pure deterministic calculation/lookup with no network, auth, or side effects (the behavioural-transparency gap Glama flagged), `calculate_pace_layer_drag`'s description no longer implies a scalar EUR output, and its `readiness`/`ai_tier`/`industry` parameters carry fuller descriptions (the `readiness` enum values are spelled out; `industry` notes its `universal` default).

Also synced two stale version strings to the release: the `Server({ version })` handshake and `server.json` were still reporting `0.3.3`.

This is the first release to lean on `@modelcontextprotocol/sdk` semantics from the 2025-06-18 spec (`outputSchema` + `structuredContent`); the installed SDK is 1.29.0 and the dependency range `^1.0.0` is unchanged, as `structuredContent` is a plain response field the low-level `Server` passes through unmodified.

## 0.3.5 (aibvf-mcp), 9 June 2026

Changed: tightened the tool definitions for `validate_portfolio`, `list_taxonomy`, and `get_benchmark` so each tool describes itself, its parameters, and its return shape well enough for an agent to use it without guessing. No behavioural change to the handlers — descriptions and JSON-schema parameter semantics only. Motivated by Glama's quality score, which is 70% Tool Definition Quality (scored per tool, with the weakest tool weighted heavily) and 30% Server Coherence: `validate_portfolio` now documents the expected portfolio shape rather than an opaque `object`, `list_taxonomy` states when to call it and that it is side-effect free, and `get_benchmark`'s `function`/`industry` parameters carry descriptions pointing back to `list_taxonomy`.

Also added `glama.json` at the repo root to claim the Glama listing, and tagged `v0.3.4` (the first 0.3.x GitHub release) so Glama's release-gated scoring can run.

## 0.3.4 (aibvf-mcp), 9 June 2026

Changed: `caller_hash` derivation, so the distinct-install metric is real for the first time. Through 0.3.3 the hash was `sha256(SESSION_ID + day)` where `SESSION_ID` was random bytes minted fresh on every process start, so `count(distinct caller_hash)` only ever equalled the number of server sessions — it could not tell one install running ten times from ten installs running once. From 0.3.4 the hash is `sha256(installId + day)`, where `installId` is 16 random bytes generated on first run and persisted to `~/.config/aibvf/install-id`. The id is stable per install (so daily distinct-caller counts are now genuine distinct installs) yet high-entropy, so the published hash cannot be brute-forced back to a machine or person — a property a hostname/username fingerprint would not have had. The id never leaves the machine; only the daily-rotated hash does. No payload fields changed.

The install-id is created lazily on the first telemetry send, never at import. `AIBVF_TELEMETRY_DISABLE=1` short-circuits in `logCall` before `callerHash` runs, so opt-out installs write no dotfile at all. If the dotfile cannot be read or written (read-only filesystem, locked-down container) the server falls back to a per-process random seed, so telemetry still fires and that run simply counts as its own caller — the pre-0.3.4 behaviour, failing closed.

Historical rows are not back-corrected: `server_connect` counts captured before 0.3.4 remain one-per-session. Clean distinct-install counts begin accruing only as 0.3.4 is adopted.

Fixed: a stray NUL byte that had crept into the `caller_hash` template literal in `packages/mcp/src/index.ts`, which caused tooling to misclassify the source as a binary file. The separator is now a plain space; hash values are unaffected in practice.

## 0.3.3 (aibvf-mcp) and 0.3.1 (@aibvf/core), in flight

Fixed: floating-point dust on EUR values returned by `score_initiative` and `calculate_pace_layer_drag`. Outputs like `net_value_eur: 7425000.000000001` would survive into screenshots and damage the perception of a deterministic engine. All EUR values are now rounded to integer EUR before return. The classification thresholds were never affected, this is a presentation fix only. Surfaced by an end-to-end stdio verification run on 1 June 2026.

`aibvf-mcp` and `@aibvf/core` ship paired in this release, both versions republish, the MCP server's dependency range `^0.3.0` continues to accept the new core.

## 0.3.2, in flight

Added: `server_connect` telemetry event, fires once per server session on stdio connect. Distinguishes installs that wired into a client (Claude Desktop, Cursor, custom orchestrator) from installs that sat in npm cache and never ran. Same opt-out (`AIBVF_TELEMETRY_DISABLE=1`) and same privacy contract as tool-call telemetry, no new payload fields. Active install count is now measurable as `select count(distinct caller_hash) from public.mcp_calls where tool_name = 'server_connect' and ts >= now() - interval '7 days'`.

Fixed: `LICENSE` now ships inside the published npm tarball for both `aibvf-mcp` and `@aibvf/core`. Previously the file lived only at the repo root, so Glama's scanner of the published package found no license and rated the listing F. The next Glama rescan after this publish moves the rating to A.

## Production fix, 29 May 2026 (no code release)

Fixed: anonymous telemetry pipeline silently dropping rows since v0.2.0 launched on 5 May 2026. Production Supabase columns were named `tool` and `version`. The MCP server source and the `20260421_mcp_calls.sql` migration both used `tool_name` and `bvf_version`. PostgREST rejected every write, the fire-and-forget telemetry block in `packages/mcp/src/index.ts` silently caught and discarded the errors.

Resolved by renaming production columns to match the source code:

```sql
alter table public.mcp_calls rename column tool to tool_name;
alter table public.mcp_calls rename column version to bvf_version;
```

No code change in this fix, no version bump, no user action required. The opt-out and privacy contracts in the README held throughout, the bug failed closed not open, no portfolio data was ever transmitted, less data was captured than the design intended.

Six weeks of anonymous usage shape data was not captured (5 May to 29 May 2026). Industry distribution, tool-call distribution, score-to-recommend conversion, and version adoption are unknown for the launch window. Going forward, the table is receiving rows as designed.

The 0.2.1 entry below claimed telemetry was "landing cleanly" after the classification-column migration. That verification did not include a 24-hour row-count check. Future telemetry changes will.

Full post-mortem on the project [Discussions](https://github.com/Craig-Horton/ai-bvf/discussions) thread.

## 0.3.1, 27 May 2026

Added: `advisory_next_step` field on Fix and Stop verdicts in `score_initiative` and `recommend_improvements`. Returns a one-line pointer to `craig@craighortonadvisory.com` for the calibration conversation the verdict implies. Accelerate verdicts remain unchanged.

Fixed: version-string drift across `packages/mcp/package.json`, `server.json`, the `Server({ version })` declaration in source, and the startup banner. All four now match.

Added: three-tier engagement section on the public landing page, Verdict Audit, Calibration Programme, Transformation Practice.

## 0.3.0, 14 May 2026

The v0.3 line. Synced major version across `aibvf-mcp` and `@aibvf/core`. Telemetry payload extended to carry `classification` and `confidence` for downstream calibration analysis.

## 0.2.3, 6 May 2026

Fixed: MCP registry publish workflow. Description shortened to 94 characters to meet the registry's 100-character cap.

## 0.2.2, 6 May 2026

Changed: description and keywords expanded for search discoverability on the MCP registry. The package was findable only under "aibvf" or "bvf" before this change.

## 0.2.1, 5 May 2026

Added: telemetry diagnostics banner on startup. The MCP server now prints a clear opt-out path on stderr.

Added: feedback link in the startup banner pointing at GitHub Discussions.

Added: provenance attestation on the npm publish workflow.

Fixed: telemetry POST not firing due to schema mismatch on the Supabase target table. Migration `20260422_mcp_calls_add_classification.sql` was missing from production. Re-aligned, telemetry now lands cleanly.

Fixed: auto-unlock BVF gate from URL parameter on the public protocol page.

## 0.2.0, 5 May 2026

First feature-complete release. Six tools on stdio:

- `score_initiative`
- `recommend_improvements`
- `calculate_pace_layer_drag`
- `validate_portfolio`
- `get_benchmark`
- `list_taxonomy`

Anonymous telemetry with opt-out via `AIBVF_TELEMETRY_DISABLE=1`. Deterministic four-pillar scoring against published benchmark ranges. Schema validation against AI BVF v1.0.

Industry modules included: healthcare clinical validation, financial services capture multipliers, cross-industry readiness capture rates from EY/Oxford, Prosci change-success calibration, Pace Layer drag calculation.

## 0.1.0 to 0.1.4, April 2026

Initial protocol drafts, registry plumbing, and pre-feature-complete iterations.
