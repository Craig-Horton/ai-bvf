import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseProcess } from './diagnose.js';
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
