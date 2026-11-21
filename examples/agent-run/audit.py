"""Audit a recorded agent run: every call in evidence mode, every quote found word for word in the files the agent was allowed to read."""
import json, os, re, sys
run, corpus_dirs = sys.argv[1], sys.argv[2:]
norm = lambda t: re.sub(r'\s+', ' ', t).strip()
corpus = {}
for d in corpus_dirs:
    for root, _, files in os.walk(d):
        for f in files:
            path = os.path.join(root, f)
            corpus[os.path.relpath(path, d)] = norm(open(path, encoding='utf-8').read())
rows = [json.loads(l) for l in open(os.path.join(run, 'calls.jsonl'))]
problems, finals = [], {}
for i, r in enumerate(rows, 1):
    a = r['args']
    if r['tool'] != 'assess_ai_initiative':
        continue
    if a.get('answered_by') != 'evidence':
        problems.append(f'call {i}: not in evidence mode')
    if a.get('scores'):
        problems.append(f'call {i}: passed numeric scores')
    for q, ans in (a.get('answers') or {}).items():
        ev = (a.get('evidence') or {}).get(q)
        if ans != 'unknown' and not ev:
            problems.append(f'call {i}: answer {q}={ans} with no evidence')
    for q, ev in (a.get('evidence') or {}).items():
        quote = norm(ev.get('quote', ''))
        hits = [name for name, text in corpus.items() if quote and quote in text]
        if not hits:
            problems.append(f'call {i}: quote for {q} not found word for word: "{quote[:90]}"')
    finals[norm(a['proposal'])[:70]] = (i, r, a)
print(f'{len(rows)} calls, {len(finals)} initiatives')
for key, (i, r, a) in finals.items():
    print(f'\n- {key}...')
    print(f'  last call {i}: status {r.get("status")}, verdict {r.get("classification")}, context: {a.get("industry")}/{a.get("function")}/{a.get("ai_tier")}/{a.get("employees")}')
    for q, ans in (a.get('answers') or {}).items():
        ev = (a.get('evidence') or {}).get(q)
        print(f'    {q}: {ans}' + (f' <- "{norm(ev["quote"])[:110]}" [{ev["source"]}]' if ev else ''))
    if a.get('review'):
        print('    review:', json.dumps(a['review'])[:300])
print('\nPROBLEMS:' if problems else '\nNo problems: every call in evidence mode, every answer quoted, every quote found word for word.')
for p in problems: print(' -', p)
