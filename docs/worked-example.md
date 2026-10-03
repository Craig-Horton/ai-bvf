# Worked example: an AI decision that needs evidence

This synthetic healthcare example shows the current TypeScript scoring rules. It is a reproducible calculation, with no customer outcome or clinical validation claim.

An organisation with EUR 800M annual revenue is considering agentic discharge coordination. The example uses the healthcare industry, customer-experience function, gen3 tier and traditional readiness.

## First assessment

Assume a reviewer supplies these pillar scores after reviewing the proposal:

| Pillar | Value |
|---|---:|
| Strategic Alignment | 75 |
| Financial Return | 55 |
| Change Enablement | 40 |
| Governance Risk | 55 |

No work architecture checks are supplied. The result is **Fix**, with four unknown work architecture checks and a decision score of **54**.

```text
round((75 + 55 + 40 + (100 - 55)) / 4) = 54
```

All four pillars are supplied, so the default input-completeness multiplier is 1. The score describes those inputs and does not estimate the probability of success.

## Planning benefit calculation

The disclosed planning assumptions are:

```text
cx revenue rate: 0.02 to 0.05
cx cost rate: 0.02 to 0.05
healthcare / cx multiplier: 1.1
gen3 multiplier: 1.35
traditional readiness capture: 0.50 to 0.70

gross_low  = round(800,000,000 * 0.04 * 1.1 * 1.35) = 47,520,000
gross_high = round(800,000,000 * 0.10 * 1.1 * 1.35) = 118,800,000
net_low    = round(47,520,000 * 0.50)               = 23,760,000
net_high   = round(118,800,000 * 0.70)              = 83,160,000
```

The API's `net_low_eur` and `net_high_eur` fields therefore return EUR 23.76M to EUR 83.16M of readiness-adjusted planning benefit. Delivery costs, operating costs, change costs, margins and financial timing have not been deducted or modelled.

This large revenue-based scenario requires replacement with measured process volumes and unit economics before funding. The healthcare module labels in the response do not validate the clinical use case or determine its legal classification.

## Turn the assessment into an owned action

An illustrative action record for the team is:

| Item | Proposed next step |
|---|---|
| Financial case | Finance owner measures addressable discharge-coordination work and costs the delivery and recurring operation. |
| Change work | Operations owner documents capacity, training and changed accountabilities. |
| Governance | Relevant clinical and governance owners review intended use, data, oversight and applicable obligations. |
| Work architecture | Workflow owner records the redesigned workflow, roles, human decision rights and performance measures. |
| Re-score point | Review those records together before changing the pillar scores or the four work checks. |

Owners and dates must be assigned by the team. Completing an action does not mechanically award the engine's target score.

## Re-score the evidence

If the supplied pillars become SA 75, FR 65, CE 65 and GR 35, the decision score becomes 68. The result remains **Fix** while the work architecture checks are missing.

Only when all four work checks are also supplied as evidenced true does this example return **Accelerate**. This is a conditional model result; the organisation still owns the funding decision and the verification of its evidence.

| Stage | Pillars, SA / FR / CE / GR | Work architecture | Verdict | Decision score |
|---|---|---|---|---:|
| Initial review | 75 / 55 / 40 / 55 | Four unknown checks | Fix | 54 |
| Pillars strengthened | 75 / 65 / 65 / 35 | Four unknown checks | Fix | 68 |
| Work changes evidenced | 75 / 65 / 65 / 35 | Four checks met | Accelerate | 68 |

The modelled benefit range stays the same across these three stages because the revenue, function, industry, tier and readiness inputs remain the same. This demonstrates why the benefit range needs a separate costed business case.

## Run the example against the built source

From a checkout of this repository, run `npm ci` and `npm run build`. Save the following block as `worked-example.mjs` in the repository root, then run `node worked-example.mjs`:

```js
import assert from 'node:assert/strict';
import { score, calculatePaceLayerDrag } from './packages/js/dist/index.js';

const initial = {
  industry: 'healthcare',
  revenue_eur: 800_000_000,
  function: 'cx',
  ai_tier: 'gen3',
  readiness: 'traditional',
  scores: {
    strategic_alignment: 75,
    financial_return: 55,
    change_enablement: 40,
    governance_risk: 55,
  },
};
const stronger = {
  ...initial,
  scores: {
    strategic_alignment: 75,
    financial_return: 65,
    change_enablement: 65,
    governance_risk: 35,
  },
};
const evidenced = {
  ...stronger,
  work_architecture: {
    workflow_redesigned: true,
    roles_redesigned: true,
    decision_rights_defined: true,
    measures_updated: true,
  },
};

const stages = [initial, stronger, evidenced].map(score);
assert.deepEqual(stages.map(r => r.classification), ['Fix', 'Fix', 'Accelerate']);
assert.deepEqual(stages.map(r => r.confidence), [54, 68, 68]);
assert.deepEqual(stages.map(r => r.work_architecture.status), ['unknown', 'unknown', 'ready']);
assert.equal(stages[0].work_architecture.unknowns.length, 4);
for (const result of stages) {
  assert.equal(result.gross_low_eur, 47_520_000);
  assert.equal(result.gross_high_eur, 118_800_000);
  assert.equal(result.net_low_eur, 23_760_000);
  assert.equal(result.net_high_eur, 83_160_000);
  assert.ok(result.audit);
  assert.ok(result.sensitivity);
}
const drag = calculatePaceLayerDrag({
  revenue_eur: initial.revenue_eur,
  ai_tier: initial.ai_tier,
  readiness: initial.readiness,
});
assert.equal(drag.annual_drag_eur_low, 20_000_000);
assert.equal(drag.annual_drag_eur_high, 36_000_000);
console.table(stages.map(r => ({
  verdict: r.classification,
  decision_score: r.confidence,
  work_architecture: r.work_architecture.status,
  planning_benefit_low_eur: r.net_low_eur,
  planning_benefit_high_eur: r.net_high_eur,
})));
console.log('Worked-example assertions passed.');
```

The arithmetic and conditions above were checked against source when this example was revised. Running the assertions verifies them against the exact code in a checkout.

## Keep the drag scenario separate

For gen3 and traditional readiness, the drag model applies 2.5% to 4.5% of revenue, producing EUR 20M to EUR 36M. These are AI BVF planning rates with no measured organisation-specific cost basis in this example.

Do not automatically subtract that range from readiness-adjusted planning benefit. Establish its distinct cost basis and check for overlap with the capture adjustment before including it in an investment model.
