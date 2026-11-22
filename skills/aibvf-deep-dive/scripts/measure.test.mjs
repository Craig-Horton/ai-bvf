import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import { measureLog, measureFlow, parseCsv, FLOW_ORDERS } from './measure.mjs';
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

test('the report link carries the counts and no row of the log', () => {
  const counted = measureLog(log, MAP, { fn: 'cx', rate: 38, department: 'Customer service desk', organisation: 'Halden & Co' });
  assert.match(counted.report_url, /^https:\/\/www\.aibvf\.com\/deep-dive#[A-Za-z0-9_-]+$/);
  const carried = JSON.parse(Buffer.from(counted.report_url.split('#')[1], 'base64url').toString('utf8'));
  assert.equal(carried.n, 'Customer service desk');
  assert.equal(carried.r, 38);
  assert.equal(carried.p.length, 6);
  assert.deepEqual(carried.p.find((row) => row[0] === 'Order status query'), ['Order status query', 3042, 0.1, 0.08, 0.05, 1, 0.02, 0.34, 0.89]);
  // No case number and no person's name from the log is in the link.
  const text = JSON.stringify(carried);
  assert.ok(!/HD-48|Ana|Bram|Chloe|Nora/.test(text));
  assert.ok(counted.report_url.length < 2000);
  // Without every signal the engine needs, there is no link.
  assert.equal(measureLog(log, { case: 'case_id', process: 'category', time: 'timestamp', actor: 'actor' }, { fn: 'cx' }).report_url, null);
});

test('a blank or unreadable minutes value is not counted as zero work', () => {
  const lines = log.trim().split('\n');
  const blanked = [lines[0], ...lines.slice(1).map((line, index) => (index % 50 === 1 ? line.replace(/,person,\d+,/, ',person,,') : line))].join('\n');
  const counted = measureLog(blanked, MAP, { fn: 'cx', rate: 38 });
  assert.equal(counted.processes[0].counted.fte_hours_per_instance, undefined);
  assert.equal(counted.processes[0].diagnose_process, null);
  assert.equal(counted.report_url, null);
  assert.ok(counted.not_in_log.some((line) => /^minutes of work: \d+ of 3733 steps have no readable value/.test(line)));
});

test('a process with no work time recorded is named and not sent to the engine', () => {
  const csv = 'case,kind,when,who,type,mins,step\n' + ['a', 'b', 'c'].map((id) => `${id},Auto reply,2026-09-01T08:00Z,Bot,system,0,Sent\n${id},Auto reply,2026-09-02T08:00Z,Bot,system,0,Closed`).join('\n');
  const counted = measureLog(csv, { case: 'case', process: 'kind', time: 'when', actor: 'who', actorType: 'type', systemValue: 'system', minutes: 'mins', step: 'step', reopenValue: 'Reopened' }, { fn: 'cx', rate: 38 });
  assert.equal(counted.processes[0].diagnose_process, null);
  assert.match(counted.processes[0].not_judged, /no work time is recorded/);
});

test('a long log is read, and a link that leaves processes out says how many', () => {
  const rows = ['case,kind,when,who,type,mins,step'];
  for (let index = 0; index < 160_000; index += 1) {
    const kind = `Process ${index % 45}`;
    rows.push(`c${index >> 1},${kind},2026-09-${String(1 + (index % 28)).padStart(2, '0')}T08:${String(index % 60).padStart(2, '0')}Z,${index % 2 ? 'Ana' : 'Bot'},${index % 2 ? 'person' : 'system'},${index % 2 ? 5 : 0},Step`);
  }
  const counted = measureLog(rows.join('\n'), { case: 'case', process: 'kind', time: 'when', actor: 'who', actorType: 'type', systemValue: 'system', minutes: 'mins', step: 'step', reopenValue: 'Reopened' }, { fn: 'cx', rate: 38 });
  assert.equal(counted.steps, 160_000);
  assert.equal(counted.processes.length, 45);
  assert.equal(counted.report_leaves_out, 5);
  const carried = JSON.parse(Buffer.from(counted.report_url.split('#')[1], 'base64url').toString('utf8'));
  assert.equal(carried.p.length, 40);
  assert.equal(carried.x, 5);
  assert.ok(counted.report_url.split('#')[1].length < 12_000);
});

// Nothing above runs the script the way an agent does: as a command. On Windows,
// and from any folder with a space in its name, the old check never matched and
// the script printed nothing.
test('run as a command it prints the counts, from a folder with a space in its name too', async () => {
  const run = promisify(execFile);
  const here = fileURLToPath(new URL('.', import.meta.url));
  const log = fileURLToPath(new URL('../../../examples/process-deep-dive/halden-service-desk/tickets.csv', import.meta.url));
  const flags = ['--case', 'case_id', '--process', 'category', '--time', 'timestamp', '--actor', 'actor', '--actor-type', 'actor_type', '--system-value', 'system', '--minutes', 'minutes_worked', '--step', 'step', '--reopen-value', 'Reopened', '--function', 'cx'];
  const plain = await run(process.execPath, [join(here, 'measure.mjs'), log, ...flags]);
  assert.equal(JSON.parse(plain.stdout).processes.length, 6);
  const folder = await mkdtemp(join(tmpdir(), 'deep dive '));
  try {
    await cp(join(here, 'measure.mjs'), join(folder, 'measure.mjs'));
    const spaced = await run(process.execPath, [join(folder, 'measure.mjs'), log, ...flags]);
    assert.equal(JSON.parse(spaced.stdout).processes.length, 6);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

// The flow of one process: what a draft is written from. The script counts it, so that no draft
// rests on a few cases read by eye.
test('the flow of a process is counted: the orders its steps come in, and who does each step', () => {
  const flow = measureFlow(log, MAP, 'Address change');
  assert.equal(flow.cases_in_log, 200);
  assert.deepEqual(flow.orders.map((order) => [order.steps.join(' > '), order.cases]), [
    ['Received > Applied > Checked > Confirmed > Reopened > Fixed', 105],
    ['Received > Applied > Checked > Confirmed', 95],
  ]);
  assert.equal(flow.orders.reduce((sum, order) => sum + order.cases, 0) + flow.cases_in_orders_left_out, flow.cases_in_log);
  // The finding a draft rests on: the address is applied by a system before a person checks it, in every case.
  for (const order of flow.orders) assert.ok(order.steps.indexOf('Applied') < order.steps.indexOf('Checked'));
  const step = (name) => flow.steps.find((item) => item.step === name);
  assert.deepEqual([step('Applied').done_by, step('Applied').systems, step('Applied').in_cases], ['a system', ['Order system'], 200]);
  assert.deepEqual([step('Checked').done_by, step('Checked').people_who_did_it], ['a person', 6]);
  assert.equal(step('Reopened').in_cases, 105);
  assert.equal(step('Reopened').median_hours_after_the_step_before, 19.4);
  assert.equal(step('Received').median_hours_after_the_step_before, undefined, 'the first step has no step before it');
});

test('the flow counts people and names none', () => {
  const printed = JSON.stringify(measureFlow(log, MAP, 'Address change'));
  for (const person of ['Femi', 'Chloe', 'Bram', 'Ana', 'Eli', 'Deniz']) assert.ok(!printed.includes(person), `${person} is named in the flow`);
  assert.ok(printed.includes('Order system'), 'a system is named');
});

test('the flow says what it cannot give: an unknown process, a log with no step names, a log that marks no system', () => {
  assert.throws(() => measureFlow(log, MAP, 'Adress change'), /no process named "Adress change"\. Its processes are: .*Address change/);
  const { step: _step, ...noStep } = MAP;
  assert.throws(() => measureFlow(log, noStep, 'Address change'), /Name it with --step/);
  const { actorType: _type, systemValue: _value, ...noSystems } = MAP;
  const flow = measureFlow(log, noSystems, 'Address change');
  assert.equal(flow.steps[0].done_by, 'not in the log');
  assert.ok(flow.not_in_log.includes('which steps a system does'));
});

test('steps are put in time order, the log order decides a tie, and rare orders are counted as left out', () => {
  const head = 'case_id,category,step,timestamp,actor';
  const tied = [head, 'A,P,Second,2026-09-01T09:00Z,x', 'A,P,First,2026-09-01T08:00Z,x', 'A,P,Third,2026-09-01T09:00Z,x'].join('\n');
  assert.deepEqual(measureFlow(tied, { case: 'case_id', process: 'category', time: 'timestamp', actor: 'actor', step: 'step' }, 'P').orders[0].steps, ['First', 'Second', 'Third']);
  const many = [head];
  for (let index = 0; index < FLOW_ORDERS + 2; index += 1) many.push(`C${index},P,Only${index},2026-09-01T08:00Z,x`);
  const flow = measureFlow(many.join('\n'), { case: 'case_id', process: 'category', time: 'timestamp', actor: 'actor', step: 'step' }, 'P');
  assert.equal(flow.orders.length, FLOW_ORDERS);
  assert.deepEqual([flow.orders_left_out, flow.cases_in_orders_left_out], [2, 2]);
});

test('run as a command with --flow it prints the flow of that one process', async () => {
  const run = promisify(execFile);
  const here = fileURLToPath(new URL('.', import.meta.url));
  const file = fileURLToPath(new URL('../../../examples/process-deep-dive/halden-service-desk/tickets.csv', import.meta.url));
  const out = await run(process.execPath, [join(here, 'measure.mjs'), file, '--flow', 'Address change', '--case', 'case_id', '--process', 'category', '--time', 'timestamp', '--actor', 'actor', '--actor-type', 'actor_type', '--system-value', 'system', '--step', 'step']);
  const flow = JSON.parse(out.stdout);
  assert.equal(flow.process, 'Address change');
  assert.equal(flow.orders[0].cases, 105);
});
