# Process deep dive

A first working version of the deep dive: an agent goes through one department's system log, lists every process it finds, and reports what to do with each one and what it saves.

It is an example. Nothing here changes `@aibvf/core`, the MCP tools or anything published.

## What it does

1. **Counts the log.** `measure()` reads a ticket log, one row for each step of each case, and counts seven signals for each process: volume, work time, time from open to close, share of that time spent working, people who touch a case, cases that come back, and steps a system does. Code counts. No model is involved.
2. **Asks the engine.** `diagnoseProcess()` in `@aibvf/core` picks the intervention and sizes the saving, by its fixed rules.
3. **Writes the report.** Every figure in it comes from the count or from the engine.

The hourly cost of the team is not in a log. The report asks for it once. Without it the report gives each recommendation with no euro figure.

## Run it

```bash
npm run build
node examples/process-deep-dive/make-log.mjs
node examples/process-deep-dive/deep-dive.mjs
node examples/process-deep-dive/deep-dive.mjs --rate 38 --write
```

- `halden-service-desk/tickets.csv`: 30 days at the service desk of Halden & Co, a made-up retailer. The same seed gives the same file.
- `report-before-rate.md`: the report before the owner has given the hourly cost.
- `report.md`: the report at 38 euros an hour.
- `signals.json`: what was counted.

## What is not settled

- **The GenAI call is a proposal.** The engine has no rule for it. This example says "with GenAI" when the engine says Automate and half or more of the handling time is reading or writing free text.
- **Two calls a practitioner would question.** The engine sends "Order status query" and "Address change" to Consolidate and re-sequence, because waiting outweighs every other signal in a ticket log. The first is six minutes of identical work and the second comes back half the time.
- **The log is made up.** No real system has been read. A real log needs its columns mapped first.
- **Nothing is built.** The report asks "Would you like me to build it?" and stops there.
