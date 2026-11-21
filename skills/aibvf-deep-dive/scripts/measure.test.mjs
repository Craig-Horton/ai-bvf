import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { measureLog, parseCsv } from './measure.mjs';
import { diagnoseProcess } from '../../../packages/js/dist/index.js';

const log = await readFile(new URL('../../../examples/process-deep-dive/halden-service-desk/tickets.csv', import.meta.url), 'utf8');
const MAP = { case: 'case_id', process: 'category', time: 'timestamp', actor: 'actor', actorType: 'actor_type', systemValue: 'system', minutes: 'minutes_worked', step: 'step', reopenValue: 'Reopened' };

test('the script counts the example log to the same signals as the example', async () => {
  const example = JSON.parse(await readFile(new URL('../../../examples/process-deep-dive/signals.json', import.meta.url), 'utf8'));
  const counted = measureLog(log, MAP, { fn: 'cx', rate: 38 });
  assert.equal(counted.cases, example.cases);
  assert.equal(counted.steps, example.steps);
  for (const process of counted.processes) {
    const same = example.processes.find((item) => item.name === process.name);
    for (const [signal, value] of Object.entries(process.counted)) assert.equal(value, same[signal], `${process.name}: ${signal}`);
  }
});

test('what it prints goes to the engine unchanged, and the engine names the rule that chose', () => {
  const counted = measureLog(log, MAP, { fn: 'cx', rate: 38 });
  assert.equal(counted.euro_figures, true);
  const calls = Object.fromEntries(counted.processes.map((process) => [process.name, diagnoseProcess(process.diagnose_process)]));
  assert.equal(calls['Order status query'].intervention, 'Automate');
  assert.match(calls['Order status query'].assumptions[0], /short and repeated/);
  assert.equal(calls['Address change'].intervention, 'Quality controls');
  assert.equal(calls['Supplier claim'].intervention, 'Eliminate / insource');
  assert.equal(calls['Refund request'].intervention, 'Consolidate & re-sequence');
  assert.equal(calls['Invoice copy request'].verdict, 'Stop');
});

test('with no hourly cost there are no euro figures, and the script says what to ask', () => {
  const counted = measureLog(log, MAP, { fn: 'cx' });
  assert.equal(counted.euro_figures, false);
  assert.ok(counted.not_in_log.some((line) => line.startsWith('the hourly cost of the team')));
  assert.equal(counted.processes[0].diagnose_process.signal_completeness, 0.78);
});

test('a log without a column leaves that signal uncounted and judges nothing', () => {
  const counted = measureLog(log, { case: 'case_id', process: 'category', time: 'timestamp', actor: 'actor' }, { fn: 'cx', rate: 38 });
  assert.equal(counted.processes[0].diagnose_process, null);
  assert.equal(counted.processes[0].counted.fte_hours_per_instance, undefined);
  assert.equal(counted.not_in_log.length, 4);
  assert.throws(() => measureLog(log, { ...MAP, process: 'nope' }), /no column named "nope"/);
});

test('cells with commas, quotes and line breaks are read whole', () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","he said ""no"""\n"two\nlines",z\n'), [['a', 'b'], ['x, y', 'he said "no"'], ['two\nlines', 'z']]);
});
