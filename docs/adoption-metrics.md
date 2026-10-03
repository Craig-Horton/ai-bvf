# Adoption metrics

The package snapshot and telemetry report answer different questions. Package counts describe downloads from registries. Telemetry describes observed browser storage IDs, local installation seeds and recorded tool calls.

## Run the reports

Run `npm run adoption` for npm, PyPI and GitHub observations. The output includes the collection time and npm's inclusive date windows. A missing count or mismatched npm window suppresses the raw sum.

Run [adoption-retention.sql](../supabase/queries/adoption-retention.sql) with read access to the telemetry tables. The query returns one row containing the ordered browser cohort, local activity counts, route totals, event details and traffic diagnostics. It reads aggregates and changes no records.

The SQL window is `[starts_at, ends_at)`, with a 30-day default. Replace `now()` in the `report_end` CTE with a fixed timestamp to reproduce a snapshot. Latest event timestamps show recorded activity freshness; they are client supplied and cannot establish ingestion health.

## Interpret the counts

| Metric | Meaning |
| --- | --- |
| npm raw download sum | Package retrievals across three packages, including dependencies, repeated installation and automation. |
| Browser ID | A hash of a seed stored in browser localStorage. Several assessments can share it, and clearing storage creates another ID. |
| Assessment starter | A browser ID that submitted nonempty text with the Assess button during the window. Page visits and typing are outside this denominator. |
| Verdict recipient | A starting browser ID with a later or simultaneous verdict event. |
| Local decision saver | A verdict recipient with a later or simultaneous successful save to browser localStorage. |
| Later rescorer | A local saver with an assessment_rescored event strictly after the save. The browser emitter also requires the evidence-review state. |
| Portfolio handoff | A verdict recipient with a later or simultaneous request to navigate to the portfolio. |
| Later portfolio import | A handoff browser ID with a later or simultaneous portfolio_import_confirmed event. This requires the emitter to complete successfully. |
| Local connection-only ID | A local MCP install hash with connection events and no recorded tool call in the window. |
| Local tool-using ID | A local MCP install hash with at least one recorded call other than server_connect. |
| Repeat local tool use | A local install hash with tool calls on at least two distinct UTC dates. Repeat connection events do not satisfy this measure. |
| Remote tool calls | Recorded hosted MCP calls. Remote caller hashes originate in the server runtime and cannot count customers. |

Ordered browser steps use the same browser ID. They cannot establish that each event belongs to the same assessment, or link browsers to authenticated organizations. Recent starters have less time to return, so these are observed window rates rather than fixed-day retention cohorts.

The event detail retains the raw event names and provides their meanings. `improvement_plan_opened` currently records automatic rendering for a non-Accelerate result. `rescore_due` records the future date when a local decision is saved; it does not establish that a reminder was delivered.

The route detail includes older clients with unknown routes and rows without an installation hash. Local installation counts cover telemetry-enabled stdio clients with a hash. Opt-outs, blocked requests, silent transmission failures and direct use of the core library limit coverage.

A local seed normally persists on disk. When persistence fails, the MCP server falls back to a random seed for that process, so ephemeral processes can create several observed installation IDs. None of these IDs establishes a unique person or paying customer.

## Read the diagnostics

The report shows handoffs less than one second after the latest preceding verdict, the median handoff delay, and local IDs with at least 20 tool calls spanning no more than two minutes. These are timing diagnostics with explicit thresholds. Every observed row remains in the report.

Fast agents, development checks and external users can overlap in these patterns. Treat the diagnostics as reasons to inspect traffic provenance. They cannot certify which records represent customers.

Browser UTC event-day counts and repeat-day counts reveal whether activity is concentrated. A period comparison can reflect testing, instrumentation changes or release checks. Establish comparable coverage before describing a change as user growth or decline.

## Follow-up measurement work

The current schema has no explicit production-external, internal, automated-test or unknown activity cohort. Add a disclosed, validated cohort field to both emitters and the database in a separate change, with unknown as the default and authenticated checks for any claim of external customer activity. Historical unlabelled events must remain unlabelled unless their origin can be established.

Keep browser and MCP test traffic in isolated sinks or intercept telemetry in tests. Verify the anonymous portfolio handoff, successful authenticated import and later return as separate events. Add a source for successful production writes before equating an import-confirmed event with a durable workspace record.

Track repeat decisions at an organization or assessment level only with a documented privacy design. The useful outcome is an external team making a decision, saving or sharing the evidence, and returning with changed evidence. Downloads, GitHub stars and tool-call volume remain supporting indicators.
