"""Verdict, real Claude sub-agent.

Same envelope as verdict.adjudicate, but the pillar scoring and BVF input
selection runs through claude-sonnet-4-5 with forced tool use. The agent
attaches a senior-practitioner rationale that lands in the verdict card.

Requires:
    pip install anthropic
    export ANTHROPIC_API_KEY=...
"""
from __future__ import annotations
import json
from typing import Any

from anthropic import Anthropic

from _aibvf_loader import score, calculate_pace_layer_drag

MODEL = "claude-sonnet-4-5-20250929"

SYSTEM_PROMPT = """You are Verdict, a sub-agent inside Craig Horton's Workflow Coroner.

The Coroner is a Stop-first BVF adjudicator. It reads process-mined workflows from Pulse, scores them against the AI Business Value Framework v1.0, and routes the result to Architect (target-state design) and Wire (MuleSoft Anypoint actuation).

Your job, on each candidate:
1. Derive the BVF v1.0 inputs from the candidate's signals.
2. Submit them via the submit_bvf_inputs tool, with a senior-practitioner rationale, two to three sentences.

Default rubric for the four pillars, 0 to 100:

- strategic_alignment: start at 20. Add 30 if named_kpi is present and concrete. Add 30 if executive_owner is named. Add 20 if function_hint is one of sales, supply, rd, cx.
- financial_return: start at (30 + 50 * automation_coverage). Subtract rework_rate * 100, exception_rate * 100, and median_cycle_time_hours / 10. Floor 5, ceiling 100.
- change_enablement: 75 if readiness is agile, 60 if traditional, 45 if siloed. Subtract the integrations count.
- governance_risk: 30 base. Add 2 per regulatory keyword. Add exception_rate * 200. Floor 0, ceiling 100.

Default inferred enums:
- ai_tier: gen1 if automation_coverage < 0.30, gen2 if < 0.65, else gen3.
- readiness: agile if rework_rate + exception_rate < 0.10, traditional if < 0.20, else siloed.

Senior-practitioner judgement: you may adjust any score by up to 5 points in either direction if the signals warrant it. Examples that warrant adjustment:
- regulatory keywords are ceremonial rather than substantive (audit trail with no real downstream review)
- named_kpi exists but is vague or non-binding
- automation_coverage is high but rework concentrates in the automated paths, suggesting brittle automation
- integrations include orchestration plumbing that is not real coupling

If you adjust, name the adjustment in the rationale.

Voice rules for the rationale, non-negotiable:
- Sentence case throughout.
- No em-dashes. Use commas or fresh sentences.
- No all-caps emphasis. The four ruling labels are Stop, Fix, Accelerate, Keep.
- No banned words: crucial, leverage, pivotal, robust (as a generic adjective), navigate (without a concrete object), seamless, unleash, foster, garner, delve, embark.
- No "X is not A, it is B" pattern. Make the gap claim directly.
- Direct, no hedging. No "it seems," "perhaps," "I think."
- Three-sentence paragraph maximum."""


SUBMIT_BVF_TOOL = {
    "name": "submit_bvf_inputs",
    "description": (
        "Submit the derived BVF v1.0 inputs and a senior-practitioner rationale "
        "for the workflow candidate. The orchestrator runs the deterministic "
        "score function on these inputs and returns the verdict."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "industry": {
                "type": "string",
                "enum": [
                    "universal", "creative", "education", "energy", "financial",
                    "healthcare", "logistics", "manufacturing", "nonprofit",
                    "professional", "public_sector", "real_estate", "retail", "technology",
                ],
            },
            "function": {
                "type": "string",
                "enum": ["finance", "hr", "sales", "supply", "cx", "risk", "it", "rd"],
            },
            "ai_tier": {"type": "string", "enum": ["gen1", "gen2", "gen3"]},
            "readiness": {"type": "string", "enum": ["agile", "traditional", "siloed"]},
            "scores": {
                "type": "object",
                "properties": {
                    "strategic_alignment": {"type": "integer", "minimum": 0, "maximum": 100},
                    "financial_return": {"type": "integer", "minimum": 0, "maximum": 100},
                    "change_enablement": {"type": "integer", "minimum": 0, "maximum": 100},
                    "governance_risk": {"type": "integer", "minimum": 0, "maximum": 100},
                },
                "required": ["strategic_alignment", "financial_return", "change_enablement", "governance_risk"],
            },
            "rationale": {
                "type": "string",
                "description": "Two to three sentences in Craig Horton voice. Senior-practitioner. Why these scores, what the candidate's tell is.",
            },
        },
        "required": ["industry", "function", "ai_tier", "readiness", "scores", "rationale"],
    },
}


def adjudicate(candidate: dict) -> dict[str, Any]:
    """Run a Claude-powered scoring pass, then call the deterministic BVF engine on the result."""
    client = Anthropic()

    user_payload = {
        "company": candidate["company"],
        "function_hint": candidate["function_hint"],
        "metrics": candidate["metrics"],
        "integrations": candidate["integrations"],
        "integrations_count": len(candidate["integrations"]),
        "regulatory_keywords": candidate["regulatory_keywords"],
        "named_kpi": candidate["named_kpi"],
        "executive_owner": candidate["executive_owner"],
        "pace_layer": candidate["pace_layer"],
        "activities_count": len(candidate["activities"]),
    }

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        temperature=0,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        tools=[SUBMIT_BVF_TOOL],
        tool_choice={"type": "tool", "name": "submit_bvf_inputs"},
        messages=[{"role": "user", "content": json.dumps(user_payload)}],
    )

    tool_use = next((b for b in response.content if b.type == "tool_use"), None)
    if tool_use is None:
        raise RuntimeError("Verdict agent returned no tool_use block.")

    args = tool_use.input

    bvf_inputs = {
        "industry": args["industry"],
        "revenue_eur": candidate["company"]["annual_revenue_eur"],
        "function": args["function"],
        "ai_tier": args["ai_tier"],
        "readiness": args["readiness"],
        "scores": args["scores"],
    }

    bvf_result = score(**bvf_inputs)
    drag = calculate_pace_layer_drag(
        revenue_eur=candidate["company"]["annual_revenue_eur"],
        ai_tier=args["ai_tier"],
        readiness=args["readiness"],
        industry=args["industry"],
    )

    return {
        "bvf_inputs": bvf_inputs,
        "bvf_result": bvf_result,
        "pace_drag": drag,
        "ruling": bvf_result["classification"],
        "reason": bvf_result["reason"],
        "bvf_health_score": bvf_result["confidence"],
        "rationale": args["rationale"],
        "agent": True,
        "agent_model": MODEL,
        "agent_usage": {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "cache_read_input_tokens": getattr(response.usage, "cache_read_input_tokens", 0),
            "cache_creation_input_tokens": getattr(response.usage, "cache_creation_input_tokens", 0),
        },
    }
