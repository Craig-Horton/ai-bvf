import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
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
