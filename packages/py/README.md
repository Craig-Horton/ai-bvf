# aibvf

AI BVF v1.0, an open protocol for scoring AI investments. Python implementation.

> **Source:** [github.com/Craig-Horton/ai-bvf](https://github.com/Craig-Horton/ai-bvf) · [Issues](https://github.com/Craig-Horton/ai-bvf/issues) · A personal project by [Craig Horton](https://linkedin.com/in/Craig-Horton-ai), built in his own time

```bash
pip install aibvf
```

## Validate a portfolio

```python
from aibvf import validate
import json

portfolio = json.load(open('my-portfolio.json'))
result = validate(portfolio)
if not result['valid']:
    for err in result['errors']:
        print(f"{err['path']}: {err['msg']}")
```

## Score an initiative

```python
from aibvf import score

r = score(
    industry='manufacturing',
    revenue_eur=2_400_000_000,
    function='supply',
    ai_tier='gen2',
    readiness='traditional',
    scores={
        'strategic_alignment': 72,
        'financial_return': 64,
        'change_enablement': 48,
        'governance_risk': 35,
    },
)

print(r['classification'])   # 'Fix'
print(r['net_low_eur'])      # 75600000
print(r['net_high_eur'])     # 246960000
```

Each pillar is optional. A pillar you leave out is estimated, and `pillar_basis` says which ones were. A pillar is a number, or `{"value": 64, "confidence": 40, "basis": "estimated"}`. A pillar marked estimated is never counted as given.

## An Accelerate needs the work design

Four pillars above their thresholds are not enough. The work around the AI has to be redesigned, and that has to be evidenced. Without `work_architecture` the verdict is Fix.

```python
r = score(
    industry='manufacturing', revenue_eur=2_400_000_000, function='supply',
    ai_tier='gen2', readiness='traditional',
    scores={'strategic_alignment': 72, 'financial_return': 64, 'change_enablement': 66, 'governance_risk': 35},
    work_architecture={
        'workflow_redesigned': True,
        'roles_redesigned': True,
        'decision_rights_defined': True,
        'measures_updated': True,
    },
)
print(r['classification'])   # 'Accelerate'
```

## The same answers as the connector

The AI BVF connector runs the TypeScript engine, `@aibvf/core`. This package is a second copy of the same rules. Both are tested in CI against one file of 2,470 expected results, [`spec/parity-vectors.json`](https://github.com/Craig-Horton/ai-bvf/blob/main/spec/parity-vectors.json): the same inputs give the same verdict, the same score and the same euros.

Until version 0.3.0 they differed. This package had no work-design check, rounded a half to the nearest even number and left euros unrounded, so it could return Accelerate where the connector returned Fix. Version 0.3.0 closes that.

What this package covers: `validate`, `score`, `recommend_improvements` and `calculate_pace_layer_drag`. The guided assessment, the portfolio tools, the change plan and the audit record are in the TypeScript engine and the connector only.

## Changes in 0.3.0 that can alter a result

- An Accelerate now needs `work_architecture` with all four checks met.
- Euro figures are whole numbers.
- A score that lands on a half rounds up: 22.5 gives 23.
- `scores` is optional, and so is each pillar in it. Missing pillars are estimated and lower the score.
- `signal_completeness` is an upper limit: it can lower the score and cannot raise it.
- An unknown industry is refused. Before, it was read as `universal`.

## Spec

Full specification at <https://www.aibvf.com/protocol>.

## License

MIT. Underlying specification is CC-BY-4.0.
