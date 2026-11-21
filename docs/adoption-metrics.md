# Adoption metrics

Package downloads measure retrievals, not people or businesses. The measurement report keeps internal tests, automated checks, unverified public activity and older unknown traffic separate.

## Run the report

Run `npm run adoption` for npm, PyPI and GitHub observations, then run [measurement-integrity.sql](../supabase/queries/measurement-integrity.sql) through an owner-authorised database connection. The old adoption-retention and guided-funnel queries are retired because they could join different assessments made in the same browser.

The report uses a 30-day window ending at `report_end`. Set both dates in the first CTE to reproduce a snapshot. New rows use server receipt time; historical rows retain the client timestamp and are counted separately as lacking server receipt time.

## Traffic groups

| Group | Meaning |
| --- | --- |
| internal | An explicit test marker or a privately recorded, verified installation/browser match. |
| automated_test | Browser automation, preview/local websites, CI or an explicit automated marker. |
| public_unverified | An unmarked production browser or current MCP client. This is not proof of a person or customer. |
| unknown | Legacy or unclassified events whose origin has not been established. |
| external_confirmed | A private operator label with a recorded basis, never accepted from a public event payload. |

To exclude your browser, open `https://www.aibvf.com/start?aibvf_traffic=internal` once in each browser profile and on each device. The marker persists locally and the reporting view excludes the same browser's earlier events. A shared browser profile is excluded as a whole. Removing site data removes the marker and changes the random browser ID.

For local MCP testing, set `AIBVF_TELEMETRY_COHORT=internal`, or place `internal` in `~/.config/aibvf/telemetry-cohort`. For hosted tests, send `x-aibvf-traffic: internal` or use `?aibvf_traffic=internal`. Automated canaries use `automated_test`; browser test fixtures intercept collection requests by default. `AIBVF_TELEMETRY_DISABLE=1` disables MCP collection entirely.

These markers only exclude traffic and do not grant permissions. The private `bvf_analytics.subject_labels` table can label historical hashes when their origin is established. Never classify a burst as internal merely because it looks automated.

## Where an assessment stops

Each new browser assessment receives a random ID. Saved records keep it, and reopening or changing that assessment reuses it. A different idea receives a different ID even in the same browser. The report groups by browser and assessment, so two ideas cannot create a false completion.

The guided journey records submission, the reading shown and confirmed, the question shown and answered, a verdict or a request to find out more, saving, reopening, changed re-scoring, review navigation and portfolio transfer. The question name and step are recorded, but neither the proposal nor the selected answer is sent. Reopening alone is not a re-score. A browser save event follows a successful local write; a portfolio import event follows the app's save response, not an independent database audit.

The last recorded step and question show where continuation was last observed. After 24 hours without a result, the report labels an assessment inactive; it does not claim the reason for leaving. A find-out result is separate from a verdict. Failures are separate events. Opt-outs, blocked requests and closing a tab before delivery still limit coverage. Browser delivery retries once with the same event ID, so duplicate delivery does not count twice.

The MCP tool returns `assessment_id`; the agent must copy it on continuation calls. Omitting it starts another assessment. Historical calls without it cannot be reconstructed into reliable journeys.

## Whether an installation returns

A meaningful browser action includes answering, changing, saving, reopening or importing a decision. Page loads and MCP connections do not qualify; MCP return use requires a tool call.

The report shows D1+ and D7+ returns: a meaningful action at least 24 hours or seven days after the first recorded action. Each denominator includes only IDs old enough to qualify. These are elapsed-time return measures, not exact-day retention rates. The cohort starts within the reporting window.

Local MCP clients use the existing stable random installation hash. Hosted clients have no return identity by default. A client may opt in with a random UUID in the `x-aibvf-client-id` header; only its one-way hash is retained. Never put an email, name, company, device fingerprint or client ID in the URL. The report explicitly counts calls without a return identity.

Browser and installation IDs are not people or organisations. Clearing storage, reinstalling or using another device can create another ID, and shared installations can represent several people. There is no fingerprinting or cross-device identity matching.

## Feedback answers

Run [feedback-answers.sql](../supabase/queries/feedback-answers.sql) to read the feedback, one row for each answer. It reads the private reporting view, leaves out the `internal` and `automated_test` groups and shows the group of every row it keeps. Rows in the `unknown` group predate the labels and can include test runs.

The Start page asks "Did this change what you will do next?" on a result and "Were these the right things to go and find out?" on the find-out screen. Each result shown gets a random `feedback_key`, which is not derived from the idea or the answers. Rows that share a key are one answer, and the latest row is the answer.

Feedback on a result also carries `held_back`, the first question holding the idea back, from the closed list of five. It is sent when a person chooses to answer the feedback question and on no other event. The selected answer is still never sent.

## Privacy and verification

The private reporting schema and labels are unavailable to public and ordinary signed-in clients. Public collection remains insert-only. Free-text feedback is outside this report. Role and industry are optional broad categories, never inferred identities.

Release checks cover two separate ideas in one browser, reopening versus changed re-scoring, storage failures, deduplicated delivery and traffic exclusion. Database checks run inside a transaction that rolls back. The first full seven-day cohort after release cannot be reported before it has had seven days to return.
