# @aibvf/core

Deterministic AI investment assessment with disclosed assumptions, evidence gaps and work design checks. The public portfolio format is version 1.0.

> **Source:** [github.com/Craig-Horton/ai-bvf](https://github.com/Craig-Horton/ai-bvf) · [Try an assessment](https://www.aibvf.com/start) · [Issues](https://github.com/Craig-Horton/ai-bvf/issues) · Built by [Craig Horton Advisory](https://craighortonadvisory.com)

```bash
npm install @aibvf/core
```

## Validate a portfolio

```ts
import { validate } from '@aibvf/core';

const result = validate(portfolioJson);
if (!result.valid) console.error(result.errors);
```

## Score an initiative

```ts
import { score } from '@aibvf/core';

const r = score({
  industry: 'manufacturing',
  revenue_eur: 2_400_000_000,
  function: 'supply',
  ai_tier: 'gen2',
  readiness: 'traditional',
  scores: {
    strategic_alignment: 72,
    financial_return: 64,
    change_enablement: 48,
    governance_risk: 35,
  },
  work_architecture: {
    workflow_redesigned: true,
    roles_redesigned: false,
    decision_rights_defined: true,
    measures_updated: false,
  },
});

console.log(r.classification);   // 'Fix'
console.log(r.work_architecture.gaps); // roles and measures still need redesign
console.log(r.net_low_eur);      // ~75.6M
console.log(r.net_high_eur);     // ~247M
```

The work architecture fields are optional inputs and accept only evidence the organisation has. An explicit `false` value or an omitted check holds an otherwise green initiative at Fix, while the response names each gap or unknown and returns the next question to ask. Accelerate requires all four checks to be evidenced as complete.

## Reading the result

The fields `net_low_eur` and `net_high_eur` are readiness-adjusted benefit scenarios before project build, operating and change costs. They require a separate costed business case.

The `confidence` field is a heuristic score derived from pillar inputs and input completeness, with no calibrated probability interpretation. Sector labels in `applied_modules` identify model context and do not certify regulatory compliance.

[Formulas and assumptions](https://github.com/Craig-Horton/ai-bvf/blob/main/docs/scoring-formulas.md) · [Reproducible example](https://github.com/Craig-Horton/ai-bvf/blob/main/docs/worked-example.md)

## Spec

Full specification at [www.aibvf.com/protocol](https://www.aibvf.com/protocol).
JSON Schema at [www.aibvf.com/bvf-protocol.schema.json](https://www.aibvf.com/bvf-protocol.schema.json).

## License

MIT. The underlying specification is CC-BY-4.0.
