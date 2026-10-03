# AI BVF adoption delivery plan

Owner: Craig Horton. Delivery coordination: Codex.
Planning period: 3 to 30 October 2026.
Status: implementation started; customer outcomes remain unverified.

## Outcome

Help an AI transformation consultant turn a real proposal into a reviewable decision brief: evidence, gaps, the next action and its owner. Prove that teams return with another proposal or new evidence before expanding the tool catalogue.

## Baseline, 3 October 2026

The npm snapshot reports 1,025 MCP downloads and 1,890 downloads across the three npm packages over the last month. These include dependencies, repeat retrievals and automation.
GitHub records zero stars and forks. These are distribution signals.

The telemetry snapshot ending 08:20 UTC records 24 browser starters, 23 subsequent verdicts, one browser-local save and zero subsequent re-scores. Nineteen of twenty portfolio handoffs followed the verdict within a second.
Sixty-six local MCP IDs appeared, but only two made tool calls; those calls occurred in short bursts.
These observations do not establish a customer conversion or retention rate.

## Delivery and acceptance

| Window | Owner | Deliverable | Acceptance |
|---|---|---|---|
| 3 to 6 October | Codex, Craig reviews | Repair revenue extraction, portfolio work-design evidence and input provenance | Regression cases cover project cost before revenue, conflicting amounts, ready portfolio, incomplete portfolio and assembled estimates |
| 3 to 6 October | Codex | Align descriptions, worked examples and public onboarding | Correct tool names; decision score and planning benefit explained; no compliance validation implied by context labels |
| 3 to 6 October | Codex | Publish core and MCP patches and matching website | Exact release commits pass tests; npm and registry publication verified; production browser uses installed core |
| 3 to 9 October | Codex | Publish an honest adoption report | Connections and tool use separated; local and workspace saves distinct; timing diagnostics visible; unclassified traffic remains unclassified |
| 3 to 9 October | Codex drafts, Craig selects recipients | Pilot invitation, observation guide, participant tracker and decision brief template | Ready-to-use materials with no invented testimonials or customer claims |
| 5 to 16 October | Craig | Invite ten qualified external teams with a current AI funding or redesign decision | Each participating team has an owner, a concrete proposal and a scheduled review |
| 10 to 23 October | Craig with pilot users | Observe first use and a return decision | Eight teams complete a useful first review; five return to the same proposal with new evidence |
| 17 to 30 October | Craig approves publication | Two case studies and one external integration | Participants approve case wording; integration is run by an external team; disagreements and model changes recorded |
| After release checks pass | Codex prepares, Craig handles external submission | Updated directory submission and discovery metadata | Current published version, working hosted route, exact claims and required directory checklist |

The pilot numbers are experimental targets. Recruitment, use, interviews and publication are future work until evidence is recorded.

## Release gate

- The same known initiative retains work-design evidence and input origin across assembly and portfolio scoring.
- A project budget cannot silently become annual company revenue.
- An ambiguous revenue statement asks for clarification.
- The browser embedded engine and fallback asset are generated from the installed core package.
- First-use copy, package descriptions, registry metadata and worked examples agree with the implementation.
- Existing core, MCP and CLI tests pass; website build, lint, static checks and browser checks pass.
- Production deployment and published package versions are checked after release.

## Pilot measure definitions

A qualified team is an external organisation or consulting team with a named participant and a real decision due during the pilot. Recruitment records are private.
A useful first review requires the participant to reach a verdict, explain its assumptions and record a relevant next action with an owner and review date. Record whether facilitation was needed.
A returning team reopens the same decision, updates evidence and completes a re-score within fourteen days of its first review. Report second proposals separately.

Record the outcome against a private pilot code. Do not infer organisations from anonymous browser or installation IDs.
Report invitations, acceptances, useful reviews and returns separately. Keep exact dates and denominators.
Package downloads, stars, raw events and unidentified traffic remain supporting measures.

## Measurement follow-up

Add an explicit internal/test traffic context before using anonymous telemetry for acquisition decisions. Preserve an unknown category; absence of a test label does not prove an external user.
Verify workspace import-confirmed events against successful database writes and separately test local storage save/reopen behaviour.
Document scheduled review dates separately from delivered reminders; the current local due-date event does not prove a reminder was delivered.

Until that instrumentation is deployed and verified, use the private pilot tracker as the source for qualified-team adoption. Report telemetry as observed events and identifiers only.

## Weekly decisions

On 9 October, review the repaired first-use journey and recruitment readiness.
On 16 October, review observed sessions and revise the task or instructions where participants stall.
On 23 October, review repeat use and reasons for non-return.
On 30 October, decide whether to expand distribution, narrow the workflow, or pause further feature work.

Expand only when participants independently obtain useful results and return. If fewer than five of ten teams return, investigate the recorded reasons before adding tools or paying for traffic.

## The path to one million downloads

Use `aibvf-mcp` as the primary package-download measure. Report core, CLI and Python retrievals separately so dependencies do not inflate the headline. Downloads remain distribution activity; qualified teams and repeat decisions measure adoption.

The earlier 20,000 starting point needs a verified cumulative total and time window. If that baseline is confirmed for the chosen package, the remaining 980,000 retrievals require an average of about 81,667 per month over twelve months, or 40,833 over twenty-four months. The current MCP rate is 1,025 per month, so those scenarios require roughly 80 or 40 times today's rate.

These figures are arithmetic scenarios, not forecasts. The route to test is:

1. Complete the ten-team cohort, with eight useful first reviews, five fourteen-day returns and two approved cases.
2. Test three integrations operated by external teams, such as a consulting proposal workflow, an internal AI portfolio review and a deployment approval workflow. Each needs an owner, observed repeat use and a supported installation path.
3. Expand to one hundred qualified teams only after the first cohort meets its criteria. Use fifty returning teams within thirty days as the next proposed retention gate; record invitations, assisted use and reminders.
4. Expand channels that produce useful repeat decisions. Estimate download contribution from each channel's observed retrieval history, and revise the twelve- or twenty-four-month scenario monthly.

A million retrievals driven by repeated automation would not satisfy the adoption goal. Do not buy stars, generate artificial downloads or report a test installation as an external team.

## Working materials

- [Pilot guide and tracker](adoption-pilot.md)
- [Measurement definitions](adoption-metrics.md)
- [Directory submission draft](../launch/directory-submission.md)

Invitations and external submissions are drafts until sent by Craig or explicitly authorised with recipients. No outreach has been sent as part of this delivery.

## Registry ownership follow-up

The registry rejected adding the hosted URL to `io.github.Craig-Horton/aibvf-mcp` because it is already registered to `io.github.Bahamas1717/aibvf-mcp`. Publish the current npm listing and keep the documented hosted endpoint available while the old listing ownership is migrated. The hosted URL must not be advertised as attached to the new registry identity until that migration is verified.
