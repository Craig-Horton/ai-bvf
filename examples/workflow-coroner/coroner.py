"""The Workflow Coroner. Stop-first BVF agent orchestrator.

Runs Pulse, Verdict, Architect, Wire against a Celonis-shaped log fixture
and prints a branded verdict card. Closes the loop with mocked MuleSoft
Anypoint decommission calls and a 30-day rollback transaction.

Usage:
    python coroner.py [path/to/log.json]
"""
from __future__ import annotations
import argparse
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

# Windows defaults stdout to cp1252, which cannot encode the box-drawing chars
# used in the verdict card. Force UTF-8 so the demo renders identically across
# bash, PowerShell, and Windows Terminal.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import pulse  # noqa: E402
import architect  # noqa: E402
import wire  # noqa: E402
import sequencer  # noqa: E402
import json  # noqa: E402


def _select_verdict():
    """Pick the agent module if anthropic SDK + API key are available, else fall back."""
    mode = os.environ.get("VERDICT_MODE")
    if mode == "deterministic":
        import verdict  # noqa: E402
        return verdict, "deterministic"
    if mode == "agent" or os.environ.get("ANTHROPIC_API_KEY"):
        try:
            import verdict_agent  # noqa: E402
            return verdict_agent, "agent"
        except ImportError:
            pass
    import verdict  # noqa: E402
    return verdict, "deterministic"


verdict_mod, VERDICT_SOURCE = _select_verdict()


# Brand palette, locked, sourced from memory/about-me/visual-identity.md
NAVY = "\x1b[38;2;26;42;71m"
AMBER = "\x1b[38;2;201;122;43m"
AMBER_SOFT = "\x1b[38;2;226;163;88m"
WHITE = "\x1b[38;2;255;255;255m"
NAVY_BG = "\x1b[48;2;26;42;71m"
RESET = "\x1b[0m"
BOLD = "\x1b[1m"
DIM = "\x1b[2m"

WIDTH = 68
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def _supports_color() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    if not sys.stdout.isatty():
        return os.environ.get("FORCE_COLOR") == "1"
    return True


COLOR = _supports_color()


def c(s: str, *codes: str) -> str:
    if not COLOR:
        return s
    return "".join(codes) + s + RESET


def _vlen(s: str) -> int:
    return len(ANSI_RE.sub("", s))


def _line(content: str, color: str = AMBER) -> str:
    inner = WIDTH - 2
    padded = content + " " * max(0, inner - _vlen(content))
    return f"{c('│', color)}{padded}{c('│', color)}"


def _top(color: str = AMBER) -> str:
    return c("╭" + "─" * (WIDTH - 2) + "╮", color)


def _bot(color: str = AMBER) -> str:
    return c("╰" + "─" * (WIDTH - 2) + "╯", color)


def _rule() -> str:
    return c("  " + "─" * (WIDTH - 4), AMBER, DIM)


def _section(label: str) -> None:
    print(f"\n  {c('▸', AMBER, BOLD)} {c(label, AMBER_SOFT, BOLD)}")


def _field(key: str, value: str) -> None:
    print(f"    {c(key + ':', NAVY, DIM):<28} {value}")


def _eur(n: float) -> str:
    if n >= 1_000_000_000:
        return f"{n / 1_000_000_000:.2f}B EUR"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.2f}M EUR"
    if n >= 1_000:
        return f"{n / 1_000:.0f}k EUR"
    return f"{n:.0f} EUR"


def banner(today: str) -> None:
    title = c("the workflow coroner", AMBER_SOFT, BOLD)
    sub = c(f"craig horton  ·  bvf v1.0  ·  {today}", WHITE, DIM)
    print(_top())
    print(_line(f"  {title}"))
    print(_line(f"  {sub}"))
    print(_bot())


def render_pulse(candidate: dict) -> None:
    _section("pulse")
    _field("source", "Celonis Process Intelligence (mock)")
    _field("workflow", candidate["name"])
    m = candidate["metrics"]
    _field("cases observed", str(m["cases_observed"]))
    _field("median cycle time", f"{m['median_cycle_time_hours']} hours")
    _field("rework rate", f"{m['rework_rate'] * 100:.0f}%")
    _field("exception rate", f"{m['exception_rate'] * 100:.0f}%")
    _field("activities", str(len(candidate["activities"])))
    _field("integrations", str(len(candidate["integrations"])))
    _field("pace layer", c(candidate["pace_layer"], AMBER, BOLD))
    _field("inferred ai tier", candidate["inferred_ai_tier"])
    _field("inferred readiness", candidate["inferred_readiness"])


def render_verdict(v: dict) -> None:
    label = "verdict"
    if v.get("agent"):
        label = f"verdict  ·  agent  ·  {v.get('agent_model', 'claude')}"
    else:
        label = "verdict  ·  deterministic"
    _section(label)
    inputs = v["bvf_inputs"]
    s = inputs["scores"]
    res = v["bvf_result"]
    drag = v["pace_drag"]
    _field("industry", inputs["industry"])
    _field("function", inputs["function"])
    _field("revenue", _eur(inputs["revenue_eur"]))
    _field("ai tier · readiness", f"{inputs['ai_tier']} · {inputs['readiness']}")
    print()
    _field("strategic alignment", f"{s['strategic_alignment']:>3} / 100")
    _field("financial return", f"{s['financial_return']:>3} / 100")
    _field("change enablement", f"{s['change_enablement']:>3} / 100")
    _field("governance risk", f"{s['governance_risk']:>3} / 100")
    print()
    _field("bvf health score", f"{res['confidence']}%")
    _field("pace layer drag", f"{_eur(drag['annual_drag_eur_low'])} to {_eur(drag['annual_drag_eur_high'])} per year")
    _field("net opportunity", f"{_eur(res['net_low_eur'])} to {_eur(res['net_high_eur'])}")
    print()
    ruling_color = AMBER if res["classification"] == "Stop" else AMBER_SOFT
    _field("ruling", c(res["classification"], ruling_color, BOLD))
    print(f"    {c('reason:', NAVY, DIM):<28} {res['reason']}")
    if v.get("rationale"):
        print()
        print(f"    {c('agent rationale:', NAVY, DIM)}")
        for paragraph in v["rationale"].split("\n"):
            wrapped = paragraph.strip()
            if wrapped:
                print(f"    {c(wrapped, WHITE)}")


def render_architect(plan: dict) -> None:
    _section("architect")
    _field("plan kind", plan["kind"].replace("_", " "))
    if plan["kind"] == "elimination_plan":
        _field("redesign rule", plan["redesign_rule"])
        _field("steps retained", f"{len(plan['mandatory_steps_retained'])} of {len(plan['mandatory_steps_retained']) + len(plan['decorative_steps_removed'])}")
        _field("steps removed", f"{len(plan['decorative_steps_removed'])}")
        _field("integrations to retire", f"{len(plan['integrations_to_retire'])}")
        _field("cm treatment", plan["cm_treatment"])
    elif plan["kind"] == "improvement_plan":
        _field("current ruling", plan["current_classification"])
        _field("target ruling", plan["target_classification"])
        _field("feasible", str(plan["feasible"]))
        _field("recommendations", str(len(plan["recommendations"])))
    elif plan["kind"] == "agentic_deployment":
        _field("ai pattern", plan["ai_pattern"])
        _field("topology", plan["topology"])
        _field("validation gate", plan["validation_gate"])
        _field("cm treatment", plan["cm_treatment"])


def render_wire(log: dict) -> None:
    _section("wire")
    _field("target", "MuleSoft Anypoint (mock)")
    _field("calls executed", str(len(log["anypoint_calls"])))
    for call in log["anypoint_calls"][:8]:
        ok_mark = c("ok", AMBER, BOLD) if call["result"] == "ok" else c(call["result"], AMBER)
        print(f"      {c('[' + ok_mark + ']', AMBER)}  {call['verb']:<6} {call['system']:<14} {call['endpoint']}")
    total_calls = len(log["anypoint_calls"])
    if total_calls > 8:
        extra = total_calls - 8
        print(f"      {c(f'and {extra} more calls', NAVY, DIM)}")
    _field("rollback held until", log["rollback_held_until"])
    if "log_path" in log:
        _field("log written", Path(log["log_path"]).name)
    if "cm_plan_path" in log:
        _field("cm plan written", Path(log["cm_plan_path"]).name)


def render_verdict_card(candidate: dict, v: dict, plan: dict, log: dict) -> None:
    print()
    print(_top())
    print(_line(f"  {c('verdict card', AMBER_SOFT, BOLD)}"))
    print(_line(""))
    print(_line(f"  {c('workflow:', NAVY, DIM):<14}  {candidate['name']}"))
    print(_line(f"  {c('company:', NAVY, DIM):<14}  {candidate['company']['name']}"))
    print(_line(f"  {c('ruling:', NAVY, DIM):<14}  {c(v['ruling'], AMBER, BOLD)}"))
    saving = log.get("saving", {})
    if "total_eur_per_year" in saving:
        print(_line(f"  {c('annual saving:', NAVY, DIM):<14}  {c(_eur(saving['total_eur_per_year']), AMBER, BOLD)}"))
        print(_line(f"  {c('  · labour:', NAVY, DIM):<14}  {_eur(saving['labour_eur_per_year'])}"))
        print(_line(f"  {c('  · integrations:', NAVY, DIM):<14}  {_eur(saving['integration_eur_per_year'])}"))
    if "net_low_eur_per_year" in saving:
        opp = f"{_eur(saving['net_low_eur_per_year'])} to {_eur(saving['net_high_eur_per_year'])}"
        print(_line(f"  {c('net opportunity:', NAVY, DIM):<14}  {c(opp, AMBER, BOLD)}"))
        print(_line(f"  {c('shadow window:', NAVY, DIM):<14}  {saving['shadow_window_days']} days, daily divergence reports"))
    if v["ruling"] == "Stop":
        print(_line(f"  {c('new ai required:', NAVY, DIM):<14}  {c('zero', AMBER, BOLD)}"))
    if v["ruling"] == "Accelerate":
        ai_short = plan["ai_pattern"].split(" with ")[0]
        print(_line(f"  {c('ai pattern:', NAVY, DIM):<14}  {c(ai_short, AMBER, BOLD)}"))
    print(_line(""))
    print(_line(f"  {c('the metric on the box:', AMBER, DIM)}"))
    print(_line(f"  {c('percent of work eliminated, not automated.', WHITE)}"))
    print(_bot())
    print()


def render_sequencer(plan_90: dict) -> None:
    _section("sequencer  ·  90-day rollout plan")
    s = plan_90["summary"]
    _field("stops", str(s["stops"]))
    _field("accelerates", str(s["accelerates"]))
    _field("fixes", str(s["fixes"]))
    _field("keeps", str(s["keeps"]))
    print()
    _field("wave 1 saving (annual)", _eur(s["wave_1_saving_eur_per_year"]))
    opp = s["wave_2_3_opportunity_eur_per_year"]
    _field("wave 2-3 opportunity", f"{_eur(opp['low'])} to {_eur(opp['high'])} per year")

    for key, label in [("wave_1", "wave 1"), ("wave_2", "wave 2"), ("wave_3", "wave 3")]:
        wave = plan_90[key]
        print()
        print(f"    {c(label + ', ' + wave['window'] + ', ' + wave['kind'], AMBER, BOLD)}")
        print(f"      {c('rationale:', NAVY, DIM)} {wave['rationale']}")
        if wave["items"]:
            print(f"      {c('items:', NAVY, DIM)}")
            for it in wave["items"]:
                print(f"        {c('•', AMBER)} {it['workflow']}  ·  {it['company']}  ·  {c(_eur(it['headline_eur_per_year']) + '/yr', AMBER, BOLD)}")
        else:
            print(f"      {c('items:', NAVY, DIM)} {c('none in this wave', NAVY, DIM)}")
        if wave["gate_to_next_wave"]:
            print(f"      {c('gate to next wave:', NAVY, DIM)} {wave['gate_to_next_wave']}")


def render_portfolio_card(portfolio: list[dict], plan_90: dict) -> None:
    print()
    print(_top())
    print(_line(f"  {c('portfolio card', AMBER_SOFT, BOLD)}"))
    print(_line(""))
    print(_line(f"  {c('workflows scored:', NAVY, DIM)}  {len(portfolio)}"))
    rulings = "  ·  ".join(p["verdict"]["ruling"] for p in portfolio)
    print(_line(f"  {c('rulings:', NAVY, DIM)}  {rulings}"))
    print(_line(""))
    s = plan_90["summary"]
    print(_line(f"  {c('wave 1 saving:', NAVY, DIM)}  {c(_eur(s['wave_1_saving_eur_per_year']) + ' per year', AMBER, BOLD)}"))
    opp = s["wave_2_3_opportunity_eur_per_year"]
    print(_line(f"  {c('wave 2-3 upside:', NAVY, DIM)}  {c(_eur(opp['low']) + ' to ' + _eur(opp['high']) + ' per year', AMBER, BOLD)}"))
    print(_line(""))
    print(_line(f"  {c('the metric on the box:', AMBER, DIM)}"))
    print(_line(f"  {c('percent of work eliminated, not automated.', WHITE)}"))
    print(_bot())
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description="The Workflow Coroner")
    parser.add_argument("logs", nargs="*", default=[str(HERE / "fixtures" / "procurement.json")],
                        help="One or more Celonis-shaped log summary JSON paths. Multiple paths trigger portfolio mode and run Sequencer.")
    parser.add_argument("--output", default=str(HERE / "output"),
                        help="Directory to write decommission logs, CM plans, and the 90-day plan")
    args = parser.parse_args()

    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    banner(today)

    portfolio = []
    output_dir = Path(args.output)

    for idx, log_path in enumerate(args.logs, start=1):
        if len(args.logs) > 1:
            print()
            print(f"  {c('── workflow ' + str(idx) + ' of ' + str(len(args.logs)) + ' ──', AMBER, BOLD)}")

        candidate = pulse.scan(log_path)
        render_pulse(candidate)

        v = verdict_mod.adjudicate(candidate)
        render_verdict(v)

        plan = architect.design(candidate, v)
        render_architect(plan)

        log = wire.execute(candidate, v, plan, output_dir)
        render_wire(log)

        render_verdict_card(candidate, v, plan, log)

        portfolio.append({"candidate": candidate, "verdict": v, "plan": plan, "log": log})

    if len(portfolio) > 1:
        plan_90 = sequencer.sequence(portfolio)
        render_sequencer(plan_90)

        plan_90_path = output_dir / f"ninety-day-plan-{today}.json"
        plan_90_path.write_text(json.dumps(plan_90, indent=2), encoding="utf-8")
        print(f"\n    {c('plan written:', NAVY, DIM)} {plan_90_path.name}")

        render_portfolio_card(portfolio, plan_90)

    return 0


if __name__ == "__main__":
    sys.exit(main())
