import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import { measureLog, measureFlow, parseCsv, FLOW_ORDERS, MIN_CASES_TO_JUDGE, MIN_DAYS_TO_PROJECT } from './measure.mjs';
import { diagnoseProcess, MIN_CASES_TO_JUDGE as ENGINE_MIN_CASES, MIN_DAYS_TO_PROJECT as ENGINE_MIN_DAYS } from '../../../packages/js/dist/index.js';

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
  const calls = Object.fromEntries(counted.processes.filter((process) => process.diagnose_process).map((process) => [process.name, diagnoseProcess(process.diagnose_process)]));
  assert.equal(calls['Order status query'].intervention, 'Automate');
  assert.match(calls['Order status query'].assumptions[0], /short and repeated/);
  assert.equal(calls['Address change'].intervention, 'Quality controls');
  assert.equal(calls['Refund request'].intervention, 'Consolidate & re-sequence');
  assert.equal(calls['Invoice copy request'].verdict, 'Stop');
  // Waiting and manual work both round to 33 percent of the drag. Waiting is the larger as counted, and the verdict says the call was close.
  assert.equal(calls['Delivery complaint'].intervention, 'Consolidate & re-sequence');
  assert.match(calls['Delivery complaint'].assumptions[1], /^close call: wait is 33\.4 percent of the drag and manual is 33\.2 percent/);
});

test('a process with too few cases is counted and not judged: no yearly volume, no arguments for the engine', () => {
  assert.equal(MIN_CASES_TO_JUDGE, ENGINE_MIN_CASES);
  assert.equal(MIN_DAYS_TO_PROJECT, ENGINE_MIN_DAYS);
  const counted = measureLog(log, MAP, { fn: 'cx', rate: 38 });
  const claim = counted.processes.find((process) => process.name === 'Supplier claim');
  assert.equal(claim.cases_in_log, 12);
  assert.equal(claim.not_judged, '12 cases in the log, and it takes 30 to judge a process');
  assert.equal(claim.diagnose_process, null);
  assert.equal(claim.counted.instances_per_year, undefined);
  assert.equal(claim.counted.handoffs, 5);
});

test('one case seen on one day is not 365 a year: a log that covers too few days judges nothing', () => {
  const csv = 'case_id,category,step,timestamp,actor,actor_type,minutes_worked\n'
    + 'C1,Contract review,Opened,2026-09-01T08:00Z,Ana,person,120\nC1,Contract review,Legal,2026-09-01T10:00Z,Bram,person,120\n'
    + 'C1,Contract review,Reopened,2026-09-01T14:00Z,Dan,person,60\nC1,Contract review,Closed,2026-09-01T15:00Z,Bot,system,0\n';
  const counted = measureLog(csv, MAP, { fn: 'cx', rate: 60 });
  assert.equal(counted.period.days, 1);
  assert.equal(counted.processes[0].not_judged, 'the log covers 1 day, and it takes 28 to project a year');
  assert.equal(counted.processes[0].diagnose_process, null);
  assert.equal(counted.processes[0].counted.instances_per_year, undefined);
  assert.equal(counted.report_url, null);
  assert.equal(counted.euro_figures, false);
  assert.ok(counted.not_in_log.some((line) => line.startsWith('a year of volume: the log covers 1 day, and it takes 28 to project a year')));
  // Enough cases in too few days is still too little: thirty cases in one week.
  const week = ['case_id,category,step,timestamp,actor,actor_type,minutes_worked'];
  for (let index = 0; index < 30; index += 1) {
    const date = `2026-09-0${1 + (index % 7)}`;
    week.push(`W${index},Query,Received,${date}T08:00Z,Bot,system,0`, `W${index},Query,${index ? 'Closed' : 'Reopened'},${date}T09:00Z,Ana,person,10`);
  }
  assert.match(measureLog(week.join('\n'), MAP, { fn: 'cx', rate: 38 }).processes[0].not_judged, /^the log covers 7 days/);
});

test('a value named on the command line that never appears in the log is said, and nothing is counted as zero', () => {
  // The value that marks a case that came back, misspelt. Before, every process read as zero percent rework.
  const typo = measureLog(log, { ...MAP, reopenValue: 'reopened' }, { fn: 'cx', rate: 38 });
  assert.equal(typo.processes[0].counted.rework_rate, undefined);
  assert.ok(typo.processes.every((process) => process.diagnose_process === null));
  assert.equal(typo.report_url, null);
  const line = typo.not_in_log.find((item) => item.startsWith('cases that come back'));
  assert.match(line, /the value "reopened" never appears in "step"\. The values there are: "Received"/);
  assert.match(line, /Did you mean "Reopened"\?/);
  // The value that marks a step done by a system, misspelt. Before, every step read as done by a person.
  const system = measureLog(log, { ...MAP, systemValue: 'System' }, { fn: 'cx', rate: 38 });
  assert.equal(system.processes[0].counted.automation_level, undefined);
  assert.ok(system.processes.every((process) => process.diagnose_process === null));
  assert.match(system.not_in_log.find((item) => item.startsWith('which steps a system does')), /the value "System" never appears in "actor_type"\. The values there are: "person", "system"\. Did you mean "system"\?/);
  // A system named by hand that is not in the log, beside one that is: counted, with a warning.
  const named = measureLog(log, { ...MAP, actorType: undefined, systemValue: undefined, systemActors: 'Web form,Order sistem' }, { fn: 'cx', rate: 38 });
  assert.deepEqual(named.warnings, ['"Order sistem" is named as a system and never appears in "actor".']);
  assert.equal(measureLog(log, MAP, { fn: 'cx', rate: 38 }).warnings.length, 0);
});

test('a date that reads two ways is never guessed', () => {
  const head = 'case_id,category,step,timestamp,actor,actor_type,minutes_worked\n';
  const rows = (dates) => head + dates.map((date, index) => `D${index >> 1},Query,${index % 2 ? 'Closed' : 'Opened'},${date},Ana,person,5`).join('\n');
  // 01/09 and 03/09: September in a European log, January and March as the old reading had it.
  const twoWays = rows(['01/09/2026 08:00', '03/09/2026 08:00', '05/09/2026 08:00', '12/09/2026 08:00']);
  assert.throws(() => measureLog(twoWays, MAP, { fn: 'cx' }), /written like 01\/09\/2026 08:00, which reads two ways: day first or month first\. Ask the owner, then say which with --date-order dmy or --date-order mdy/);
  const dayFirst = measureLog(twoWays, { ...MAP, dateOrder: 'dmy' }, { fn: 'cx' });
  assert.deepEqual([dayFirst.period.first, dayFirst.period.last], ['2026-09-01', '2026-09-12']);
  const monthFirst = measureLog(twoWays, { ...MAP, dateOrder: 'mdy' }, { fn: 'cx' });
  assert.deepEqual([monthFirst.period.first, monthFirst.period.last], ['2026-01-09', '2026-12-09']);
  assert.ok(dayFirst.assumptions.includes('dates like 01/09/2026 08:00 are read day first, as --date-order says'));
  // A day above 12 settles it, and the script says how it read.
  const settled = measureLog(rows(['01/09/2026 08:00', '03/09/2026 08:00', '05/09/2026 08:00', '25/09/2026 16:30']), MAP, { fn: 'cx' });
  assert.equal(settled.period.last, '2026-09-25');
  assert.ok(settled.assumptions.includes('dates like 01/09/2026 08:00 are read day first: the log has dates that fit no other reading'));
  // An order that the dates contradict is refused, and so is a date that does not exist.
  assert.throws(() => measureLog(rows(['01/09/2026', '03/09/2026', '05/09/2026', '25/09/2026']), { ...MAP, dateOrder: 'mdy' }, {}), /--date-order mdy does not fit/);
  assert.throws(() => measureLog(rows(['01/09/2026', '03/09/2026', '05/09/2026', '31/02/2026']), MAP, {}), /not dates the script can read, such as "31\/02\/2026"/);
});

test('a log saved with semicolons counts the same as the log saved with commas', () => {
  const semicolons = log.replace(/,/g, ';');
  const a = measureLog(log, MAP, { fn: 'cx', rate: 38 });
  const b = measureLog(semicolons, MAP, { fn: 'cx', rate: 38 });
  assert.deepEqual(b.processes, a.processes);
  // With semicolons between the cells, 2,5 minutes is two and a half.
  const lines = semicolons.trim().split('\n');
  const half = [lines[0], ...lines.slice(1).map((line) => line.replace(/;person;(\d+);/, ';person;$1,5;'))].join('\n');
  const counted = measureLog(half, MAP, { fn: 'cx', rate: 38 });
  assert.ok(!counted.not_in_log.some((item) => item.startsWith('minutes of work')));
  assert.ok(counted.processes[0].counted.fte_hours_per_instance > a.processes[0].counted.fte_hours_per_instance);
});

test('a mapping that cannot be right stops the script with the reason', () => {
  // The case column named wrong: every row is its own case, and there is no time from open to close.
  assert.match(measureLog(log, { ...MAP, case: 'timestamp' }, { fn: 'cx' }).warnings[0], /^\d+ of \d+ cases have a single row, so their time from open to close is zero\. Check that --case names/);
  const single = 'id,kind,when,who\n' + [1, 2, 3].map((n) => `${n},Query,2026-09-0${n}T08:00Z,Ana`).join('\n');
  assert.throws(() => measureLog(single, { case: 'id', process: 'kind', time: 'when', actor: 'who' }, {}), /Every value in "id" has one row.*Check that --case names the column/);
  // An hourly cost that is no figure, or zero.
  assert.throws(() => measureLog(log, MAP, { fn: 'cx', rate: 0 }), /hourly cost as a figure above zero/);
  assert.throws(() => measureLog(log, MAP, { fn: 'cx', rate: Number('abc') }), /hourly cost as a figure above zero/);
  assert.throws(() => measureLog(log, MAP, { fn: 'cx', rate: 38, readiness: 'keen' }), /--readiness as one of: agile, traditional, siloed/);
  // A case that moves from one process to another is counted in parts, and the script says so.
  const moved = 'case_id,category,step,timestamp,actor,actor_type,minutes_worked\n'
    + 'A1,Billing,Opened,2026-09-01T08:00Z,Ana,person,10\nA1,Billing,Triaged,2026-09-01T09:00Z,Ana,person,5\n'
    + 'A1,Complaint,Moved,2026-09-02T09:00Z,Bram,person,5\nA1,Complaint,Closed,2026-09-03T09:00Z,Bram,person,20\n';
  assert.match(measureLog(moved, MAP, { fn: 'cx' }).warnings[0], /^1 case appears under more than one process in "category"/);
});

test('what the counts assume is printed, and a readiness the owner states travels to the engine and the link', () => {
  const counted = measureLog(log, MAP, { fn: 'cx', rate: 38 });
  assert.deepEqual(counted.assumptions, [
    'a year of volume is projected from the log: the cases counted, times 365, divided by the 36 days the log covers. Seasons are not in it',
    'a process is judged with 30 cases or more in the log, and a log that covers 28 days or more. Below that it is counted and not judged',
    'the share of time spent working counts a case that runs past one working day at eight working hours a day',
    "the hourly cost of €38 is the owner's figure. It is not in the log",
    'readiness to change was not asked, so the tool uses its default, traditional. Pass --readiness when the owner states it',
  ]);
  assert.equal(counted.processes[0].diagnose_process.readiness, undefined);
  const agile = measureLog(log, MAP, { fn: 'cx', rate: 38, readiness: 'agile' });
  assert.equal(agile.processes[0].diagnose_process.readiness, 'agile');
  assert.ok(agile.assumptions.includes('readiness to change is agile, as the owner said'));
  assert.equal(JSON.parse(Buffer.from(agile.report_url.split('#')[1], 'base64url').toString('utf8')).rd, 'agile');
  assert.match(diagnoseProcess(agile.processes[0].diagnose_process).assumptions.join(' '), /Readiness was given/);
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
  assert.equal(carried.p.length, 5);
  assert.deepEqual(carried.p.find((row) => row[0] === 'Order status query'), ['Order status query', 3042, 0.1, 0.08, 0.05, 1, 0.02, 0.34, 0.89]);
  // Beside the rows: the days the log covers, the cases behind each row, and the process that was counted and not judged.
  assert.equal(carried.d, 36);
  assert.deepEqual(carried.cs, [300, 200, 150, 120, 100]);
  assert.deepEqual(carried.u, [['Supplier claim', 12]]);
  assert.equal(carried.x, undefined);
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
  const rows = ['case,kind,when,who,type,mins,step'];
  for (let index = 0; index < 30; index += 1) {
    const date = `2026-09-${String(1 + index).padStart(2, '0')}`;
    rows.push(`a${index},Auto reply,${date}T08:00Z,Bot,system,0,Sent`, `a${index},Auto reply,${date}T09:00Z,Bot,system,0,${index ? 'Closed' : 'Reopened'}`);
  }
  const counted = measureLog(rows.join('\n'), { case: 'case', process: 'kind', time: 'when', actor: 'who', actorType: 'type', systemValue: 'system', minutes: 'mins', step: 'step', reopenValue: 'Reopened' }, { fn: 'cx', rate: 38 });
  assert.equal(counted.processes[0].diagnose_process, null);
  assert.match(counted.processes[0].not_judged, /no work time is recorded/);
});

test('a long log is read, and a link that leaves processes out says how many', () => {
  const rows = ['case,kind,when,who,type,mins,step'];
  for (let index = 0; index < 160_000; index += 1) {
    const kind = `Process ${(index >> 1) % 45}`;
    rows.push(`c${index >> 1},${kind},2026-09-${String(1 + ((index >> 1) % 28)).padStart(2, '0')}T08:${String(index % 60).padStart(2, '0')}Z,${index % 2 ? 'Ana' : 'Bot'},${index % 2 ? 'person' : 'system'},${index % 2 ? 5 : 0},${index % 997 === 1 ? 'Reopened' : 'Step'}`);
  }
  const counted = measureLog(rows.join('\n'), { case: 'case', process: 'kind', time: 'when', actor: 'who', actorType: 'type', systemValue: 'system', minutes: 'mins', step: 'step', reopenValue: 'Reopened' }, { fn: 'cx', rate: 38 });
  assert.equal(counted.steps, 160_000);
  assert.equal(counted.processes.length, 45);
  assert.equal(counted.report_leaves_out, 5);
  const carried = JSON.parse(Buffer.from(counted.report_url.split('#')[1], 'base64url').toString('utf8'));
  assert.equal(carried.p.length, 40);
  assert.equal(carried.x, 5);
  assert.equal(carried.cs.length, 40);
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
  // The shares of the orders add up to the whole. Rounded to two places they came to 101 percent.
  assert.deepEqual(flow.orders.map((order) => order.share), [0.525, 0.475]);
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
