# AI BVF agent

A skill that turns a personal assistant into an AI BVF agent.

It finds the AI initiatives in what you let it read. It decides Accelerate, Fix or Stop on each one from evidence it quotes. It drafts the next step and comes back at each review date. You set the mandate once.

## What keeps it honest

- **Evidence or unknown.** The agent may answer a question only with words it can quote and the place it found them. The engine enforces this: an answer with no quote is counted as not known.
- **Fixed rules judge.** The verdict comes from `assess_ai_initiative`, a deterministic tool. The same answers give the same verdict every time.
- **Every verdict says who answered.** A verdict reached this way states that an agent answered from evidence and that no person confirmed it. The brief shows each quote beside its answer.
- **It drafts and never sends.** No message leaves, no money is spent and no system changes unless you change the mandate.
- **You overrule it.** Correct an answer and the agent uses yours, with you as the source.
- **Say "pause AI BVF" and it stops.**

## What it needs

- An assistant that loads skills and connects to MCP servers: Claude, Claude Code or OpenClaw.
- The AI BVF connector at `https://mcp.aibvf.com/api/mcp`. No account and no sign-in.
- Something to read: the documents, mail or notes you have already given your assistant.

Any other assistant that can add the connector can run the same agent without this skill. Connect the address, then give the assistant the operating brief from https://www.aibvf.com/agent. The brief is the text of this skill. Clients that list MCP prompts offer it as `aibvf_agent`.

## Install

### Claude, on the web and desktop

1. Open Settings, then Connectors. Choose Add custom connector. Name it AI BVF and paste `https://mcp.aibvf.com/api/mcp`.
2. Download [`aibvf-agent.zip`](https://github.com/Craig-Horton/ai-bvf/raw/main/aibvf-agent.zip).
3. Open Customize, then Skills. Choose "+", then "+ Create skill", then "Upload a skill", and pick the zip. Code execution has to be switched on for skills to load.
4. Say: "Run the AI BVF agent."

To run it every week, describe the task and the schedule in a conversation and choose Schedule. Scheduled tasks need a paid plan.

### Claude Code

```bash
mkdir -p ~/.claude/skills
unzip aibvf-agent.zip -d ~/.claude/skills
claude mcp add --transport http aibvf https://mcp.aibvf.com/api/mcp
```

### OpenClaw

Checked against the OpenClaw 2026.11.6 documentation. It has not yet run in a live OpenClaw.

1. Add the skill. In the Control UI open Plugins, then Skills, and import [`aibvf-agent.zip`](https://github.com/Craig-Horton/ai-bvf/raw/main/aibvf-agent.zip). From a terminal, unzip it and run `openclaw skills install ./aibvf-agent`.
2. Add the connector. In the Control UI open Settings, then MCP, then Add server. Choose Streamable HTTP, name it `aibvf` and paste `https://mcp.aibvf.com/api/mcp`.
3. Message your agent: "Run the AI BVF agent." It states its mandate and asks once.
4. Then: "Do this every Monday at 07:00." It schedules itself and reports in that chat.

From a terminal, steps 2 and 4 are the lines below. The Gateway has to be stopped while a connector is added.

```bash
openclaw gateway stop
openclaw mcp add aibvf --url https://mcp.aibvf.com/api/mcp --transport streamable-http
openclaw gateway start
openclaw automations create "0 7 * * 1" "Run the aibvf-agent skill. Reply NO_REPLY when nothing changed." --name "AI BVF weekly check" --tz Europe/Amsterdam
```

An OpenClaw agent can reach the whole computer it runs on. This skill tells it to read only its workspace and what you send it or point it to, until you name more. Put the documents in the workspace folder, send them in the chat, or name the folder.

## The first run

The agent states its mandate and asks once whether to change it:

- May read: what you have connected or handed to it. Nothing else.
- May do: draft. Send nothing, spend nothing, change no system.
- Check: every week.
- Report to: you.

After that it works without asking. It reports only when something changed.

## Stopping it

- "Stop watching the invoice project" closes one entry.
- "Pause AI BVF" stops every run until you say "resume AI BVF".
- Delete the schedule, or remove the skill, to end it.

## What leaves your assistant

Each call sends the tool the proposal, the answers and the quotes, so that it can judge them. AI BVF stores none of that. It records anonymous counts: which tool ran, the industry, function and AI type, the verdict, whether a person or an agent answered, and at a review what happened after the earlier verdict. The brief link carries its content after the `#` sign, which browsers do not send to a server.

## For maintainers

`SKILL.md` and `aibvf-agent.zip` are built from the operating brief in `packages/js/src/agentBrief.ts`:

```bash
npm run build
node scripts/build-agent-skill.mjs
```

CI runs the same script with `--check`.

To publish the skill on ClawHub, so that OpenClaw installs it with `openclaw skills install @<owner>/aibvf-agent`:

```bash
npm i -g clawhub
clawhub login
clawhub skill publish ./skills/aibvf-agent --version 1.0.0
```

The login takes a GitHub account that is at least 14 days old. ClawHub scans each version before it lists it.
