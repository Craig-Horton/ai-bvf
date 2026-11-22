# Changelog

All notable changes to `aibvf-mcp`, `@aibvf/core`, `aibvf-check`, and `aibvf`, in reverse chronological order.

## 0.19.0 (aibvf-mcp), 22 November 2026

Changed: the field `advisory_next_step` is now `method_note`. It carries the same line as before: where the method and the code are published. A caller that read the old name has to read the new one.

Why: AI BVF is a personal project, built in Craig Horton's own time. Nothing in it offers a service, so nothing in its output should be named as if it did.

Changed: two tool descriptions no longer speak of advisory use. The package READMEs and the repository say "a personal project by Craig Horton, built in his own time".

Scope: one field renamed in the output of five tools. No verdict, score, threshold or rule changes. `@aibvf/core` stays at 0.14.1, and the 13-tool catalogue, `aibvf-check` 0.1.1 and the Python package 0.2.2 are unchanged.

## 0.18.1 (aibvf-mcp), 0.14.1 (@aibvf/core), 22 November 2026

Added: `open_questions` on `assess_ai_initiative` in evidence mode. It lists every guided question still without an answer, each with its choices and where to look. An agent working alone reads all five on its first call and answers them in one call.

Why: the first agent to run AI BVF from outside, in OpenClaw on 21 November, could not answer the question on how the work changes. The tool showed the choices for one question at a time, and it asks that question only when the other four clear. The agent had the evidence and never saw the choices to answer from, so its brief carried four answers and the site's own agent carried five.

Changed: on a verdict reached without that answer, `open_questions` names what is still open. Nothing waits on it. An agent that answers it with its quote and calls again gets the answer in the brief.

Changed: the refusal of the four work checks in evidence mode says what to do: answer `work_architecture` in `answers` with a to d, and quote it in `evidence`.

Changed: the operating brief is version 2. It tells the agent to answer all five questions in one call. The tool description, the server instructions and the skill in `skills/aibvf-agent` say the same, and `aibvf-agent.zip` is rebuilt.

Changed: a Fix or Stop verdict no longer offers a call. `advisory_next_step` read "Book a 20-minute teardown", with a booking address and an email address. It now reads "Every rule behind this Fix verdict is published. Read the method and the code", with the address of this repository. The field keeps its name so that existing callers do not break.

Why: AI BVF is free and its author earns nothing from it. A tool that judges an initiative and then offers a call reads as a sales route.

Scope: a person is still asked one question at a time and never sees `open_questions`. The score each answer carries, the thresholds, the stop rules, the order of the questions and the 13-tool catalogue are unchanged. The same answers give the same verdict as before. `aibvf-check` 0.1.1 and the Python package 0.2.2 are unchanged.

## 0.18.0 (aibvf-mcp), 0.14.0 (@aibvf/core), 21 November 2026

Changed: `diagnose_process` chooses the intervention by the first rule that fits. Rare and heavy still comes first: under 250 instances a year with heaviness of 50 or more is Eliminate / insource. Two rules are new. A process where 30 percent of cases or more are reworked is Quality controls. A process with 15 minutes of work or less on each case, one person at most and 1,000 instances a year or more is Automate. Otherwise the largest drag factor decides, as before.

Why: waiting is the largest drag factor in almost every log of cases. On a ticket log the old rule sent a six-minute task done 3,000 times a year to Consolidate & re-sequence, and did the same with a process that came back half the time. The example in `examples/process-deep-dive` shows both.

Added: the first line of `assumptions` names the rule that chose the intervention.

Added: the three thresholds are named constants in `packages/js/src/diagnose.ts`: `REWORK_FLOOR`, `SHORT_WORK_HOURS` and `REPEAT_VOLUME`. They are Craig Horton's judgement. They are not taken from a benchmark. They are not exported from the package root in this version.

Scope: a process that fits neither new rule gets the same intervention and the same figures as before. The savings formula, the effectiveness bands, the confidence and the verdict thresholds are unchanged. The 13-tool catalogue, `assess_ai_initiative`, `aibvf-check` 0.1.1 and the Python package 0.2.2 are unchanged.

## 0.17.0 (aibvf-mcp), 0.13.0 (@aibvf/core), 21 November 2026

Added: an agent can run the assessment alone. `assess_ai_initiative` takes `answered_by: "evidence"` with a quote and a source for each answer. An answer of a to d with no quote and source is counted as not known and listed in `evidence_missing`, so an agent cannot pick an answer it cannot quote. Numeric scores are refused in this mode. An answer that rests on more than one document takes up to three quotes, each with its own source. The verdict carries `provenance`: an agent answered from evidence and no person confirmed the answers.

Added: the engine reads the quoted evidence with the same five published phrase rules it applies to the proposal. A quote that says the opposite of the answer it was given for holds the verdict at Fix and is named in `contradictions` with `found_in: "evidence"`.

Added: the AI BVF agent. One operating brief, exported from `@aibvf/core` as `AGENT_BRIEF`, served by the connector as the MCP prompt `aibvf_agent` and packed as the skill in `skills/aibvf-agent` with `aibvf-agent.zip`. The owner sets the mandate once. The agent then finds the AI initiatives, judges each from evidence, drafts the next step and reviews each verdict on a date. The default mandate is to draft and never send. `scripts/build-agent-skill.mjs` builds the skill from the brief, and CI fails when they differ.

Added: `where_to_look` on every guided question and on `to_find_out`. It says where the answer is usually written down, for a person or an agent, before the answer becomes "I do not know yet".

Added: `brief_url` on the front-door verdict. The tool returns the link to the one-page brief, so an assistant that cannot run code can still hand it over. The context, the answers and any quoted evidence travel after the `#` sign and are stored nowhere. The wording of the proposal stays out unless `brief_includes_proposal` is set. `briefUrl` and `briefUrlFor` are exported from `@aibvf/core`.

Added: `review` on the front door. At a review, pass the earlier verdict and what happened since as one of five fixed outcomes. It comes back beside the new verdict and never changes it. An agent has to quote what happened, or the outcome is not kept.

Added: telemetry records three categories: who answered, a person or an agent from evidence, and at a review the earlier verdict and the outcome. No proposal, quote or source is sent. `measurement-integrity.sql` reports them as `mcp_answered_by` and `mcp_verdict_outcomes`. The migration `20261121130000_mcp_agent_provenance.sql` adds three empty columns and changes no row.

Changed: the server instructions and the tool description name two ways of working. With a person present the assistant asks and never answers for them, as before. Working alone under the owner's mandate, the assistant uses evidence mode.

Added: every tool publishes one complete, working call as `examples` in its input schema. A test calls all 13, so an example cannot go stale. A caller with only the schema to go on, such as an agent or a benchmark, succeeds on its first call.

Scope: a verdict a person answered is unchanged, apart from the added fields `where_to_look` and `brief_url`. The score each answer carries, the thresholds, the stop rules and the 13-tool catalogue are unchanged. The same answers give the same verdict whoever answered. `aibvf-check` 0.1.1 and the Python package 0.2.2 are unchanged.

## 0.16.3 (aibvf-mcp), 0.12.3 (@aibvf/core), 21 November 2026

Changed: the top answer on cost and return no longer names a payback period. It read "within a year, on measured figures". It now reads "The return covers the cost, on results measured in a pilot or in live use." All four answers on this question now judge the evidence alone: a loss, untested figures, figures finance has checked, measured results.

Changed: agentic AI gets a risk question about the agent itself. It asks what the agent can do without a person approving it, and the four answers run from "It can spend money, change records or contact customers, with no limit and no approval" to limits that are tested, with every action logged and reversible. An outside review found that an agent issuing refunds and one drafting replies were asked the same question. The worst answer stops the initiative on its own, as before. Other AI types keep the standard wording.

Added: `wordingFor`, `whyFor` and `firstStepFor` in `@aibvf/core` return the wording for an organisation and AI type. Pages that show a question should use these in place of the `WORDING` tables.

Added: the MCP server declares the display title "AI BVF". Gemini listed it under its registry name.

Added: telemetry records which piece of context the engine had to ask for because it could not read it from the proposal: industry, business function, AI type or headcount. Only the field name is recorded, never the wording. `measurement-integrity.sql` reports it as `mcp_context_not_read`, with the number of assessments in the same cohort for the rate. The migration `20261121103500_mcp_context_question_key.sql` widens the stored values and changes no row.

Scope: wording and one telemetry field. The score each answer carries, the thresholds, the stop rules and the 13-tool catalogue are unchanged.

## 0.16.2 (aibvf-mcp), 0.12.2 (@aibvf/core), 21 November 2026

Changed: on cost and return, the evidence decides and the length of the payback does not. The third answer read "The return covers the cost within two years, on figures finance has checked", so a three-year payback on measured figures had no answer that fitted and fell to the second, which scores it as an untested estimate. The third answer now reads "The return covers the cost, on figures finance has checked."

Changed: the second answer leads with the evidence: "The return rests on figures nobody has tested, or it only breaks even." The smaller-firm wording changes the same way.

Scope: wording of two answers on one question. The score each answer carries, the thresholds and the 13-tool catalogue are unchanged. A case that chose the third answer before still scores 65. A case with a payback longer than two years on checked figures now clears the bar on this question, where before it was held at Fix.

## 0.16.1 (aibvf-mcp), 0.12.1 (@aibvf/core), 21 November 2026

Fixed: "customer queries", "customer enquiries", "customer questions", "client queries" and "first line support" now read as customer service. A proposal to handle first-line customer queries left the business function unread, so the user was asked an extra question before the five. Found in a live test through Perplexity.

Scope: wording only. Where a proposal names two functions, the engine still asks which one applies. Scoring rules and the 13-tool catalogue are unchanged.

## 0.16.0 (aibvf-mcp), 0.12.0 (@aibvf/core), 21 November 2026

Changed: the guided verdict reads the proposal against the answers. An independent review showed that a proposal describing AI approving loans with no human review earned a go-ahead when the best answer was picked on every question. Fixed phrases in the proposal that contradict a favourable answer now hold the verdict at Fix.

Added: `contradictions` on the front-door verdict. Each entry quotes the words from the proposal beside the answer they contradict, and `holding_back` carries the same words in `proposal_words`. The first step asks the user to settle which one is true. A contradiction never changes a score.

Added: `readProposal` and `PROPOSAL_RULES` in `@aibvf/core`. Five published phrase rules, one per question: no human check, return not worked out, no named result, no owner or time, work left unchanged. No model reads the text. A phrase negated in the same clause is skipped, and each rule that fires is named in the audit record.

Changed: every MCP tool checks its arguments against its published schema before any calculation. A score of 900, revenue written as text, an unknown industry or a missing required field is declined with the field named. Before this release a score of 900 returned a decision confidence above 100, and `diagnose_process` returned a verdict from one field of eleven. `assemble_portfolio` keeps its own handling, which reports each unusable entry as an issue.

Scope: thresholds, answer scores, the planning range and the 13-tool catalogue are unchanged. A verdict that was Fix or Stop is unchanged. An Accelerate stays an Accelerate unless the proposal contradicts an answer it rests on. `aibvf-check` 0.1.1 and the Python package 0.2.2 are unchanged.

## 0.15.4 (aibvf-mcp), 0.11.2 (@aibvf/core), 21 November 2026

Changed: telemetry records a declined input as `refused`. `infer_readiness` with fewer than two signals and `sequence_portfolio` without an organisation or initiatives decline by design, and each one was counted as an `error`. In the first five days of 0.15.3 the hosted endpoint logged 65 errors in 267 public calls, 41 of them these two refusals from automated callers sending only the required fields.

Changed: `error` now means a fault in the server. `measurement-integrity.sql` reports `refused_calls` beside `error_calls`. The migration `20261121_mcp_refused_outcome.sql` widens the stored outcome values and changes no existing row.

Added: `publish-pypi.yml` builds the Python package, checks the wheel and publishes it through PyPI trusted publishing. PyPI has served 0.2.0 since May while this repository moved to 0.2.2; the workflow closes that gap once the trusted publisher is registered.

Scope: tool behaviour, tool messages, scoring rules, core 0.11.2 and the 13-tool catalogue are unchanged. `aibvf-check` 0.1.1 and the Python package 0.2.2 are unchanged.

## 0.15.3 (aibvf-mcp), 0.11.2 (@aibvf/core), 16 November 2026

Added: an opaque assessment ID links calls in a guided assessment without sending the proposal to telemetry. Copy the returned `assessment_id` on continuation calls and omit it for a different idea.

Added: internal and automated traffic exclusions, private retrospective installation labels, server receipt times and a report that keeps unverified public and unknown activity separate. Return measures use meaningful actions and wait until each installation has had 24 hours or seven days to return.

Added: hosted clients can opt into return measurement with a random UUID in `x-aibvf-client-id`; only its hash is retained. Hosted calls without it remain unidentifiable across visits, and no browser or installation count is described as people or organisations.

Changed: the former browser-ID-only reports are retired in favour of `measurement-integrity.sql`, with rollback-only regression checks for separate assessments, last questions, return timing, duplicate delivery and private access.

Scope: scoring rules, core 0.11.2 and the 13-tool catalogue are unchanged.

## 0.15.2 (aibvf-mcp), 0.11.2 (@aibvf/core), 10 November 2026

Added: the front-door verdict says its result in everyday words. `summary` gives the outcome in plain words, `holding_back` lists each answer that keeps the initiative from a go-ahead with what the user said and what it needs to become, and `first_step` names the one thing to do first. A Stop quotes the answer that caused it. A gap in the work redesign names the first part still to change.

Changed: `reason` keeps the rule in framework terms for audit and advisory use. `summary` is the sentence to show a user.

Changed: each question's `why` states the rule the engine applies, in the wording for the organisation's size. `QUESTION_WHY` is now keyed by track.

Added: `CONTEXT_CHOICES`, the ordered choices for industry, business function and AI type, so a page that lets the user correct the reading uses the engine's wording. `QUESTION_SHORT`, `FIRST_STEP` and `WORK_PART_WORDING` are exported for the same reason.

Added: "property company" resolves to real estate in a full proposal.

Added: the telemetry migration `20261110_guided_journey_events.sql`. It adds event names for each step of the guided Start journey, a `step` number, and an `activity_cohort` label that marks automated browser checks. The answer chosen is never stored. `guided-funnel.sql` reports where browsers stop.

Scope: additive. No existing field is removed or renamed, and the scoring rules are unchanged. `aibvf-check` 0.1.1 and the Python package 0.2.2 are unchanged.

## 0.15.1 (aibvf-mcp), 0.11.1 (@aibvf/core), 10 November 2026

Security: plain-language matching compared every phrase hit with every other hit, so an input repeating a recognised phrase tens of thousands of times ran in quadratic time and could hold the server's event loop for seconds. Contained phrases are now removed in one ordered sweep. `'sales '.repeat(40000)` falls from about eight seconds to under 100 ms.

Fixed: `extractRevenueEur` read a cost as company revenue when other words sat between the amount and an organisation noun, as in "a EUR 250k chatbot across the company". The words in between must now describe an organisation, such as "IT services" or "global retail". Anything else leaves revenue unread.

Scope: both defects shipped in 0.15.0 and 0.11.0 and were reported by automated review after that change was merged. The front door does not use revenue, so its verdicts were unaffected by the second.

## 0.15.0 (aibvf-mcp), 0.11.0 (@aibvf/core), 10 November 2026

This release changes the front door, `assess_ai_initiative`. It reads a proposal without guessing, fills in no score, returns no euro figure, and asks a regular user plain questions.

Changed: `assess_ai_initiative` is a guided conversation. It reads industry, business function, AI type and headcount, returns `needs_confirmation` with the reading for the user to confirm or correct, then asks at most five plain questions, one at a time, in `question`.

Added: every guided question carries four everyday answers and "I do not know yet". Each answer maps to a fixed, published score in `CHOICE_SCORES`; the answer, its wording and its score are returned in `answers_given` and recorded in the audit rules. An unknown answer fills nothing in and is listed in `to_find_out`.

Added: two wordings by size. Organisations under 250 people get questions phrased for an owner, larger ones for an executive. The scores, thresholds and work redesign gate are identical for both.

Changed: a verdict rests only on what the user answered or supplied. Accelerate and Fix need all four pillars, and Stop fires as soon as one answer forces it. Until then the status is `not_enough_to_judge`. The work redesign question is asked last, and only when the four pillars clear the Accelerate thresholds.

Changed: no euro figure at the front door. A value has to be worked out from the organisation's own volumes, hours and costs.

Changed: agentic AI in a regulated industry or function no longer returns Stop on an estimated governance score. The governance question is asked first, with a `warning` that it cannot proceed until its controls are shown.

Changed: the front door asks for headcount and no longer asks for annual revenue or the agile, traditional or siloed label. Both inputs are accepted and ignored. Missing context is asked for one item at a time, with choices.

Fixed: plain-language matching reads whole words only. "A company" no longer resolves to cross-industry, "laptops" no longer resolves to supply chain, and a mention of revenue no longer resolves the function to sales.

Fixed: the longest phrase wins, so a retail bank resolves to financial services. Wording that points to two values resolves to neither and returns both as `candidates` for the user to choose between.

Changed: ordinary words such as "people", "support", "technology" and "slow" resolve only as a short direct answer, never inside a longer proposal. An unresolved field becomes a question.

Added: everyday names for smaller organisations and their work, including accountancy firm, MSP, care home, building society, bookkeeping, invoicing and sales team.

Added: `understood`, a plain statement of how the proposal was read, with `inferred_fields` and `ambiguous_fields`.

Security: the pattern that strips revenue amounts before reading the business function ran in polynomial time on long runs of spaces. It now runs in linear time.

Added: `plainLanguage.test.ts`, a set of 46 proposals written the way regular users write them. Each must be read correctly or left open as a question.

Breaking for `assess_ai_initiative` callers:

- Statuses are `needs_input`, `needs_confirmation`, `not_enough_to_judge` and `verdict`. A plain proposal no longer returns a verdict in one call.
- `verdict` no longer carries `net_value_eur`, `gross_value_eur`, `multipliers`, `drivers`, `scores_used`, `pillar_basis`, `sensitivity`, `benchmark_source` or `caveat`. It carries `scores_supplied`, `answers_given`, `verdict_flips`, `value_note`, the work architecture gate and the audit record.
- `resolved_inputs` and `missing_fields` carry `employees` and `track` in place of `revenue_eur` and `readiness`.
- `next_question` names one item, where it used to name every missing input.

Scope: `score_initiative`, the portfolio tools, the scoring formulas and the thresholds are unchanged, and keep the planning range for advisory work. `aibvf-check` 0.1.1 and the Python package 0.2.2 are unchanged.

## 0.14.15 (aibvf-mcp), 0.10.6 (@aibvf/core), 5 November 2026

Changed: the Registry manifest now advertises the hosted Streamable HTTP endpoint alongside the npm package, so compatible clients can discover the no-install route.

Changed: MCP server instructions make `assess_ai_initiative` the first tool for one plain-English proposal. The thirteen-tool surface and scoring rules are unchanged.

Added: public-journey measurement can record a privacy-limited page-view denominator, connector setup, referring host and campaign labels without proposal text, organisation names or full URLs.

Security: the MCP TypeScript SDK and its runtime dependency overrides move to patched releases. The published runtime has no known npm audit finding at release preparation.

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
