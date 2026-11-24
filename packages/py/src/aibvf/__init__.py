"""AI BVF v1.0 — open protocol for scoring AI investments."""

from .validate import validate
from .score import (
    score,
    recommend_improvements,
    calculate_pace_layer_drag,
    estimate_pillars,
    resolve_pillars,
    assess_work_architecture,
    BASE_RATES, BENCHMARK_EVIDENCE_REGISTER, IND_MULT, TIER_ADJ, READINESS_CAPTURE, PACE_DRAG_RATE,
)
from .taxonomy import INDUSTRIES, FUNCTIONS, AI_TIERS, READINESS
from .schema import load_schema

BVF_VERSION = "1.0"

__all__ = [
    "validate",
    "score",
    "recommend_improvements",
    "calculate_pace_layer_drag",
    "estimate_pillars",
    "resolve_pillars",
    "assess_work_architecture",
    "BASE_RATES",
    "BENCHMARK_EVIDENCE_REGISTER",
    "IND_MULT",
    "TIER_ADJ",
    "READINESS_CAPTURE",
    "PACE_DRAG_RATE",
    "INDUSTRIES",
    "FUNCTIONS",
    "AI_TIERS",
    "READINESS",
    "load_schema",
    "BVF_VERSION",
]
