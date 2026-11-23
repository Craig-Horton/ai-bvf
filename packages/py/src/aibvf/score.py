"""AI BVF v1.0 scoring engine. Deterministic, no dependencies."""
from __future__ import annotations

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


def score(*, industry: str, revenue_eur: float, function: str, ai_tier: str, readiness: str, scores: dict) -> dict:
    """Score an initiative according to AI BVF v1.0. Deterministic."""
    base = BASE_RATES.get(function)
    if base is None:
        raise ValueError(f"Unknown function: {function}")
    mult = IND_MULT.get(industry, IND_MULT["universal"]).get(function, 1.0)
    t_adj = TIER_ADJ.get(ai_tier)
    if t_adj is None:
        raise ValueError(f"Unknown ai_tier: {ai_tier}")
    cap = READINESS_CAPTURE.get(readiness)
    if cap is None:
        raise ValueError(f"Unknown readiness: {readiness}")

    sa = scores["strategic_alignment"]
    fr = scores["financial_return"]
    ce = scores["change_enablement"]
    gr = scores["governance_risk"]

    gross_lo = revenue_eur * (base["rev"]["lo"] + base["cost"]["lo"]) * mult * t_adj
    gross_hi = revenue_eur * (base["rev"]["hi"] + base["cost"]["hi"]) * mult * t_adj
    net_lo = gross_lo * cap["low"]
    net_hi = gross_hi * cap["high"]

    cls = _classify(sa, fr, ce, gr)
    confidence = round((sa + fr + ce + (100 - gr)) / 4)

    return {
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
        "applied_modules": _applied_modules(industry, function, readiness),
    }


def recommend_improvements(*, industry: str, revenue_eur: float, function: str, ai_tier: str, readiness: str, scores: dict) -> dict:
    """For Stop/Fix results, return pillar raises that would flip toward Accelerate."""
    sa = scores["strategic_alignment"]
    fr = scores["financial_return"]
    ce = scores["change_enablement"]
    gr = scores["governance_risk"]

    current = _classify(sa, fr, ce, gr)["label"]
    recs = []
    notes = []

    if current == "Accelerate":
        return {
            "current_classification": current,
            "target_classification": current,
            "feasible": True,
            "recommendations": [],
            "projected_confidence": round((sa + fr + ce + (100 - gr)) / 4),
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
    projected_confidence = round((projected_sa + projected_fr + projected_ce + (100 - projected_gr)) / 4)
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

    annual_drag_eur_low = revenue_eur * rate["lo"]
    annual_drag_eur_high = revenue_eur * rate["hi"]

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
