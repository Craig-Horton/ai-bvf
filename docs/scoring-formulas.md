# AI BVF scoring formulas

The TypeScript scoring path is deterministic and makes no network calls. The MCP wrapper has separate optional usage telemetry, documented in the [README](../README.md#anonymous-usage-telemetry).

This page describes the implementation in [score.ts](../packages/js/src/score.ts) and [workArchitecture.ts](../packages/js/src/workArchitecture.ts). Protocol 1.0 identifies the portfolio document format; the engine package version identifies the scoring implementation.

## Pillars and provenance

Each pillar ranges from 0 to 100:

| Pillar | Question |
|---|---|
| Strategic Alignment, SA | How clearly does the initiative support a named organisational outcome? |
| Financial Return, FR | How well does the evidence support the investment case? |
| Change Enablement, CE | Are the owner, capacity and change work in place? |
| Governance Risk, GR | What regulatory and operational exposure remains? Higher means more risk. |

Supplied numeric values are marked `given` in `pillar_basis`. This records input provenance; it does not verify the underlying evidence.

Missing pillars are filled with deterministic planning priors. SA defaults to 50; FR depends on the function's planning range; CE depends on readiness; GR depends on AI tier and regulated context. The response identifies every estimated pillar.

## Classification and the work architecture gate

The pillar rules run in this order:

```text
GR >= 70 or FR <= 20                            -> Stop
SA >= 60 and FR >= 60 and CE >= 60 and GR <= 40  -> provisional Accelerate
all other combinations                        -> Fix
```

The engine then applies the work architecture gate. Accelerate requires all four checks to be supplied as true:

- `workflow_redesigned`: the end-to-end workflow has been redesigned.
- `roles_redesigned`: affected roles and accountabilities have been redesigned.
- `decision_rights_defined`: human decision, override and escalation rights are defined.
- `measures_updated`: performance measures support the changed work.

An explicit false value is a gap. An omitted check is unknown; partial, unknown and gap states all block Accelerate and produce Fix when the pillars otherwise clear. A Stop remains Stop.

The engine consumes these declarations and records their status. The accountable team must inspect the evidence supporting each declaration.

## Decision score

Compatibility fields named `confidence`, `decision_confidence` and `projected_confidence` contain a rule-based decision score. The score has no calibrated interpretation as a probability that the verdict is correct or that the investment will succeed.

For `score()`, the calculation is:

```text
base = (SA + FR + CE + (100 - GR)) / 4
default_signal = 0.5 + 0.125 * number_of_given_pillars
signal = clamp(explicit_signal_completeness ?? default_signal, 0, 1)
confidence = round(base * (0.5 + 0.5 * signal))
```

With four supplied pillars, the default signal is 1. With no supplied pillars, it is 0.5, giving a 0.75 multiplier on the base score. The output adds an input-quality caveat when signal is below 0.7 and identifies estimated pillars.

A high pillar average can coexist with an unresolved work architecture gate. Read the verdict, evidence status and score together.

## Planning benefit and the legacy net fields

The scorer computes a revenue-based planning scenario:

```text
gross_low  = round(revenue_eur * (rev.lo + cost.lo) * industry_mult * tier_adj)
gross_high = round(revenue_eur * (rev.hi + cost.hi) * industry_mult * tier_adj)
net_low    = round(gross_low  * readiness_capture.low)
net_high   = round(gross_high * readiness_capture.high)
```

The existing `net_low_eur`, `net_high_eur` and MCP `net_value_eur` names are retained for API compatibility. Their meaning is readiness-adjusted planning benefit.

| Input | Implementation |
|---|---|
| Function rates | `BASE_RATES[function]`, AI BVF planning assumptions expressed as fractions of annual revenue. |
| Industry multiplier | `IND_MULT[industry][function]`, a directional model assumption. |
| Tier adjustment | gen1: 0.55; gen2: 1.00; gen3: 1.35. |
| Readiness capture | agile: 0.85 to 1.00; traditional: 0.50 to 0.70; siloed: 0.25 to 0.40. |

The calculation has no project-cost deduction, investment schedule, discount rate, revenue-margin conversion or check for overlap between initiatives. It therefore supplies an initial scenario that needs a separate business case.

For a funding decision, build that case from measured baseline, addressable volume, unit economics, delivery cost, recurring operating cost, change cost and an explicit capture schedule. Reconcile shared benefits across initiatives before using portfolio totals.

## Pace-layer scenario

```text
annual_drag_low  = round(revenue_eur * PACE_DRAG_RATE[ai_tier][readiness].lo)
annual_drag_high = round(revenue_eur * PACE_DRAG_RATE[ai_tier][readiness].hi)
```

These directional AI BVF rates range from 0.1% to 8% of annual revenue. The output is a planning scenario for operating-model friction; external research does not publish or validate these rates.

Keep this scenario separate from the readiness-adjusted benefit calculation. Subtracting it automatically would require evidence that it measures a distinct cost and does not duplicate the readiness capture adjustment.

## Improvement plans and re-scoring

The recommendation engine proposes a target of 65 for SA, FR or CE below 60, and a target of 35 for GR above 40. These are proposed evidence positions to work towards, rather than automatic score increases after completing a task.

`projected_confidence` is the pillar average at the proposed targets. Treat it as a scenario and run `score()` again with the evidence, input completeness and work architecture checks that actually exist.

For pillar inputs in the documented 0 to 100 range, the current `feasible` heuristic rejects GR above 75 or FR below 15. This heuristic does not evaluate implementation cost, capacity or a team's ability to deliver the plan.

The work architecture must still clear before Accelerate. A projected target in an improvement response does not replace the final assessment.

## Audit, sensitivity and module labels

The audit records model rules and inputs used for the calculation. Sensitivity reports selected changes to readiness, revenue and pillar thresholds; it does not establish a statistical confidence interval.

`applied_modules` contains implementation labels selected by industry, function and readiness. Labels such as `healthcare_clinical_validation`, `healthcare_hipaa_module` and `financial_dora_module` identify context and do not run a clinical evaluation or legal compliance certification.

## Evidence and rights

The model's evidence register links external research and states its limits. Those studies inform the diagnostic questions; AI BVF's function rates, industry multipliers, readiness capture percentages and drag rates remain disclosed model assumptions.

[LICENSE](../LICENSE) governs repository source code, and [NOTICE](../NOTICE) sets out the specification and trademark exceptions. See [contribution boundaries](../CONTRIBUTING.md#licensing-and-contribution-boundaries) before submitting separately licensed material.
