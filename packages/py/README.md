# aibvf

AI BVF v1.0 — open protocol for scoring AI investments. Python implementation.

> **Source:** [github.com/Craig-Horton/ai-bvf](https://github.com/Craig-Horton/ai-bvf) · ⭐ star if this helped · [Issues](https://github.com/Craig-Horton/ai-bvf/issues) · A personal project by [Craig Horton](https://linkedin.com/in/Craig-Horton-ai), built in his own time

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
print(r['net_low_eur'])      # ~75.6M
print(r['net_high_eur'])     # ~247M
```

## Spec

Full specification at <https://www.aibvf.com/protocol>.

## License

MIT. Underlying specification is CC-BY-4.0.
