# The Workflow Coroner

A Stop-first BVF agent. Reads a Celonis-shaped event log, scores the workflow against the AI BVF, and closes the loop with mocked MuleSoft Anypoint decommission calls when the ruling is Stop.

The metric on the box is "percent of work eliminated, not automated."

## Why it exists

Most process mining births new automations. This one performs autopsies first. Default verdict on an inbound candidate is Stop, AI initiatives only get scored on workflows that survive the elimination test. Leading with Stop is the contrarian play, the only thing that makes the math honest when McKinsey reports 70 percent of digital transformations fail and BCG reports 70 percent of AI initiatives never reach scale.

## The architecture, one orchestrator and five agents

- **Pulse** parses the event log, classifies the workflow by pace layer (Jeroen Tas), infers ai tier and readiness from rework, exception, and automation-coverage signals.
- **Verdict** derives BVF pillar scores from those signals, calls `aibvf.score.score` and `aibvf.score.calculate_pace_layer_drag` against the canonical engine, returns a Stop / Fix / Accelerate / Keep ruling with a BVF health score.
- **Architect** branches on the ruling. On Stop it drafts an elimination plan and a Prosci-grade CM treatment. On Fix it calls `recommend_improvements` for pillar raises. On Accelerate it designs an agentic deployment in shadow mode.
- **Wire** mocks MuleSoft Anypoint, generates DELETE / PATCH / POST calls per ruling, computes annual saving from labour minutes recovered and integration maintenance avoided, writes a JSON decommission log and a markdown CM plan, holds a 30-day rollback transaction in escrow.

## How to run

This is the developer on-ramp. The senior-leader on-ramp is the AI BVF scorer at https://www.aibvf.com/protocol/scorer plus the agentic workmate layer landing on https://thetransformationbrief.ai/workflow-coroner.html next week. If you are not running Python, start there.

### Install, one time

```bash
git clone https://github.com/Craig-Horton/ai-bvf
cd ai-bvf/examples/workflow-coroner
```

Python 3.10 or later, stdlib only. No API key required for the deterministic path.

### Run

```bash
python coroner.py                                # default Stop fixture (procurement)
python coroner.py fixtures/customer-triage.json  # Accelerate fixture
python coroner.py path/to/your/celonis-export.json
```

The fixture schema is documented in `fixtures/procurement.json`. If you do not have a Celonis export, hand-build a JSON to that shape from a process map in 10 minutes.

### Expected output

The default Stop fixture prints a verdict envelope, then writes artefacts to `output/`.

```
▸ pulse     · workflow classified, pace layer 3, gen2 ambition
▸ verdict   · deterministic
            · ruling: Stop, BVF health 32 of 100, financial return 12 of 100
▸ architect · elimination plan drafted, 11 of 14 steps removed
▸ wire      · 11 DELETE calls, 3 PATCH calls, 30-day rollback in escrow
            · annual saving 2.76M EUR (labour 2.46M, integrations 300k)
▸ artefacts · output/decommission_log.json, output/cm_plan.md
```

The Accelerate fixture prints the same shape with a different ruling and a 30-day shadow-validation note.

## Verdict, deterministic vs agent mode

Verdict ships in two interchangeable forms with the same `adjudicate(candidate) -> envelope` contract.

- `verdict.py`, deterministic, default. Pure Python heuristics over the candidate signals, no external calls. Good for reproducible CI runs and offline demos.
- `verdict_agent.py`, real Claude sub-agent. Uses `claude-sonnet-4-5` with forced tool use. Same scoring rubric, plus a senior-practitioner rationale attached to every ruling.

Coroner auto-selects:

| Condition                                              | Mode active        |
|--------------------------------------------------------|--------------------|
| `VERDICT_MODE=deterministic` set                       | deterministic      |
| `VERDICT_MODE=agent` or `ANTHROPIC_API_KEY` set        | agent (if importable) |
| Neither set                                            | deterministic      |

To enable agent mode:

```bash
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...
python coroner.py
```

The verdict section header changes to `▸ verdict  ·  agent  ·  claude-sonnet-4-5-...` and a rationale block appears under the ruling.

## What the demo proves

Two fixtures, same engine, opposite verdicts.

**Stop**, against `fixtures/procurement.json` (a 14-step procurement-approval flow at a synthetic 2.4B EUR business, 23 percent rework, 11 integrations, siloed readiness against gen2 ambition):

- ruling: Stop, financial return scored 12 of 100
- net annual saving: 2.76M EUR (labour 2.46M, integrations 300k)
- new AI initiatives required: zero

**Accelerate**, against `fixtures/customer-triage.json` (a 10-step ticket-triage flow at a synthetic 800M EUR software business, 2 percent rework, 4 integrations, agile readiness with gen3 ambition):

- ruling: Accelerate, all four pillars cleared
- net opportunity: 36.7M to 108M EUR per year, gated by 30-day shadow validation
- ai pattern: gen3 on the cx function

The whole point of the system is that sometimes the answer is "do not build AI," and the metric most consultancies cannot publish is the one this engine leads with.

## Files

- `fixtures/procurement.json` — Celonis-shaped log summary, Stop case
- `fixtures/customer-triage.json` — Celonis-shaped log summary, Accelerate case
- `pulse.py` — discovery agent
- `verdict.py` — BVF adjudicator, deterministic Python
- `verdict_agent.py` — BVF adjudicator, real Claude sub-agent with rationale
- `architect.py` — target-state designer
- `wire.py` — MuleSoft Anypoint mock executor
- `coroner.py` — orchestrator with brand-coloured CLI, auto-selects verdict mode
- `_aibvf_loader.py` — temporary bypass for the broken installed pip package, loads `score.py` from repo source

## Notes

- Voice rules apply to terminal output, code comments, and CM plan markdown. No em-dashes, sentence case, no all-caps emphasis, no "X is not A, it is B" pattern.
- The MuleSoft layer is a mock. Wiring up a real Anypoint connection is a configuration change, not a code change.
- Sector-agnostic by default. Healthcare, financial, public-sector specialisations are one BVF parameter away.
