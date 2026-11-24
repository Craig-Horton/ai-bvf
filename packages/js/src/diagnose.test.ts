import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseProcess, confidenceBand } from './diagnose.js';
import type { ProcessSignals } from './types.js';

// A heavy, mostly-manual finance process: high volume, low automation,
// real rework, fully measured.
const heavyFinance: ProcessSignals = {
  process_id: 'fin-ap',
  function: 'finance',
  instances_per_year: 50_000,
  fte_hours_per_instance: 0.5,
  loaded_hourly_rate_eur: 60,
  cycle_time_days: 12,
  touch_ratio: 0.3,
  handoffs: 6,
  rework_rate: 0.25,
  automation_level: 0.1,
  direct_spend_eur: 200_000,
  signal_completeness: 0.9,
  readiness: 'traditional',
};

test('baseline cost = labour + direct spend', () => {
  const v = diagnoseProcess(heavyFinance);
  // 50000 * 0.5 * 60 = 1_500_000 + 200_000 = 1_700_000
  assert.equal(v.baseline_cost_eur, 1_700_000);
});

test('deterministic: same input → identical output', () => {
  assert.deepEqual(diagnoseProcess(heavyFinance), diagnoseProcess(heavyFinance));
});

test('heavy manual finance process → Automate + Accelerate + offer', () => {
  const v = diagnoseProcess(heavyFinance);
  assert.equal(v.intervention, 'Automate');
  assert.equal(v.verdict, 'Accelerate');
  assert.equal(v.offer_to_execute, true);
  assert.equal(v.evidence_maturity, 'High'); // finance×Automate
});

test('bounds: heaviness 0..100, confidence 0..1, savings ordered', () => {
  const v = diagnoseProcess(heavyFinance);
  assert.ok(v.heaviness >= 0 && v.heaviness <= 100);
  assert.ok(v.decision_confidence >= 0 && v.decision_confidence <= 1);
  assert.ok(v.net_saving_low_eur <= v.net_saving_high_eur);
  const sum = Object.values(v.drag_decomposition).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 0.02); // decomposition normalised
});

test('light process → low heaviness → Stop', () => {
  const light: ProcessSignals = {
    ...heavyFinance,
    process_id: 'fin-light',
    automation_level: 0.95,
    rework_rate: 0.01,
    handoffs: 1,
    touch_ratio: 0.95,
    cycle_time_days: 1,
  };
  const v = diagnoseProcess(light);
  assert.ok(v.heaviness < 25, `expected light, got heaviness ${v.heaviness}`);
  assert.equal(v.verdict, 'Stop');
});

test('low signal completeness drags confidence down', () => {
  const blind = { ...heavyFinance, signal_completeness: 0.2 };
  const seen = diagnoseProcess(heavyFinance).decision_confidence;
  const unseen = diagnoseProcess(blind).decision_confidence;
  assert.ok(unseen < seen, `expected ${unseen} < ${seen}`);
});

test('evidence fallback: rework-dominant sales uses cross-cutting Quality band', () => {
  const sales: ProcessSignals = {
    process_id: 'sales-rework',
    function: 'sales',
    instances_per_year: 10_000,
    fte_hours_per_instance: 1,
    loaded_hourly_rate_eur: 70,
    cycle_time_days: 5,
    touch_ratio: 0.8,
    handoffs: 2,
    rework_rate: 0.9,        // rework dominates → Quality controls
    automation_level: 0.8,
    direct_spend_eur: 0,
    signal_completeness: 0.8,
  };
  const v = diagnoseProcess(sales);
  assert.equal(v.intervention, 'Quality controls');
  // sales has no Quality cell → cross-cutting Medium
  assert.equal(v.evidence_maturity, 'Medium');
});

test('low-volume heavy process → Eliminate / insource', () => {
  const niche: ProcessSignals = {
    ...heavyFinance,
    process_id: 'fin-niche',
    instances_per_year: 100, // below ELIMINATE_VOLUME
  };
  const v = diagnoseProcess(niche);
  assert.equal(v.intervention, 'Eliminate / insource');
});

// A service desk, counted from its ticket log: short cases that wait in a queue.
// Waiting is the largest drag factor in every one of them.
const desk: ProcessSignals = {
  process_id: 'order-status',
  function: 'cx',
  instances_per_year: 3_042,
  fte_hours_per_instance: 0.1,
  loaded_hourly_rate_eur: 38,
  cycle_time_days: 0.08,
  touch_ratio: 0.05,
  handoffs: 1,
  rework_rate: 0.02,
  automation_level: 0.34,
  direct_spend_eur: 0,
  signal_completeness: 0.89,
};

test('short and repeated work → Automate, though waiting is the largest drag factor', () => {
  const v = diagnoseProcess(desk);
  assert.equal(v.intervention, 'Automate');
  assert.match(v.assumptions[0], /^intervention chosen by short and repeated: 15 minutes of work or less, one person at most, 1000 a year or more$/);
  // One more person on each case, more work on each case, or fewer cases: the rule no longer fits, and waiting decides again.
  for (const change of [{ handoffs: 2 }, { fte_hours_per_instance: 0.3 }, { instances_per_year: 900 }]) {
    const other = diagnoseProcess({ ...desk, ...change });
    assert.equal(other.intervention, 'Consolidate & re-sequence', JSON.stringify(change));
    assert.equal(other.assumptions[0], 'intervention chosen by largest drag factor: wait');
  }
});

test('work that comes back → Quality controls, before any other rule but rare and heavy', () => {
  const comesBack = diagnoseProcess({ ...desk, process_id: 'address-change', rework_rate: 0.53, fte_hours_per_instance: 0.25 });
  assert.equal(comesBack.intervention, 'Quality controls');
  assert.equal(comesBack.assumptions[0], 'intervention chosen by comes back: 30 percent of cases or more are reworked');
  // Just under the floor, the short and repeated rule takes it.
  assert.equal(diagnoseProcess({ ...desk, rework_rate: 0.29 }).intervention, 'Automate');
  // Rare and heavy still comes first.
  const rare = diagnoseProcess({ ...desk, process_id: 'supplier-claim', instances_per_year: 122, fte_hours_per_instance: 3.5, cycle_time_days: 9.8, handoffs: 5, rework_rate: 0.33, automation_level: 0.05 });
  assert.equal(rare.intervention, 'Eliminate / insource');
});

test('every verdict says which rule chose the intervention', () => {
  assert.equal(diagnoseProcess(heavyFinance).assumptions[0], 'intervention chosen by largest drag factor: manual');
});

// The delivery complaint from the example log. Waiting is 33.4 percent of the drag and manual work is 33.2 percent:
// both round to 0.33. The rule reads the shares as counted, so waiting decides.
const deliveryComplaint: ProcessSignals = {
  process_id: 'Delivery complaint',
  function: 'cx',
  instances_per_year: 1521,
  fte_hours_per_instance: 0.49,
  loaded_hourly_rate_eur: 38,
  cycle_time_days: 0.61,
  touch_ratio: 0.08,
  handoffs: 2,
  rework_rate: 0.19,
  automation_level: 0.27,
  direct_spend_eur: 0,
  signal_completeness: 0.89,
};

test('two drag factors that round to the same figure: the larger one as counted decides', () => {
  const v = diagnoseProcess(deliveryComplaint);
  assert.equal(v.drag_decomposition.wait, v.drag_decomposition.manual, 'the rounded shares are equal');
  assert.equal(v.assumptions[0], 'intervention chosen by largest drag factor: wait');
  assert.equal(v.intervention, 'Consolidate & re-sequence');
});

test('a close call between two moves is said, with both shares and the other move', () => {
  const v = diagnoseProcess(deliveryComplaint);
  assert.equal(v.assumptions[1], 'close call: wait is 33.4 percent of the drag and manual is 33.2 percent. A small change in the counts would choose Automate');
  // Clear of the margin, there is no such line. Two factors that point to the same move are no close call either.
  assert.ok(!diagnoseProcess(heavyFinance).assumptions.some((line) => line.startsWith('close call')));
  assert.ok(!diagnoseProcess({ ...desk, handoffs: 2 }).assumptions.some((line) => line.startsWith('close call')));
});

test('the assumptions rebuild the saving: yearly cost, reach, saving band, share kept', () => {
  const v = diagnoseProcess(deliveryComplaint);
  const lines = v.assumptions.join('\n');
  assert.match(lines, /yearly cost today: €28,321\. That is 1,521 cases a year, 0\.49 hours of work each, at €38 an hour, plus €0 of spend on tools/);
  assert.match(lines, /reach: 100 percent of the yearly cost, the share that is labour/);
  assert.match(lines, /saving band for Consolidate & re-sequence: 20 to 40 percent of what the change reaches\. Evidence Medium\. The band is a draft/);
  assert.match(lines, /share kept: 50 to 70 percent of that saving, the band for traditional readiness to change\. No readiness was given, so this is the default/);
  assert.match(lines, /signals counted: 89 percent/);
  assert.equal(v.net_saving_low_eur, Math.round(28321 * 1 * 0.20 * 0.5));
  assert.equal(v.net_saving_high_eur, Math.round(28321 * 1 * 0.40 * 0.7));
  // A readiness that was given is said as given.
  assert.match(diagnoseProcess({ ...deliveryComplaint, readiness: 'agile' }).assumptions.join('\n'), /share kept: 85 to 100 percent of that saving, the band for agile readiness to change\. Readiness was given/);
  // No line carries a dash that stands for a pause.
  for (const line of v.assumptions) assert.ok(!/[—–]/.test(line), line);
});

test('the saving is also given as a share of what the process costs today', () => {
  const v = diagnoseProcess(deliveryComplaint);
  assert.equal(v.net_saving_low_pct, 10);
  assert.equal(v.net_saving_high_pct, 28);
  assert.equal(v.net_saving_low_pct, Math.round(100 * v.net_saving_low_eur / v.baseline_cost_eur));
});

test('confidence in words: one scale for every report', () => {
  assert.equal(confidenceBand(0.75), 'high');
  assert.equal(confidenceBand(0.74), 'medium');
  assert.equal(confidenceBand(0.5), 'medium');
  assert.equal(confidenceBand(0.49), 'low');
  const v = diagnoseProcess(deliveryComplaint);
  assert.equal(v.confidence_band, confidenceBand(v.decision_confidence));
});
