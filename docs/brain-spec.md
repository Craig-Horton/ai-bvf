# AI BVF Advisor Brain — Specification v0.1 (DRAFT)

> **Status:** design blueprint. Not wired to any package, tool, or CI path.
> Nothing here changes `@aibvf/core`, the MCP tools, the schema, or anything
> published. This is the vendor-neutral *judgment layer* — the part no
> incumbent can copy because their commercial model forbids neutrality.

## 0. What the Brain is

The shipped kernel (`@aibvf/core`) scores an **initiative you hand it**: a human
supplies four pillar scores, it returns €value + Stop/Fix/Accelerate.

The Brain inverts that. It **observes a process** — from digital exhaust, not a
form — and answers, unprompted:

> *"This process in {function} is too heavy. It costs you €{baseline}/yr. Do
> {intervention} and you'd save €{low}–{high}/yr and cut cycle time {Y}%.
> Confidence {Z}. Want me to get it done?"*

The kernel takes judgment *as input*. The Brain *produces* the judgment. Same
deterministic spine, pushed one layer earlier in the decision.

## 1. Design invariants (the moat, non-negotiable)

1. **Deterministic core.** Given the same signals, the Brain returns the same
   number, every time, traceably. The LLM only *extracts signals* and *narrates*;
   it never invents the savings figure. This is exactly why Glama graded the
   tools A — don't dissolve it into a generative guess.
2. **Vendor-neutral inputs.** Signals are defined independently of any source
   system. A ServiceNow ticket, a SAP event log, and a CSV produce the *same*
   signal shape. The Brain never recommends "buy more of platform X."
3. **No naked numbers.** Every euro figure ships with its baseline, its
   assumptions, and a confidence score. A figure without its assumptions is a
   toy; a figure traceable to measured spend is something a CFO signs.
4. **Directional, not audited.** Like the pace-layer diagnostic, the Brain is a
   decision aid, not a GL entry. It says so, every time.

## 2. Input contract — `ProcessSignals` (source-agnostic)

What the agent extracts from exhaust, per process. Every field is observable;
none requires a human to "describe the process."

| Field | Type | Meaning | Typical source |
|---|---|---|---|
| `process_id` | string | stable id | any |
| `function` | `FunctionId` | finance \| hr \| sales \| supply \| cx \| risk \| it \| rd (reuses kernel) | classifier |
| `instances_per_year` | number | volume `N` | ticket/transaction count |
| `fte_hours_per_instance` | number | human touch-time per run | task mining / time logs |
| `loaded_hourly_rate_eur` | number | fully-loaded labour cost/hr | HRIS / finance |
| `cycle_time_days` | number | median wall-clock per instance | timestamps |
| `touch_ratio` | 0–1 | touch-time ÷ cycle-time (rest is wait) | timestamps |
| `handoffs` | number | distinct owners/systems per instance | event log |
| `rework_rate` | 0–1 | fraction reopened/reworked | reopen flags |
| `automation_level` | 0–1 | share already automated | tooling telemetry |
| `direct_spend_eur` | number | annual licence/vendor/tooling € on this process | spend ledger |
| `signal_completeness` | 0–1 | how much of the above was actually measured vs defaulted | the agent itself |

`signal_completeness` is load-bearing: it is the honest governor on confidence.
A process scored from 3 of 12 fields cannot return high confidence, by
construction.

## 3. The four deterministic models

### 3.1 Baseline cost — "your current spend"

```
labour_cost      = instances_per_year × fte_hours_per_instance × loaded_hourly_rate_eur
baseline_cost_eur = labour_cost + direct_spend_eur
```

This is the anchor every saving is expressed *against*. No baseline → no number.

### 3.2 Heaviness index — "too heavy" made measurable

A 0–100 index from normalised friction signals, each scored against a
per-function benchmark band (see §6, currently DRAFT bands awaiting calibration):

```
heaviness = 100 × weighted_mean(
  cycle_penalty,      // cycle_time_days vs function median
  handoff_penalty,    // handoffs vs function median
  rework_rate,        // direct
  manual_penalty,     // 1 − automation_level
  wait_penalty        // 1 − touch_ratio
)
```

Output includes a **drag decomposition** — which factor carries the weight
(rework vs handoffs vs manual touch vs wait). That decomposition *is* the
diagnosis; it tells the intervention model where to aim.

### 3.3 Intervention selector — "do ZYX"

Deterministic mapping from the dominant drag factor to a move, each with an
`addressable_fraction` (share of baseline it can touch) and an `effectiveness`
band (how much of that it removes):

| Dominant drag | Intervention | Addressable | Effectiveness band |
|---|---|---|---|
| low automation + high manual touch | **Automate** (agentic / RPA) | labour portion | 0.30–0.50 |
| high handoffs / fragmentation | **Consolidate & re-sequence** | labour + cycle | 0.20–0.40 |
| high rework | **Quality controls / validation-in-loop** | rework portion | 0.40–0.70 |
| low value, high cost, low volume | **Eliminate / insource** | full baseline | 0.60–0.90 |

Bands are ranges, not points — they produce the low/high savings spread.

**Order of the rules (from `@aibvf/core` 0.14.0).** The first rule that fits chooses the intervention:

1. Rare and heavy: under 250 instances a year and heaviness of 50 or more. Eliminate / insource.
2. Comes back: `rework_rate` of 0.30 or more. Quality controls.
3. Short and repeated: `fte_hours_per_instance` of 0.25 or less, `handoffs` of 1 or less, 1,000 instances a year or more. Automate.
4. Otherwise the dominant drag factor, as in the table above.

Rules 2 and 3 exist because waiting is the dominant drag factor in almost every log of cases. Without them a six-minute task done three thousand times a year is sent to a flow redesign. The three thresholds are Craig Horton's judgement of 21 November 2026. They are not taken from a benchmark. The verdict's `assumptions` names the rule that chose.

### 3.4 Savings quantifier — the number, traceable

```
gross_saving = baseline_cost × addressable_fraction × effectiveness
net_saving   = gross_saving × capture_rate(readiness)      // reuses READINESS_CAPTURE
efficiency_gain_pct = f(intervention, automation_delta, cycle_delta)
```

`capture_rate` reuses the kernel's readiness bands verbatim — agile 0.85–1.00,
traditional 0.50–0.70, siloed 0.25–0.40 — because an organisation that *can't
absorb change* doesn't realise the gross saving, and pretending otherwise is the
single most common business-case lie.

Output: `net_saving_low_eur … net_saving_high_eur`, `efficiency_gain_pct`,
expressed *against* `baseline_cost_eur`.

## 4. Verdict + confidence

**Verdict** (about the *intervention*, mirroring the kernel's vocabulary):

- **Accelerate** — strong net saving, low execution risk, confidence high → *"want me to get it done?"*
- **Fix** — real saving but a prerequisite gates it (data quality, change capacity, governance) → fix the prerequisite first.
- **Stop** — saving too thin to justify disruption, *or* risk structurally too high → don't.

**Decision confidence** (0–1), deterministic:

```
confidence = weighted_mean(
  signal_completeness,        // did we actually measure it?
  intervention_evidence,      // how proven is this move for this function?
  benchmark_fit               // how close is this process to the calibrated band?
)
```

Confidence is reported with the **assumptions** that drove it, always. Example:
`€1.8M ± 0.4M · 22% cycle cut · confidence 0.68 · assumes [loaded rate €65/hr], [rework measured on 6mo window], [agile capture]`.

## 5. Output contract — `BrainVerdict`

```jsonc
{
  "process_id": "hr-onboarding",
  "function": "hr",
  "baseline_cost_eur": 2_140_000,
  "heaviness": 74,
  "drag_decomposition": { "manual": 0.41, "handoffs": 0.28, "wait": 0.19, "rework": 0.12 },
  "intervention": "Automate (agentic): pre-fill + validate onboarding packet across the 4 systems it currently touches by hand",
  "net_saving_low_eur": 430_000,
  "net_saving_high_eur": 690_000,
  "efficiency_gain_pct": 22,
  "verdict": "Accelerate",
  "decision_confidence": 0.68,
  "assumptions": ["loaded rate €65/hr", "rework from 6-mo reopen window", "agile capture band"],
  "offer_to_execute": true,
  "disclaimer": "Directional decision aid, not an audited figure."
}
```

This object **is** the sales artifact and the agent's proposal in one. Render it
as the one-pager; gate `offer_to_execute` behind human approval.

## 6. Open calibration (intellectual honesty)

- **Per-function heaviness bands (§3.2) are DRAFT.** They need grounding in real
  process-mining distributions (Celonis/Signavio public benchmarks, APQC) before
  any figure is shown to a paying client. Until then the Brain runs in
  *advisory-only* mode and says so.
- **Effectiveness bands (§3.3)** should disclose their evidence status the way `BASE_RATES` already
  are (McKinsey/Gartner/BCG/Deloitte/Forrester) and cited inline.
- **`intervention_evidence`** needs a small evidence table per (function ×
  intervention). That table is the next concrete build.

## 7. Why this is uncopyable

ServiceNow can perceive-and-execute, but only inside its walls and only to sell
more ServiceNow. McKinsey has the judgment, but as a €€€ episodic engagement.
Celonis quantifies, but pulls your data into Celonis. The Brain is the **neutral
judgment layer** — MCP-native, in-tenant, source-agnostic — that the analyst
landscape (Kai Waehner, 2026) explicitly calls *empty*: "no vendor offers a
complete neutral advisory layer." This spec is the claim to that quadrant.

---
*v0.1 — design blueprint. Reuses `FunctionId` and `READINESS_CAPTURE` from
`@aibvf/core`. No runtime dependency yet. Next: calibrate §6, then a reference
implementation behind a new `diagnose_process` surface.*
