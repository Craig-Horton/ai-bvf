#!/usr/bin/env node
// One file of expected results that every AI BVF engine must reproduce.
//
//   node scripts/build-parity-vectors.mjs           writes spec/parity-vectors.json from the TypeScript engine
//   node scripts/build-parity-vectors.mjs --check   fails when the file is not what the engine gives today
//
// The TypeScript engine in @aibvf/core is the one the connector runs. The Python
// package is a second copy of the same rules. Before this file, nothing compared
// them: on the same inputs the Python package gave Accelerate where the engine
// gave Fix, rounded a half the other way and left the euros unrounded. Both are
// now tested against these cases in CI. Run `npm run build` first.
import { readFile, writeFile } from 'node:fs/promises';
import { score, recommendImprovements, calculatePaceLayerDrag, INDUSTRIES, FUNCTIONS, AI_TIERS, READINESS } from '../packages/js/dist/index.js';

const FILE = new URL('../spec/parity-vectors.json', import.meta.url);
const PILLARS = ['strategic_alignment', 'financial_return', 'change_enablement', 'governance_risk'];
const READY = { workflow_redesigned: true, roles_redesigned: true, decision_rights_defined: true, measures_updated: true };
const pillars = (sa, fr, ce, gr) => ({ strategic_alignment: sa, financial_return: fr, change_enablement: ce, governance_risk: gr });
const base = { industry: 'retail', revenue_eur: 500_000_000, function: 'cx', ai_tier: 'gen2', readiness: 'traditional' };

// What is compared, kept short because there are thousands of cases. Each result is a list, in this order.
//   score: verdict, reason, [gross low, gross high, net low, net high], score, the four pillars used,
//          where each pillar came from (g given, e estimated), [signal used, signal supported, signal given or null],
//          work design status, number of modules applied, caveat or null
//   recommend_improvements: verdict now, verdict after, feasible, projected score, notes, [pillar, current, target, delta] for each gap
//   calculate_pace_layer_drag: [drag low, drag high], [rate low, rate high], pace gap
const scoreResult = (r) => {
  const signal = r.audit.inputs_used.signal_completeness;
  return [
    r.classification, r.reason, [r.gross_low_eur, r.gross_high_eur, r.net_low_eur, r.net_high_eur], r.confidence,
    PILLARS.map((pillar) => r.scores_used[pillar]), PILLARS.map((pillar) => r.pillar_basis[pillar][0]).join(''),
    [signal.used, signal.supported, signal.given ?? null], r.work_architecture.status, r.applied_modules.length, r.caveat ?? null,
  ];
};
const recommendResult = (r) => [
  r.current_classification, r.target_classification, r.feasible, r.projected_confidence, r.notes,
  r.recommendations.map(({ pillar, current, target, delta }) => [pillar, current, target, delta]),
];
const dragResult = (r) => [[r.annual_drag_eur_low, r.annual_drag_eur_high], [r.drag_rate_low, r.drag_rate_high], r.pace_gap];

function build() {
  const scoreCases = [];
  const add = (input) => scoreCases.push(input);

  // 1. Every threshold of every pillar, with the work design evidenced: the verdict rule on its own.
  const edge = { sa: [0, 59, 60, 100], fr: [0, 20, 21, 59, 60, 100], ce: [0, 59, 60, 100], gr: [0, 40, 41, 69, 70, 100] };
  let count = 0;
  for (const sa of edge.sa) for (const fr of edge.fr) for (const ce of edge.ce) for (const gr of edge.gr) {
    add({ ...base, scores: pillars(sa, fr, ce, gr), work_architecture: READY });
    // Every fourth one again with no work design given: the gate that turns an Accelerate into a Fix.
    if (count++ % 4 === 0) add({ ...base, scores: pillars(sa, fr, ce, gr) });
  }

  // 2. Every industry, function, tier and readiness, with no pillar given: the estimates and the planning rates.
  for (const industry of INDUSTRIES) for (const fn of FUNCTIONS) for (const tier of AI_TIERS) for (const readiness of READINESS) {
    add({ industry, revenue_eur: 123_456_789, function: fn, ai_tier: tier, readiness });
  }

  // 3. Rounding. Pillar sums that land on a half, at several signals, and revenues whose euros land on a half.
  const halves = [[61, 60, 60, 39], [63, 60, 60, 41], [45, 50, 55, 48], [1, 21, 0, 0], [99, 100, 100, 1], [22, 23, 24, 31], [60, 60, 61, 40], [35, 42, 47, 62]];
  for (const [sa, fr, ce, gr] of halves) for (const signal of [undefined, 1, 0.9, 0.75, 0.55, 0.4, 0.1, 0]) {
    add({ ...base, scores: pillars(sa, fr, ce, gr), work_architecture: READY, ...(signal === undefined ? {} : { signal_completeness: signal }) });
  }
  for (const revenue of [0, 1, 3, 7, 10, 33, 50, 99.5, 250, 1000.5, 12_345.67, 1_000_001, 77_777_777, 8_400_000.5, 1e12]) {
    for (const [industry, fn, tier, readiness] of [['retail', 'cx', 'gen2', 'traditional'], ['financial', 'risk', 'gen3', 'siloed'], ['healthcare', 'rd', 'gen1', 'agile'], ['manufacturing', 'supply', 'gen2', 'siloed']]) {
      add({ industry, revenue_eur: revenue, function: fn, ai_tier: tier, readiness, scores: pillars(70, 70, 70, 30), work_architecture: READY });
    }
  }

  // 4. Where a pillar came from. Some given, some estimated, some marked; a confidence; a signal above what the pillars support.
  const given = pillars(72, 66, 61, 33);
  for (let mask = 0; mask < 16; mask += 1) {
    const some = Object.fromEntries(PILLARS.filter((_, index) => mask & (1 << index)).map((pillar) => [pillar, given[pillar]]));
    add({ ...base, scores: some, work_architecture: READY });
    add({ ...base, scores: some, signal_completeness: 1 });
    add({ ...base, scores: given, pillar_basis: Object.fromEntries(PILLARS.filter((_, index) => mask & (1 << index)).map((pillar) => [pillar, 'estimated'])), work_architecture: READY });
  }
  for (const confidence of [0, 20, 40, 55, 100]) {
    add({ ...base, scores: { ...given, financial_return: { value: 66, confidence } }, work_architecture: READY });
    add({ ...base, scores: { ...given, financial_return: { value: 95, confidence, basis: 'estimated' }, governance_risk: { value: 33, confidence } }, work_architecture: READY });
    add({ ...base, scores: Object.fromEntries(PILLARS.map((pillar) => [pillar, { value: given[pillar], confidence }])), signal_completeness: 0.9 });
  }

  // 5. The work design: each of the four checks met, a gap, or not given.
  const checks = Object.keys(READY);
  for (let code = 0; code < 81; code += 1) {
    const work = {};
    let rest = code;
    for (const check of checks) { const state = rest % 3; rest = Math.floor(rest / 3); if (state < 2) work[check] = state === 1; }
    add({ ...base, scores: pillars(75, 70, 65, 25), work_architecture: work });
  }

  const recommendCases = scoreCases
    .filter((input) => input.signal_completeness === undefined)
    .filter((_, index) => index % 5 === 0)
    .map(({ signal_completeness, ...input }) => input);
  const dragCases = [];
  for (const tier of AI_TIERS) for (const readiness of READINESS) for (const revenue of [0, 1, 50, 150, 250, 333, 99.5, 12_345.67, 500_000_000, 1e12]) {
    dragCases.push({ revenue_eur: revenue, ai_tier: tier, readiness });
  }

  return {
    score: scoreCases.map((input) => [input, scoreResult(score(input))]),
    recommend_improvements: recommendCases.map((input) => [input, recommendResult(recommendImprovements(input))]),
    calculate_pace_layer_drag: dragCases.map((input) => [input, dragResult(calculatePaceLayerDrag(input))]),
  };
}

// One case on each line, so that a change to the rules shows as the cases it moves.
function write(vectors) {
  const section = (name) => `  ${JSON.stringify(name)}: [\n${vectors[name].map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`;
  return `{\n  "about": "Expected results from @aibvf/core, the TypeScript engine. Every AI BVF engine reproduces them: same inputs, same verdict, same score, same euros. Each case is [input, result]. The order of each result list is given in scripts/build-parity-vectors.mjs, which writes this file. Do not edit by hand.",\n${Object.keys(vectors).map(section).join(',\n')}\n}\n`;
}

const text = write(build());
const total = Object.values(JSON.parse(text)).filter(Array.isArray).reduce((sum, list) => sum + list.length, 0);
if (process.argv.includes('--check')) {
  const onDisk = await readFile(FILE, 'utf8').catch(() => '');
  if (onDisk !== text) {
    process.stderr.write('spec/parity-vectors.json is not what the engine gives today. Run: node scripts/build-parity-vectors.mjs\n');
    process.exit(1);
  }
  process.stdout.write(`Parity vectors verified: ${total} cases match the engine.\n`);
} else {
  await writeFile(FILE, text);
  process.stdout.write(`Wrote ${total} cases to spec/parity-vectors.json (${Math.round(text.length / 1024)} KB).\n`);
}
