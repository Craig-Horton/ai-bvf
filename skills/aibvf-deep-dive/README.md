# AI BVF deep dive

A skill that sends a personal agent through one department's system log.

It lists every process in the log. For each one it reports what it found, what to do, why, how and what it saves. Then it offers to draft the change.

## What keeps it honest

- **Code counts.** `scripts/measure.mjs` counts the log on your own computer. No model counts anything.
- **Fixed rules judge.** `diagnose_process` picks the intervention and sizes the saving. The same counts give the same answer every time, and the answer names the rule that chose.
- **The rows stay with you.** Only the counts for each process go to the tool. AI BVF stores none of them. It records an anonymous count of each call: which tool ran, the business function and the verdict. Someone who runs the `aibvf-mcp` package themselves switches that off with `AIBVF_TELEMETRY_DISABLE=1`.
- **No baseline, no number.** The agent asks once for the team's hourly cost. Without it there is no euro figure.
- **GenAI comes second.** The first report never recommends GenAI. A process is redesigned and judged again first.
- **A draft quotes the flow.** Before it drafts a change, the script counts the orders the steps come in and who does each step. The draft rests on those counts. It names no person.
- **It drafts and builds nothing.** The short draft fits one screen. The full draft follows when you ask. Any target in it is the agent's suggestion, marked as such, for you to confirm or change.

## What it needs

- An agent that loads skills, runs a Node script and connects to MCP servers, such as OpenClaw.
- The AI BVF connector at `https://mcp.aibvf.com/api/mcp`, with `aibvf-mcp` 0.18.0 or later.
- A log export as a CSV file, with one row for each step of each case.

## Try it

The made-up log in [`examples/process-deep-dive`](../../examples/process-deep-dive) has the right shape. Give the agent this:

> Fetch SKILL.md and scripts/measure.mjs from github.com/Craig-Horton/ai-bvf/tree/main/skills/aibvf-deep-dive into a folder named aibvf-deep-dive in your workspace. Fetch examples/process-deep-dive/halden-service-desk/tickets.csv from the same repository. Then follow SKILL.md on that log. The department is the customer service desk of Halden & Co.

## What is not settled

- An OpenClaw agent on Windows ran it on the made-up log on 21 and 22 November 2026. It returned the five expected interventions and one process to leave alone, figure for figure, and drafted the change for address changes. It found the cause in the order of the steps: the address is applied before anyone checks it. No real system export has been read.
- The same agent ran the flow count and wrote the short draft on 22 November 2026, on the made-up log. Every figure in the draft was a count the script printed. It also ran the script directly on Windows, after the fix.
- It reads CSV. A system that only offers an API needs its rows exported first.
- A log shows the work that passes through that system. Work done in mail, meetings and spreadsheets is not in it.
