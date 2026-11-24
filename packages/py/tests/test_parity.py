"""The Python engine against the TypeScript engine, case by case.

spec/parity-vectors.json holds the results of @aibvf/core, the engine behind the
AI BVF connector, on a few thousand inputs. This test runs the same inputs
through the Python package and fails on any difference: verdict, wording, euros
or score. Run it from the repository root:

    python -m unittest discover -s packages/py/tests -v
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages" / "py" / "src"))

import aibvf  # noqa: E402

PILLARS = ("strategic_alignment", "financial_return", "change_enablement", "governance_risk")
VECTORS = json.loads((ROOT / "spec" / "parity-vectors.json").read_text(encoding="utf-8"))


def score_result(r: dict) -> list:
    signal = r["signal_completeness"]
    return [
        r["classification"], r["reason"], [r["gross_low_eur"], r["gross_high_eur"], r["net_low_eur"], r["net_high_eur"]], r["confidence"],
        [r["scores_used"][pillar] for pillar in PILLARS], "".join(r["pillar_basis"][pillar][0] for pillar in PILLARS),
        [signal["used"], signal["supported"], signal.get("given")], r["work_architecture"]["status"], len(r["applied_modules"]), r.get("caveat"),
    ]


def recommend_result(r: dict) -> list:
    return [
        r["current_classification"], r["target_classification"], r["feasible"], r["projected_confidence"], r["notes"],
        [[rec["pillar"], rec["current"], rec["target"], rec["delta"]] for rec in r["recommendations"]],
    ]


def drag_result(r: dict) -> list:
    return [[r["annual_drag_eur_low"], r["annual_drag_eur_high"]], [r["drag_rate_low"], r["drag_rate_high"]], r["pace_gap"]]


class Parity(unittest.TestCase):
    def compare(self, name, run, shape):
        cases = VECTORS[name]
        self.assertGreater(len(cases), 50, name)
        differences = []
        for given, expected in cases:
            got = shape(run(**given))
            if got != expected:
                differences.append((given, expected, got))
        first = "" if not differences else "\nfirst difference:\n  input    %s\n  expected %s\n  got      %s" % tuple(json.dumps(part) for part in differences[0])
        self.assertEqual(len(differences), 0, f"{name}: {len(differences)} of {len(cases)} cases differ from the TypeScript engine.{first}")

    def test_score(self):
        self.compare("score", aibvf.score, score_result)

    def test_recommend_improvements(self):
        self.compare("recommend_improvements", aibvf.recommend_improvements, recommend_result)

    def test_calculate_pace_layer_drag(self):
        self.compare("calculate_pace_layer_drag", aibvf.calculate_pace_layer_drag, drag_result)

    def test_enough_cases(self):
        self.assertGreaterEqual(sum(len(VECTORS[name]) for name in ("score", "recommend_improvements", "calculate_pace_layer_drag")), 2000)

    def test_a_half_rounds_up_and_euros_are_whole(self):
        from aibvf.score import _round
        self.assertEqual([_round(22.5), _round(23.5), _round(0.49999999999999994), _round(2.4999)], [23, 24, 0, 2])
        result = aibvf.score(industry="retail", revenue_eur=8_400_000.5, function="cx", ai_tier="gen2", readiness="traditional")
        for key in ("gross_low_eur", "gross_high_eur", "net_low_eur", "net_high_eur"):
            self.assertIsInstance(result[key], int, key)

    def test_unknown_values_are_refused(self):
        context = dict(industry="retail", revenue_eur=1_000_000, function="cx", ai_tier="gen2", readiness="traditional")
        for field, value in (("industry", "banking"), ("function", "marketing"), ("ai_tier", "gen4"), ("readiness", "keen")):
            with self.assertRaises(ValueError, msg=field):
                aibvf.score(**{**context, field: value})

    def test_no_accelerate_without_the_work_design(self):
        context = dict(industry="retail", revenue_eur=1_000_000, function="cx", ai_tier="gen2", readiness="traditional",
                       scores=dict(strategic_alignment=80, financial_return=80, change_enablement=80, governance_risk=20))
        self.assertEqual(aibvf.score(**context)["classification"], "Fix")
        ready = dict(workflow_redesigned=True, roles_redesigned=True, decision_rights_defined=True, measures_updated=True)
        self.assertEqual(aibvf.score(**context, work_architecture=ready)["classification"], "Accelerate")


if __name__ == "__main__":
    unittest.main()
