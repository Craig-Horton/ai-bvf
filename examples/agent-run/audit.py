"""Audit a recorded agent run: every call in evidence mode, every quote found word for word in the files the agent was allowed to read."""
import json, os, re, sys
run, corpus_dirs = sys.argv[1], sys.argv[2:]
norm = lambda t: re.sub(r'\s+', ' ', t).strip()
# An answer carries one quote, or a list of up to three when it rests on more than one document.
quotes_of = lambda ev: [] if not ev else ev if isinstance(ev, list) else [ev]
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
        if ans != 'unknown' and not quotes_of((a.get('evidence') or {}).get(q)):
            problems.append(f'call {i}: answer {q}={ans} with no evidence')
    quoted = [(q, ev) for q, given in (a.get('evidence') or {}).items() for ev in quotes_of(given)]
    if (a.get('review') or {}).get('evidence'):
        quoted.append(('review', a['review']['evidence']))
    for q, ev in quoted:
        quote = norm(ev.get('quote', ''))
        hits = [name for name, text in corpus.items() if quote and quote in text]
        if not hits:
            problems.append(f'call {i}: quote for {q} not found word for word: "{quote[:90]}"')
    finals[norm(a['proposal'])[:70]] = (i, r, a)
print(f'{len(rows)} calls, {len(finals)} initiatives')
for key, (i, r, a) in finals.items():
    print(f'\n- {key}...')
    print(f'  last call {i}: status {r.get("status")}, verdict {r.get("classification")}')
    for q, ans in (a.get('answers') or {}).items():
        print(f'    {q}: {ans}')
        for ev in quotes_of((a.get('evidence') or {}).get(q)):
            print(f'      <- "{norm(ev["quote"])[:110]}" [{ev["source"]}]')
    if a.get('review'):
        review = a['review']
        print(f'    review: was {review.get("previous_verdict")}, then {review.get("outcome")}')
print('\nPROBLEMS:' if problems else '\nNo problems: every call in evidence mode, every answer quoted, every quote found word for word.')
for p in problems: print(' -', p)
