# Process deep dive

A first working version of the deep dive: an agent goes through one department's system log, lists every process it finds, and reports what to do with each one and what it saves.

It is an example. The example itself changes nothing published. Running it led to the rule change in `@aibvf/core` 0.14.0.

## What it does

1. **Counts the log.** `measure()` reads a ticket log, one row for each step of each case, and counts seven signals for each process: volume, work time, time from open to close, share of that time spent working, people who touch a case, cases that come back, and steps a system does. Code counts. No model is involved.
2. **Asks the engine.** `diagnoseProcess()` in `@aibvf/core` picks the intervention and sizes the saving, by its fixed rules.
3. **Writes the report.** Every figure in it comes from the count or from the engine.

The hourly cost of the team is not in a log. The report asks for it once. Without it the report gives each recommendation with no euro figure.

Under each saving the report prints what the figure rests on, in the engine's words: the yearly cost and the cases behind it, the share of that cost the change reaches, the saving band and its draft status, and the share of the saving the organisation keeps. Yearly cost, times reach, times saving band, times share kept gives the euro range.

A process with fewer than 30 cases in the log is counted and not judged. The supplier claim has 12, so the report gives its counts and no recommendation.

## Run it

```bash
npm run build
node examples/process-deep-dive/make-log.mjs
node examples/process-deep-dive/deep-dive.mjs
node examples/process-deep-dive/deep-dive.mjs --rate 38 --write
```

- `halden-service-desk/tickets.csv`: cases opened over 30 days at the service desk of Halden & Co, a made-up retailer. The last one closes on day 36. The same seed gives the same file.
- `report-before-rate.md`: the report before the owner has given the hourly cost.
- `report.md`: the report at 38 euros an hour.
- `signals.json`: what was counted.

## What is not settled

- **GenAI comes second.** Craig's rule of 21 November: the first report never recommends GenAI. A process is redesigned and judged again first.
- **The three thresholds are judgement.** Before `@aibvf/core` 0.14.0 the engine sent "Order status query" and "Address change" to Consolidate and re-sequence, because waiting outweighs every other signal in a ticket log. Two rules now decide first: work that comes back, and short repeated work. Their thresholds are Craig's, not a benchmark's.
- **The two floors are judgement.** 30 cases of a process and 28 days of log, set on 24 November 2026. A rare process needs a longer export before it is judged.
- **A close call is said, and still decided.** In the delivery complaint, waiting is 33.4 percent of the drag and manual work is 33.2 percent. Until `@aibvf/core` 0.19.0 the engine compared the rounded shares, both 0.33, and the order of the list chose Automate. It now compares the shares as counted, chooses Consolidate and re-sequence, and says that a small change in the counts would choose the other move.
- **The saving bands are a draft.** They come from published vendor and analyst figures, cut back. They were not measured on anyone's cases. The report says so under each saving.
- **The log is made up.** No real system has been read. A real log needs its columns mapped first.
- **Nothing is built.** Craig's rule of 21 November: the first version drafts the change for a person to carry out. The report asks "Would you like me to draft it?" and stops there.
