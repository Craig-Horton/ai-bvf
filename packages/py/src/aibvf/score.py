"""AI BVF v1.0 scoring engine. Deterministic, no dependencies.

The same rules as @aibvf/core, the TypeScript engine behind the AI BVF connector.
Both engines are held to one file of expected results, spec/parity-vectors.json,
in CI: the same inputs give the same verdict, the same score and the same euros.
"""
from __future__ import annotations

import math

from .taxonomy import INDUSTRIES, REGULATED_FUNCTIONS, REGULATED_INDUSTRIES

PLANNING_SOURCE = "AI BVF modelled planning range; external research provides context but does not publish this function-specific rate."
PLANNING_GUIDANCE = "Use for an initial hypothesis only. Replace the range with measured baseline, addressable volume, unit economics and an explicit capture rate before committing budget."
REVIEWED_AT = "2026-08-23"
BENCHMARK_EVIDENCE_REGISTER = [
    {
        "title": "McKinsey, The state of AI 2025",
        "url": "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai/",
        "finding": "88% reported regular AI use in at least one function; 39% reported enterprise-level EBIT impact.",
        "boundary": "Survey context only; it does not publish the AI BVF function rates.",
    },
    {
        "title": "Deloitte, AI ROI 2025",
        "url": "https://www.deloitte.com/global/en/issues/generative-ai/ai-roi-the-paradox-of-rising-investment-and-elusive-returns.html",
        "finding": "Most respondents reported satisfactory ROI in two to four years; 6% reported payback inside one year.",
        "boundary": "Survey context only; it does not publish AI BVF tier payback values.",
    },
    {
        "title": "Gartner, GenAI project failure 2026",
        "url": "https://www.gartner.com/en/articles/genai-project-failure",
        "finding": "At least 50% of GenAI projects had been abandoned after proof of concept because of data quality, risk controls, cost or unclear value.",
        "boundary": "Diagnostic context only; it does not define an AI BVF change-funding percentage.",
    },
    {
        "title": "Prosci, How to budget for change management",
        "url": "https://www.prosci.com/blog/how-to-budget-for-change-management",
        "finding": "10% was the most common allocation for adoption and change management.",
        "boundary": "A planning reference to tailor to the work, not a minimum, compliance test or outcome guarantee.",
    },
    {
        "title": "EY and Oxford Saïd, Humans at the centre of transformation",
        "url": "https://www.ey.com/en_uk/insights/consulting/how-transformations-with-humans-at-the-center-can-double-your-success",
        "finding": "Above-average practice across six human factors increased the predicted likelihood of transformation success from 28% to 73% in the study.",
        "boundary": "Supports the six diagnostic questions; it does not validate AI BVF weights, drag rates or financial ranges.",
    },
]


def _planning_rate(rev, cost, drivers):
    return {
        "rev": rev,
        "cost": cost,
        "drivers": drivers,
        "source": PLANNING_SOURCE,
        "evidence_status": "modelled_planning_assumption",
        "reviewed_at": REVIEWED_AT,
        "use_guidance": PLANNING_GUIDANCE,
    }


BASE_RATES = {
    "finance": _planning_rate({"lo": 0.010, "hi": 0.030}, {"lo": 0.030, "hi": 0.060}, ["Close cycle reduction", "FP&A and forecasting", "Anomaly detection and write-off prevention"]),
    "hr":      _planning_rate({"lo": 0.005, "hi": 0.015}, {"lo": 0.020, "hi": 0.040}, ["Attrition and replacement cost", "HR service operations", "Skills-based workforce deployment"]),
    "sales":   _planning_rate({"lo": 0.030, "hi": 0.080}, {"lo": 0.010, "hi": 0.025}, ["Personalisation", "Lead and pipeline quality", "Deal coaching and sales operations"]),
    "supply":  _planning_rate({"lo": 0.005, "hi": 0.015}, {"lo": 0.040, "hi": 0.090}, ["Unplanned downtime", "Inventory holding cost", "Quality, rework and service levels"]),
    "cx":      _planning_rate({"lo": 0.020, "hi": 0.050}, {"lo": 0.020, "hi": 0.050}, ["Self-service and containment", "Handling time and first-contact resolution", "Retention and customer lifetime value"]),
    "risk":    _planning_rate({"lo": 0.005, "hi": 0.010}, {"lo": 0.020, "hi": 0.040}, ["False positives and case handling", "Regulatory reporting effort", "Continuous control monitoring"]),
    "it":      _planning_rate({"lo": 0.005, "hi": 0.015}, {"lo": 0.030, "hi": 0.070}, ["Incident volume and resolution time", "AIOps prevention", "Service automation and platform throughput"]),
    "rd":      _planning_rate({"lo": 0.010, "hi": 0.040}, {"lo": 0.010, "hi": 0.030}, ["Development cycle time", "Design and simulation", "Research and IP analysis"]),
}

IND_MULT = {
    "universal":     {"finance": 1.0, "hr": 1.0, "sales": 1.0, "supply": 1.0, "cx": 1.0, "risk": 1.0, "it": 1.0, "rd": 1.0},
    "creative":      {"finance": 1.0, "hr": 1.0, "sales": 1.3, "supply": 1.0, "cx": 1.3, "risk": 1.0, "it": 1.0, "rd": 1.2},
    "education":     {"finance": 1.0, "hr": 1.2, "sales": 1.0, "supply": 1.0, "cx": 1.0, "risk": 1.0, "it": 1.2, "rd": 1.4},
    "energy":        {"finance": 1.0, "hr": 1.0, "sales": 1.0, "supply": 1.4, "cx": 1.0, "risk": 1.3, "it": 1.3, "rd": 1.0},
    "financial":     {"finance": 1.4, "hr": 1.1, "sales": 1.2, "supply": 0.7, "cx": 1.3, "risk": 1.5, "it": 1.1, "rd": 0.8},
    "healthcare":    {"finance": 1.1, "hr": 1.1, "sales": 1.0, "supply": 0.8, "cx": 1.1, "risk": 1.4, "it": 1.0, "rd": 1.5},
    "logistics":     {"finance": 1.2, "hr": 1.0, "sales": 1.0, "supply": 1.5, "cx": 1.0, "risk": 1.0, "it": 1.3, "rd": 1.0},
    "manufacturing": {"finance": 1.0, "hr": 1.0, "sales": 0.9, "supply": 1.4, "cx": 0.9, "risk": 1.1, "it": 1.3, "rd": 1.1},
    "nonprofit":     {"finance": 1.1, "hr": 1.2, "sales": 1.0, "supply": 1.0, "cx": 1.2, "risk": 1.0, "it": 1.0, "rd": 1.0},
    "professional":  {"finance": 1.0, "hr": 1.2, "sales": 1.4, "supply": 1.0, "cx": 1.3, "risk": 1.0, "it": 1.0, "rd": 1.0},
    "public_sector": {"finance": 1.0, "hr": 1.2, "sales": 1.0, "supply": 1.0, "cx": 1.0, "risk": 1.3, "it": 1.2, "rd": 1.0},
    "real_estate":   {"finance": 1.3, "hr": 1.0, "sales": 1.2, "supply": 1.2, "cx": 1.0, "risk": 1.0, "it": 1.0, "rd": 1.0},
    "retail":        {"finance": 1.0, "hr": 1.0, "sales": 1.4, "supply": 1.2, "cx": 1.4, "risk": 0.9, "it": 1.0, "rd": 0.8},
    "technology":    {"finance": 1.0, "hr": 1.1, "sales": 1.2, "supply": 0.8, "cx": 1.1, "risk": 1.0, "it": 1.4, "rd": 1.4},
}

TIER_ADJ = {"gen1": 0.55, "gen2": 1.00, "gen3": 1.35}

READINESS_CAPTURE = {
    "agile":       {"low": 0.85, "high": 1.00, "label": "Agile & Collaborative"},
    "traditional": {"low": 0.50, "high": 0.70, "label": "Traditional Hierarchy"},
    "siloed":      {"low": 0.25, "high": 0.40, "label": "Siloed & Bureaucratic"},
}

# AI BVF pace-layer planning assumptions. External research informs the questions,
# but does not publish or validate these rates. Replace them with organisation data.
PACE_DRAG_RATE = {
    "gen1": {"agile": {"lo": 0.001, "hi": 0.003}, "traditional": {"lo": 0.003, "hi": 0.008}, "siloed": {"lo": 0.008, "hi": 0.015}},
    "gen2": {"agile": {"lo": 0.002, "hi": 0.005}, "traditional": {"lo": 0.010, "hi": 0.020}, "siloed": {"lo": 0.020, "hi": 0.035}},
    "gen3": {"agile": {"lo": 0.005, "hi": 0.010}, "traditional": {"lo": 0.025, "hi": 0.045}, "siloed": {"lo": 0.045, "hi": 0.080}},
}

PACE_DRAG_DRIVERS = {
    "agile":       ["Minimal drag: governance cadence roughly matches deployment cadence", "Residual drag from cross-team handoffs", "Incremental cost from over-governing low-risk use cases"],
    "traditional": ["Approval cycles outrun deployment cycles", "Budget re-allocation friction (annual cycles vs weekly change)", "Skills gap between model risk oversight and delivery teams"],
    "siloed":      ["Functional ownership blocks horizontal data flow", "Shadow AI proliferates outside governance", "Duplicated spend across silos on overlapping models", "Change-management budget absent or symbolic"],
}

PACE_DRAG_SOURCE = "AI BVF pace-layer planning model. External research informs the questions, but does not publish or validate these drag rates."

PILLAR_ACTIONS = {
    "strategic_alignment": {
        "action": "Tie this initiative to a named board-level KPI with a written success metric and a single accountable executive owner.",
        "rationale": "The initiative has no named KPI and owner, so the value case cannot yet be governed. Name both and test them before funding.",
    },
    "financial_return": {
        "action": "Rebuild the business case with itemised gross benefit (revenue uplift + cost take-out), a change cost line, and a capture rate tied to current readiness.",
        "rationale": "Weak financial return almost always means the capture rate has been assumed away. Re-running the case with the honest capture rate either reveals a real benefit or kills a vanity project.",
    },
    "change_enablement": {
        "action": "Fund a dedicated change-management budget at 15 to 25 percent of total initiative spend, and assign a named product owner with capacity.",
        "rationale": "Funding alone does not prove readiness. Name the owner, cost the change work and replace this planning assumption with adoption evidence before funding.",
    },
    "governance_risk": {
        "action": "Commission a pre-deployment governance review covering data lineage, model risk, EU AI Act classification, and human-in-the-loop design.",
        "rationale": "High governance exposure is not an argument for stopping by default; it is an argument for paying the governance cost up front rather than during a regulatory incident.",
    },
}

RAISE_TARGET = 65
GOV_LOWER_TARGET = 35


def _applied_modules(industry: str, function: str, readiness: str) -> list:
    mods = ["four_pillar_base", f"readiness_capture_{readiness}"]
    if industry == "healthcare":
        mods += ["healthcare_clinical_validation", "healthcare_regulatory_overhead"]
        if function == "risk":
            mods.append("healthcare_hipaa_module")
    if industry == "financial":
        mods.append("financial_model_risk_overhead")
        if function == "risk":
            mods.append("financial_dora_module")
    if industry == "public_sector":
        mods.append("public_sector_procurement_module")
    if industry == "energy":
        mods.append("energy_critical_infrastructure_module")
    return mods


_PILLARS = ("strategic_alignment", "financial_return", "change_enablement", "governance_risk")


def _round(x: float) -> int:
    """Round to the nearest whole number, a half going up: what Math.round does.

    Python's own round() sends a half to the nearest even number, so 22.5 became 22
    where the TypeScript engine gives 23.
    """
    floor = math.floor(x)
    return floor + 1 if x - floor >= 0.5 else floor


def _num(x) -> str:
    """A number as the TypeScript engine writes it in a sentence: 1, not 1.0."""
    return str(int(x)) if float(x).is_integer() else repr(float(x))


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _classify(sa: float, fr: float, ce: float, gr: float) -> dict:
    if gr >= 70 or fr <= 20:
        return {"label": "Stop", "reason": "Governance risk above the safe threshold." if gr >= 70 else "Financial return too thin to justify scope."}
    if sa >= 60 and fr >= 60 and ce >= 60 and gr <= 40:
        return {"label": "Accelerate", "reason": "All four pillars clear, governance contained."}
    gaps = []
    if sa < 60: gaps.append("strategic alignment is weak")
    if fr < 60: gaps.append("financial return is thin")
    if ce < 60: gaps.append("change enablement is a risk")
    if gr > 40: gaps.append("governance exposure is real")
    return {"label": "Fix", "reason": f"Workable, but {'; '.join(gaps)}. Close the gap before scaling."}


_WORK_CHECKS = (
    ("workflow_redesigned", "end-to-end workflow redesigned"),
    ("roles_redesigned", "affected roles and accountabilities redesigned"),
    ("decision_rights_defined", "decision, override and escalation rights defined"),
    ("measures_updated", "performance measures and incentives updated"),
)
_WORK_NEXT_QUESTION = "What changes in the end-to-end workflow, affected roles, human decision rights and performance measures before this AI goes live?"
_WORK_GATE = "Accelerate requires the workflow, affected roles, human decision rights and performance measures to be evidenced, with no stated gaps, before deployment."


def assess_work_architecture(work_architecture=None) -> dict:
    """The work-design gate: has the work around the AI been redesigned, and is that evidenced?

    Each of the four checks is met (True), a gap (False) or unknown (not given).
    Anything short of all four met blocks an Accelerate.
    """
    given = work_architecture if isinstance(work_architecture, dict) else {}
    checks = [
        {"id": check_id, "label": label, "status": "met" if given.get(check_id) is True else "gap" if given.get(check_id) is False else "unknown"}
        for check_id, label in _WORK_CHECKS
    ]
    gaps = [check["label"] for check in checks if check["status"] == "gap"]
    unknowns = [check["label"] for check in checks if check["status"] == "unknown"]
    known = len(checks) - len(unknowns)
    status = "gap" if gaps else "ready" if known == len(checks) else "partial" if known > 0 else "unknown"
    result = {"status": status, "blocks_accelerate": status != "ready", "checks": checks, "gaps": gaps, "unknowns": unknowns}
    if status != "ready":
        result["next_question"] = _WORK_NEXT_QUESTION
    result["gate"] = _WORK_GATE
    return result


def estimate_pillars(*, industry=None, function: str, ai_tier: str, readiness: str) -> dict:
    """Deterministic pillar estimates for a caller with no measured scores.

    Every estimate sits in unproven territory by design: an estimate can force
    caution, and can never hand out the scores an Accelerate requires.
    """
    base = BASE_RATES.get(function)
    upside = base["rev"]["hi"] + base["cost"]["hi"] if base else 0
    financial_return = 52 if upside >= 0.10 else 46 if upside >= 0.07 else 40
    change_enablement = {"agile": 55, "traditional": 45, "siloed": 32}.get(readiness, 45)
    governance_risk = {"gen1": 30, "gen2": 42, "gen3": 55}.get(ai_tier, 42)
    if function in REGULATED_FUNCTIONS:
        governance_risk += 10
    if industry and industry in REGULATED_INDUSTRIES:
        governance_risk += 8
    governance_risk = min(100, governance_risk)
    return {"strategic_alignment": 50, "financial_return": financial_return, "change_enablement": change_enablement, "governance_risk": governance_risk}


def resolve_pillars(*, industry=None, function: str, ai_tier: str, readiness: str, scores=None, pillar_basis=None) -> dict:
    """Given and estimated pillars as one full set, with where each came from.

    A pillar is a number, or {"value", "confidence", "basis"}. A pillar marked
    estimated, in the object or in pillar_basis, is never counted as given: the
    engine uses its own estimate and says so. `supported` is the signal the
    pillars themselves support.
    """
    estimate = estimate_pillars(industry=industry, function=function, ai_tier=ai_tier, readiness=readiness)
    given = scores if isinstance(scores, dict) else {}
    marks = pillar_basis if isinstance(pillar_basis, dict) else {}
    resolved, basis, qualities = {}, {}, []
    given_count = 0
    for pillar in _PILLARS:
        raw = given.get(pillar)
        mark = marks.get(pillar)
        if mark is None and isinstance(raw, dict):
            mark = raw.get("basis")
        if mark is not None and mark not in ("given", "estimated"):
            raise ValueError(f"pillar basis for {pillar} must be given or estimated.")
        value = raw if _is_number(raw) else raw.get("value") if isinstance(raw, dict) and _is_number(raw.get("value")) else None
        if value is not None and not (math.isfinite(value) and 0 <= value <= 100):
            raise ValueError(f"scores.{pillar} must be a number from 0 to 100.")
        estimated = mark == "estimated" or value is None
        if estimated:
            resolved[pillar], basis[pillar] = estimate[pillar], "estimated"
        else:
            resolved[pillar], basis[pillar] = value, "given"
            given_count += 1
        reported = max(0, min(1, raw["confidence"] / 100)) if isinstance(raw, dict) and _is_number(raw.get("confidence")) else None
        qualities.append(reported if reported is not None else 0.5 if estimated else 1)
    default_signal = 0.5 + 0.125 * given_count
    reported_signal = sum(qualities) / len(_PILLARS)
    supported = _round(min(default_signal, reported_signal) * 10000) / 10000
    return {"scores": resolved, "basis": basis, "given_count": given_count, "supported": supported}


_SIGNAL_CAVEAT_THRESHOLD = 0.7


def _check_context(industry, function, ai_tier, readiness):
    """Unknown values are refused, never read as something else."""
    if industry not in INDUSTRIES:
        raise ValueError(f"Unknown industry: {industry}")
    base = BASE_RATES.get(function)
    if base is None:
        raise ValueError(f"Unknown function: {function}")
    t_adj = TIER_ADJ.get(ai_tier)
    if t_adj is None:
        raise ValueError(f"Unknown ai_tier: {ai_tier}")
    cap = READINESS_CAPTURE.get(readiness)
    if cap is None:
        raise ValueError(f"Unknown readiness: {readiness}")
    return base, t_adj, cap


def score(*, industry: str, revenue_eur: float, function: str, ai_tier: str, readiness: str,
          scores=None, pillar_basis=None, signal_completeness=None, work_architecture=None) -> dict:
    """Score an initiative according to AI BVF v1.0. Deterministic.

    The same rules as the TypeScript engine: missing pillars are estimated and
    reported, an Accelerate needs the work design evidenced, euros are whole,
    and signal_completeness is an upper limit only.
    """
    base, t_adj, cap = _check_context(industry, function, ai_tier, readiness)
    mult = IND_MULT[industry].get(function, 1.0)

    pillars = resolve_pillars(industry=industry, function=function, ai_tier=ai_tier, readiness=readiness, scores=scores, pillar_basis=pillar_basis)
    resolved, basis, given_count, supported = pillars["scores"], pillars["basis"], pillars["given_count"], pillars["supported"]
    sa, fr, ce, gr = (resolved[pillar] for pillar in _PILLARS)
    all_estimated = given_count == 0
    work = assess_work_architecture(work_architecture)
    blockers = work["gaps"] + [f"{item} not evidenced" for item in work["unknowns"]]

    gross_lo = _round(revenue_eur * (base["rev"]["lo"] + base["cost"]["lo"]) * mult * t_adj)
    gross_hi = _round(revenue_eur * (base["rev"]["hi"] + base["cost"]["hi"]) * mult * t_adj)
    net_lo = _round(gross_lo * cap["low"])
    net_hi = _round(gross_hi * cap["high"])

    cls = _classify(sa, fr, ce, gr)
    if all_estimated and cls["label"] == "Accelerate":
        cls = {"label": "Fix", "reason": "Clears the Accelerate thresholds on estimated pillars only. Confirm the four pillar scores with evidence to unlock the Go."}
    if work["blocks_accelerate"] and cls["label"] == "Accelerate":
        cls = {"label": "Fix", "reason": f"The four pillars clear, but the work architecture does not: {'; '.join(blockers)}. Complete and evidence the work design before scaling."}

    base_confidence = (sa + fr + ce + (100 - gr)) / 4
    if signal_completeness is not None and not (_is_number(signal_completeness) and math.isfinite(signal_completeness)):
        raise ValueError("signal_completeness must be a number from 0 to 1.")
    asked = None if signal_completeness is None else max(0, min(1, signal_completeness))
    signal = max(0, min(1, supported if asked is None else min(asked, supported)))
    capped = asked is not None and asked > supported
    confidence = _round(base_confidence * (0.5 + 0.5 * signal))

    caveat_parts = []
    estimated = [pillar for pillar in _PILLARS if basis[pillar] == "estimated"]
    if estimated:
        caveat_parts.append(f"Estimated pillars: {', '.join(estimated)} (deterministic AI BVF priors from readiness, tier and function, see pillar_basis). Confirm them with evidence before committing budget.")
    if capped:
        caveat_parts.append(f"signal_completeness {_num(asked)} was given. The pillars supplied support {_num(signal)}, so {_num(signal)} is used: a caller can lower the signal and cannot raise it.")
    if signal < _SIGNAL_CAVEAT_THRESHOLD:
        caveat_parts.append(f"Verdict rests on soft inputs (signal_completeness {_num(signal)}). Decision confidence has been reduced accordingly; treat this as directional.")

    result = {
        "classification": cls["label"],
        "reason": cls["reason"],
        "gross_low_eur": gross_lo,
        "gross_high_eur": gross_hi,
        "net_low_eur": net_lo,
        "net_high_eur": net_hi,
        "confidence": confidence,
        "multipliers": {"industry": mult, "tier": t_adj, "capture_low": cap["low"], "capture_high": cap["high"]},
        "drivers": base["drivers"],
        "source": base["source"],
        "applied_modules": _applied_modules(industry, function, readiness) + ["work_architecture_gate"],
        "scores_used": resolved,
        "pillar_basis": basis,
        "signal_completeness": {"used": signal, "supported": supported, **({} if asked is None else {"given": asked})},
        "work_architecture": work,
    }
    if caveat_parts:
        result["caveat"] = " ".join(caveat_parts)
    return result


def recommend_improvements(*, industry: str, revenue_eur: float, function: str, ai_tier: str, readiness: str,
                           scores=None, pillar_basis=None, work_architecture=None) -> dict:
    """For Stop/Fix results, return pillar raises that would flip toward Accelerate."""
    _check_context(industry, function, ai_tier, readiness)
    pillars = resolve_pillars(industry=industry, function=function, ai_tier=ai_tier, readiness=readiness, scores=scores, pillar_basis=pillar_basis)
    resolved, basis, given_count = pillars["scores"], pillars["basis"], pillars["given_count"]
    sa, fr, ce, gr = (resolved[pillar] for pillar in _PILLARS)

    work = assess_work_architecture(work_architecture)
    blockers = work["gaps"] + [f"{item} not evidenced" for item in work["unknowns"]]
    current = _classify(sa, fr, ce, gr)["label"]
    # The same two holds as score(): estimates alone, or a work design that is not evidenced, give no Accelerate.
    if given_count == 0 and current == "Accelerate":
        current = "Fix"
    if work["blocks_accelerate"] and current == "Accelerate":
        current = "Fix"
    recs = []
    notes = []
    if given_count < 4:
        estimated = [pillar for pillar in _PILLARS if basis[pillar] == "estimated"]
        notes.append(f"Estimated pillars: {', '.join(estimated)} (deterministic AI BVF priors from readiness, tier and function). The plan below is provisional on those pillars; confirm them with evidence and re-run.")
    if work["status"] != "ready":
        notes.append(
            f"Work architecture blockers: {', '.join(blockers)}. These must be resolved before Accelerate."
            if work["blocks_accelerate"]
            else f"Work architecture evidence is {work['status']}. {work.get('next_question', '')}"
        )

    if current == "Accelerate":
        return {
            "current_classification": current,
            "target_classification": current,
            "feasible": True,
            "recommendations": [],
            "projected_confidence": _round((sa + fr + ce + (100 - gr)) / 4),
            "notes": ["Initiative is already classified Accelerate. No flip required."],
        }

    if sa < 60:
        recs.append({"pillar": "strategic_alignment", "current": sa, "target": RAISE_TARGET, "delta": RAISE_TARGET - sa, **PILLAR_ACTIONS["strategic_alignment"]})
    if fr < 60:
        recs.append({"pillar": "financial_return", "current": fr, "target": RAISE_TARGET, "delta": RAISE_TARGET - fr, **PILLAR_ACTIONS["financial_return"]})
    if ce < 60:
        recs.append({"pillar": "change_enablement", "current": ce, "target": RAISE_TARGET, "delta": RAISE_TARGET - ce, **PILLAR_ACTIONS["change_enablement"]})
    if gr > 40:
        recs.append({"pillar": "governance_risk", "current": gr, "target": GOV_LOWER_TARGET, "delta": GOV_LOWER_TARGET - gr, **PILLAR_ACTIONS["governance_risk"]})

    feasible = not (gr >= 70 and abs(GOV_LOWER_TARGET - gr) > 40) and not (fr <= 20 and (RAISE_TARGET - fr) > 50)
    if not feasible:
        notes.append("Gaps are structurally too wide to close without redesigning the initiative. Scope a different use case rather than patching this one.")

    projected_sa = max(sa, RAISE_TARGET if sa < 60 else sa)
    projected_fr = max(fr, RAISE_TARGET if fr < 60 else fr)
    projected_ce = max(ce, RAISE_TARGET if ce < 60 else ce)
    projected_gr = min(gr, GOV_LOWER_TARGET if gr > 40 else gr)
    projected_confidence = _round((projected_sa + projected_fr + projected_ce + (100 - projected_gr)) / 4)
    projected_class = _classify(projected_sa, projected_fr, projected_ce, projected_gr)["label"]

    return {
        "current_classification": current,
        "target_classification": projected_class,
        "feasible": feasible,
        "recommendations": recs,
        "projected_confidence": projected_confidence,
        "notes": notes,
    }


def calculate_pace_layer_drag(*, revenue_eur: float, ai_tier: str, readiness: str, industry=None) -> dict:
    """Annual Organisational Drag Cost in EUR from pace-layer misalignment."""
    tier = PACE_DRAG_RATE.get(ai_tier)
    if tier is None:
        raise ValueError(f"Unknown ai_tier: {ai_tier}")
    rate = tier.get(readiness)
    if rate is None:
        raise ValueError(f"Unknown readiness: {readiness}")

    annual_drag_eur_low = _round(revenue_eur * rate["lo"])
    annual_drag_eur_high = _round(revenue_eur * rate["hi"])

    pace_gap = "minimal"
    if ai_tier == "gen3" and readiness != "agile":
        pace_gap = "severe"
    elif ai_tier == "gen2" and readiness == "siloed":
        pace_gap = "severe"
    elif readiness != "agile":
        pace_gap = "moderate"

    return {
        "annual_drag_eur_low": annual_drag_eur_low,
        "annual_drag_eur_high": annual_drag_eur_high,
        "drag_rate_low": rate["lo"],
        "drag_rate_high": rate["hi"],
        "pace_gap": pace_gap,
        "drivers": PACE_DRAG_DRIVERS[readiness],
        "source": PACE_DRAG_SOURCE,
    }
