#!/usr/bin/env node
// Counts one department's system log, process by process. Code counts. No model, no judgement.
// The rows stay on this computer. Only the counts this script prints go to the AI BVF tool.
//
//   node measure.mjs log.csv --case case_id --process category --time timestamp --actor actor \
//     [--actor-type actor_type --system-value system] [--system-actors "Web form,Order system"] \
//     [--minutes minutes_worked] [--step step --reopen-value Reopened] \
//     [--function cx] [--rate 38] [--spend 0] [--readiness traditional] [--date-order dmy] \
//     [--department "Service desk"] [--organisation "Halden & Co"]
//
// One row is one step of one case. Prints JSON: what was counted, what was not in the log,
// what the counts assume, and for each process the arguments for diagnose_process, to pass on unchanged.
// A process with too few cases, or a log that covers too few days, is counted and not judged.
// A value named on the command line that never appears in the log is said, and counts nothing as zero.
//
//   node measure.mjs log.csv --flow "Address change" --case ... --process ... --time ... --actor ... --step step
//
// With --flow, prints the flow of that one process: the orders its steps come in and who does each step.
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { pathToFileURL } from 'node:url';

/** A small CSV reader: quoted cells, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const body = text.replace(/^﻿/, '');
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quoted) {
      if (char === '"' && body[index + 1] === '"') { cell += '"'; index += 1; } else if (char === '"') quoted = false; else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ''; } else if (char === '\n' || char === '\r') {
      if (char === '\r' && body[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

/** A log saved with semicolons or tabs between its cells is read as it is. The header line decides. */
export function delimiterOf(text) {
  const first = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0];
  const count = (char) => first.split(char).length - 1;
  return [';', '\t'].reduce((best, char) => (count(char) > count(best) ? char : best), ',');
}

/**
 * The smallest log that supports a judgement. Below either floor a process is counted and not judged:
 * no yearly volume, no intervention, no saving. One case seen on one day is not 365 a year.
 * The same two figures are published in @aibvf/core. They are judgement, not a benchmark.
 */
export const MIN_CASES_TO_JUDGE = 30;
export const MIN_DAYS_TO_PROJECT = 28;
export const READINESS = ['agile', 'traditional', 'siloed'];

// A date written in figures only, such as 03/04/2026 or 3.4.26, with or without a time.
const FIGURES_DATE = /^\s*(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?\s*$/;

/**
 * How to read the time column. A date in figures reads two ways: 03/04/2026 is 3 April or 4 March.
 * The log settles it when one value has a day above 12. When no value does, the owner settles it
 * with --date-order, and until then nothing is counted. No date is ever guessed.
 */
export function timeReader(values, column, order) {
  if (order !== undefined && !['dmy', 'mdy'].includes(order)) throw new Error('Give --date-order as dmy, for day first, or mdy, for month first.');
  const figures = values.map((value) => FIGURES_DATE.exec(value)).filter(Boolean);
  let reads = order;
  let note;
  if (figures.length) {
    const dayFirst = figures.some((match) => Number(match[1]) > 12);
    const monthFirst = figures.some((match) => Number(match[3]) > 12);
    const sample = figures[0][0].trim();
    if (dayFirst && monthFirst) throw new Error(`The dates in "${column}" are written two ways: some put the day first and some the month. The script cannot read them as one log.`);
    const shown = dayFirst ? 'dmy' : monthFirst ? 'mdy' : undefined;
    if (order && shown && order !== shown) throw new Error(`--date-order ${order} does not fit the dates in "${column}": some have ${shown === 'dmy' ? 'a day' : 'a month'} above 12 in the ${shown === 'dmy' ? 'first' : 'second'} place.`);
    reads = order ?? shown;
    if (!reads) throw new Error(`The dates in "${column}" are written like ${sample}, which reads two ways: day first or month first. Ask the owner, then say which with --date-order dmy or --date-order mdy.`);
    note = order
      ? `dates like ${sample} are read ${reads === 'dmy' ? 'day first' : 'month first'}, as --date-order says`
      : `dates like ${sample} are read ${reads === 'dmy' ? 'day first' : 'month first'}: the log has dates that fit no other reading`;
  }
  const read = (value) => {
    const match = FIGURES_DATE.exec(value);
    if (!match) return Date.parse(value);
    const [, a, , b, y, hh = '0', mm = '0', ss = '0', half] = match;
    const date = Number(reads === 'dmy' ? a : b);
    const month = Number(reads === 'dmy' ? b : a);
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const hour = half ? (Number(hh) % 12) + (/p/i.test(half) ? 12 : 0) : Number(hh);
    if (month < 1 || month > 12 || date < 1 || date > 31 || hour > 23 || Number(mm) > 59) return NaN;
    const at = Date.UTC(year, month - 1, date, hour, Number(mm), Number(ss));
    return new Date(at).getUTCMonth() === month - 1 ? at : NaN; // 31/02 is no date
  };
  return { read, note };
}

// Where each row's time is kept once it has been read.
const AT = Symbol('at');

/** Reads the file into rows, checks the columns that are named, and reads every time once. */
function readLog(csv, map, needs, optionals) {
  const delimiter = delimiterOf(csv);
  const [head = [], ...lines] = parseCsv(csv, delimiter);
  if (!head.length) throw new Error('The log is empty.');
  for (const need of needs) {
    if (!map[need]) throw new Error(need === 'step' ? 'The flow needs the column that names each step. Name it with --step.' : `Name the ${need} column with --${need}.`);
    if (!head.includes(map[need])) throw new Error(`The log has no column named "${map[need]}". Its columns are: ${head.join(', ')}.`);
  }
  for (const optional of optionals) {
    if (map[optional] && !head.includes(map[optional])) throw new Error(`The log has no column named "${map[optional]}". Its columns are: ${head.join(', ')}.`);
  }
  const rows = lines.map((cells) => Object.fromEntries(head.map((name, index) => [name, cells[index] ?? ''])));
  if (!rows.length) throw new Error('The log has no rows.');
  const { read, note } = timeReader(rows.map((row) => row[map.time]), map.time, map.dateOrder);
  for (const row of rows) {
    row[AT] = read(row[map.time]);
    if (Number.isNaN(row[AT])) throw new Error(`Some values in "${map.time}" are not dates the script can read, such as "${row[map.time]}". Use a form like 2026-09-01T08:30Z.`);
  }
  // In a file with semicolons or tabs, a figure such as 2,5 is two and a half.
  const figure = (value) => Number(delimiter === ',' ? value : String(value).trim().replace(/^(\d+),(\d+)$/, '$1.$2'));
  return { rows, dateNote: note, figure };
}

/** The values a column holds, the commonest first, for a message that helps put a mapping right. */
function valuesIn(rows, column, limit = 12) {
  const seen = new Map();
  for (const row of rows) seen.set(row[column], (seen.get(row[column]) ?? 0) + 1);
  const ranked = [...seen].sort((a, b) => b[1] - a[1]).map(([value]) => value);
  const near = (wanted) => ranked.find((value) => value !== wanted && value.trim().toLowerCase() === String(wanted).trim().toLowerCase());
  const list = `${ranked.slice(0, limit).map((value) => `"${value}"`).join(', ')}${ranked.length > limit ? ` and ${ranked.length - limit} more` : ''}`;
  return { list, near };
}

const median = (list) => { const sorted = [...list].sort((a, b) => a - b); const mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
const mean = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
/** How many processes one report link carries. The page reads up to this many. */
export const LINK_PROCESSES = 40;

/**
 * `map` names the columns: case, process, time and actor are needed. The rest are optional,
 * and each one that is missing leaves a signal uncounted and listed under `not_in_log`.
 */
export function measureLog(csv, map, { fn, rate, spend, readiness, department, organisation } = {}) {
  if (rate !== undefined && !(Number.isFinite(rate) && rate > 0)) throw new Error('Give the hourly cost as a figure above zero, as in --rate 38.');
  if (spend !== undefined && !(Number.isFinite(spend) && spend >= 0)) throw new Error('Give the yearly spend on tools as a figure of zero or more, as in --spend 12000.');
  if (readiness !== undefined && !READINESS.includes(readiness)) throw new Error(`Give --readiness as one of: ${READINESS.join(', ')}.`);
  const { rows, dateNote, figure } = readLog(csv, map, ['case', 'process', 'time', 'actor'], ['actorType', 'minutes', 'step']);
  const notInLog = [];
  const warnings = [];

  // Which steps a system does. A value or a name that never appears in the log marks nothing:
  // it is said, and the share of automated steps is then not counted. It is never counted as zero.
  const systemActors = new Set((map.systemActors ?? '').split(',').map((name) => name.trim()).filter(Boolean));
  const byType = Boolean(map.actorType && map.systemValue);
  const typeSeen = byType && rows.some((row) => row[map.actorType] === map.systemValue);
  const actorsSeen = [...systemActors].filter((name) => rows.some((row) => row[map.actor] === name));
  const knowsSystems = typeSeen || actorsSeen.length > 0;
  const isSystem = (row) => (byType ? row[map.actorType] === map.systemValue : false) || systemActors.has(row[map.actor]);
  const neverSeen = [];
  if (byType && !typeSeen) {
    const { list, near } = valuesIn(rows, map.actorType);
    neverSeen.push(`the value "${map.systemValue}" never appears in "${map.actorType}". The values there are: ${list}.${near(map.systemValue) ? ` Did you mean "${near(map.systemValue)}"?` : ''}`);
  }
  for (const name of systemActors) {
    if (!actorsSeen.includes(name)) neverSeen.push(`"${name}" is named as a system and never appears in "${map.actor}".`);
  }
  if (knowsSystems) warnings.push(...neverSeen);

  // A blank or unreadable value in the minutes column is not zero work. With any such value on a step a person did,
  // the work time is left uncounted, so no saving is sized from a guess.
  const readable = (value) => String(value).trim() !== '' && Number.isFinite(figure(value)) && figure(value) >= 0;
  const unreadableMinutes = map.minutes ? rows.filter((row) => !isSystem(row) && !readable(row[map.minutes])).length : 0;
  const knowsMinutes = Boolean(map.minutes) && unreadableMinutes === 0;

  // What marks a case that comes back. The same rule: a value that never appears marks nothing.
  const reopenNamed = Boolean(map.step && map.reopenValue);
  const knowsReopen = reopenNamed && rows.some((row) => row[map.step] === map.reopenValue);

  // A loop, so that a log of any length is read. Spreading a long log into Math.max stops the script.
  let earliest = Infinity;
  let latest = -Infinity;
  for (const row of rows) {
    if (row[AT] < earliest) earliest = row[AT];
    if (row[AT] > latest) latest = row[AT];
  }
  const periodDays = Math.max(1, Math.ceil((latest - earliest) / 86_400_000));
  const tooShort = periodDays < MIN_DAYS_TO_PROJECT;

  const byProcess = new Map();
  const processesOfCase = new Map();
  for (const row of rows) {
    const name = row[map.process] || '(no process named)';
    if (!byProcess.has(name)) byProcess.set(name, new Map());
    const cases = byProcess.get(name);
    if (!cases.has(row[map.case])) cases.set(row[map.case], []);
    cases.get(row[map.case]).push(row);
    if (!processesOfCase.has(row[map.case])) processesOfCase.set(row[map.case], new Set());
    processesOfCase.get(row[map.case]).add(name);
  }
  // One row for each case is another kind of log. This script reads one row for each step.
  const groups = [...byProcess.values()].reduce((sum, cases) => sum + cases.size, 0);
  if (groups === rows.length) throw new Error(`Every value in "${map.case}" has one row, so the log gives no time from open to close. The script reads a log with one row for each step of a case. Check that --case names the column that is the same on every step of one case.`);
  // Many cases with a single row is a sign that the case column is the wrong one. It is said, and the count goes on.
  const alone = [...byProcess.values()].reduce((sum, cases) => sum + [...cases.values()].filter((steps) => steps.length === 1).length, 0);
  if (alone * 2 > groups) warnings.push(`${alone} of ${groups} cases have a single row, so their time from open to close is zero. Check that --case names the column that is the same on every step of one case.`);
  const split = [...processesOfCase.values()].filter((names) => names.size > 1).length;
  if (split) warnings.push(`${split} ${split === 1 ? 'case appears' : 'cases appear'} under more than one process in "${map.process}". Each part is counted under its own process, so its time from open to close is cut short.`);

  if (tooShort) notInLog.push(`a year of volume: the log covers ${periodDays} ${periodDays === 1 ? 'day' : 'days'}, and it takes ${MIN_DAYS_TO_PROJECT} to project a year. No process is judged`);
  if (unreadableMinutes) notInLog.push(`minutes of work: ${unreadableMinutes} of ${rows.length} steps have no readable value in "${map.minutes}", so the work time for each case and the share of time spent working are not counted`);
  else if (!knowsMinutes) notInLog.push('minutes of work on each step, so the work time for each case and the share of time spent working are not counted');
  if (!knowsSystems) notInLog.push(neverSeen.length ? `which steps a system does: ${neverSeen.join(' ')} The share of automated steps is not counted` : 'which steps a system does, so the share of automated steps is not counted');
  if (reopenNamed && !knowsReopen) {
    const { list, near } = valuesIn(rows, map.step);
    notInLog.push(`cases that come back: the value "${map.reopenValue}" never appears in "${map.step}". The values there are: ${list}.${near(map.reopenValue) ? ` Did you mean "${near(map.reopenValue)}"?` : ''} The share of reworked cases is not counted`);
  } else if (!knowsReopen) notInLog.push('what marks a case that comes back, so the share of reworked cases is not counted');
  if (rate === undefined) notInLog.push('the hourly cost of the team, with salary and overheads');
  if (spend === undefined) notInLog.push('the yearly spend on tools for each process: counted as zero');

  // The engine takes nine signals. Volume, time from open to close and people on a case always come from the log.
  const counted = 3 + (knowsMinutes ? 2 : 0) + (knowsSystems ? 1 : 0) + (knowsReopen ? 1 : 0) + (rate !== undefined ? 1 : 0) + (spend !== undefined ? 1 : 0);
  const complete = knowsMinutes && knowsSystems && knowsReopen;

  const processes = [...byProcess].map(([name, cases]) => {
    const perCase = [...cases.values()].map((steps) => {
      let first = Infinity;
      let last = -Infinity;
      for (const step of steps) { if (step[AT] < first) first = step[AT]; if (step[AT] > last) last = step[AT]; }
      const elapsed = (last - first) / 60_000; // one case's steps, never the whole log
      const worked = knowsMinutes ? steps.reduce((sum, step) => sum + (figure(step[map.minutes]) || 0), 0) : 0;
      // A case that runs past one working day is counted at eight working hours a day.
      const working = Math.max(worked, elapsed > 480 ? elapsed / 3 : elapsed);
      return {
        elapsedDays: elapsed / 1440, worked, working,
        people: new Set(steps.filter((step) => !isSystem(step)).map((step) => step[map.actor])).size,
        reopened: knowsReopen && steps.some((step) => step[map.step] === map.reopenValue),
      };
    });
    const steps = [...cases.values()].flat();
    // Below either floor there is no yearly volume: the process is counted and not judged.
    const small = perCase.length < MIN_CASES_TO_JUDGE;
    const signals = {
      ...(tooShort || small ? {} : { instances_per_year: Math.round(perCase.length * 365 / periodDays) }),
      cycle_time_days: round(median(perCase.map((item) => item.elapsedDays))),
      handoffs: median(perCase.map((item) => item.people)),
      ...(knowsMinutes ? {
        fte_hours_per_instance: round(mean(perCase.map((item) => item.worked)) / 60),
        touch_ratio: round(perCase.reduce((sum, item) => sum + item.worked, 0) / Math.max(1, perCase.reduce((sum, item) => sum + item.working, 0))),
      } : {}),
      ...(knowsReopen ? { rework_rate: round(perCase.filter((item) => item.reopened).length / perCase.length) } : {}),
      ...(knowsSystems ? { automation_level: round(steps.filter(isSystem).length / steps.length) } : {}),
    };
    const notJudged = tooShort ? `the log covers ${periodDays} ${periodDays === 1 ? 'day' : 'days'}, and it takes ${MIN_DAYS_TO_PROJECT} to project a year`
      : small ? `${perCase.length} ${perCase.length === 1 ? 'case' : 'cases'} in the log, and it takes ${MIN_CASES_TO_JUDGE} to judge a process`
      : complete && !(signals.fte_hours_per_instance > 0) ? 'no work time is recorded for this process, so there is no baseline to size a saving against'
      : undefined;
    return {
      name,
      cases_in_log: perCase.length,
      counted: signals,
      ...(notJudged ? { not_judged: notJudged } : {}),
      // Ready for diagnose_process only when every signal the engine needs was counted. Pass it on unchanged.
      diagnose_process: complete && !notJudged ? {
        process_id: name, ...(fn ? { function: fn } : {}), ...signals,
        loaded_hourly_rate_eur: rate ?? 1, direct_spend_eur: spend ?? 0,
        signal_completeness: round(counted / 9),
        ...(readiness ? { readiness } : {}),
      } : null,
    };
  });

  // The full report as one link to read or forward. It carries the counts for each process and no row of the log.
  // The page at that address runs the published engine on the counts, in the reader's browser. Nothing is stored.
  const first = new Date(earliest).toISOString().slice(0, 10);
  const last = new Date(latest).toISOString().slice(0, 10);
  // The link holds the largest processes by volume, up to a set number, and says how many it leaves out.
  const judged = processes.filter((item) => item.diagnose_process).sort((a, b) => b.cases_in_log - a.cases_in_log);
  const inLink = judged.slice(0, LINK_PROCESSES);
  const omitted = judged.length - inLink.length;
  // The processes that were counted and not judged travel too, by name and number of cases, so that the page can list them.
  const unjudged = processes.filter((item) => item.not_judged).sort((a, b) => b.cases_in_log - a.cases_in_log);
  const linked = complete && fn && inLink.length ? {
    v: 1, k: 'dd', n: String(department ?? '').slice(0, 80), o: String(organisation ?? '').slice(0, 80), f: first, l: last,
    c: new Set(rows.map((row) => row[map.case])).size, t: rows.length, fn, r: rate ?? null,
    ...(omitted ? { x: omitted } : {}),
    p: inLink.map((item) => [item.name.slice(0, 120), item.counted.instances_per_year, item.counted.fte_hours_per_instance, item.counted.cycle_time_days,
      item.counted.touch_ratio, item.counted.handoffs, item.counted.rework_rate, item.counted.automation_level, round(counted / 9)]),
    // Added beside the rows, so that a page that does not know these fields still reads the link.
    d: periodDays,
    cs: inLink.map((item) => item.cases_in_log),
    ...(unjudged.length ? { u: unjudged.slice(0, LINK_PROCESSES).map((item) => [item.name.slice(0, 120), item.cases_in_log]) } : {}),
    ...(unjudged.length > LINK_PROCESSES ? { ux: unjudged.length - LINK_PROCESSES } : {}),
    ...(readiness ? { rd: readiness } : {}),
    ...(spend !== undefined ? { sp: spend } : {}),
  } : null;

  // What the counts assume. A report prints these lines with the savings, as they are.
  const assumptions = [
    ...(tooShort ? [] : [`a year of volume is projected from the log: the cases counted, times 365, divided by the ${periodDays} days the log covers. Seasons are not in it`]),
    `a process is judged with ${MIN_CASES_TO_JUDGE} cases or more in the log, and a log that covers ${MIN_DAYS_TO_PROJECT} days or more. Below that it is counted and not judged`,
    ...(knowsMinutes ? ['the share of time spent working counts a case that runs past one working day at eight working hours a day'] : []),
    ...(dateNote ? [dateNote] : []),
    ...(rate !== undefined ? [`the hourly cost of €${rate} is the owner's figure. It is not in the log`] : []),
    ...(readiness ? [`readiness to change is ${readiness}, as the owner said`] : ['readiness to change was not asked, so the tool uses its default, traditional. Pass --readiness when the owner states it']),
  ];

  return {
    report_url: linked ? `https://www.aibvf.com/deep-dive#${Buffer.from(JSON.stringify(linked)).toString('base64url')}` : null,
    report_leaves_out: linked ? omitted : 0,
    period: { first, last, days: periodDays },
    cases: new Set(rows.map((row) => row[map.case])).size,
    steps: rows.length,
    euro_figures: rate !== undefined && complete && judged.length > 0,
    not_in_log: notInLog,
    warnings,
    assumptions,
    processes,
  };
}

/** How many step orders, and how many steps, one flow lists. The rest are counted and named as left out. */
export const FLOW_ORDERS = 5;
export const FLOW_STEPS = 20;

/**
 * The flow of one process, counted: the orders its steps come in, and for each step who does it and
 * how long after the step before. A draft quotes these counts. No person is named: people are counted.
 */
export function measureFlow(csv, map, processName) {
  const { rows: all, figure } = readLog(csv, map, ['case', 'process', 'time', 'actor', 'step'], ['actorType', 'minutes']);
  const rows = all.filter((row) => row[map.process] === processName);
  if (!rows.length) {
    const names = [...new Set(all.map((row) => row[map.process]))].slice(0, 40);
    throw new Error(`The log has no process named "${processName}". Its processes are: ${names.join(', ')}.`);
  }
  const systemActors = new Set((map.systemActors ?? '').split(',').map((name) => name.trim()).filter(Boolean));
  const knowsSystems = Boolean(map.actorType && map.systemValue) || systemActors.size > 0;
  const isSystem = (row) => (map.actorType && map.systemValue ? row[map.actorType] === map.systemValue : false) || systemActors.has(row[map.actor]);
  const readable = (value) => String(value).trim() !== '' && Number.isFinite(figure(value)) && figure(value) >= 0;

  const cases = new Map();
  for (const row of rows) {
    const at = row[AT];
    if (!cases.has(row[map.case])) cases.set(row[map.case], []);
    cases.get(row[map.case]).push({ row, at, position: cases.get(row[map.case]).length });
  }
  // Each case in time order. Steps with the same time keep the order they have in the log.
  for (const steps of cases.values()) steps.sort((a, b) => a.at - b.at || a.position - b.position);

  const orders = new Map();
  const perStep = new Map();
  for (const steps of cases.values()) {
    const key = JSON.stringify(steps.map((step) => step.row[map.step]));
    orders.set(key, (orders.get(key) ?? 0) + 1);
    const seen = new Set();
    steps.forEach((step, index) => {
      const name = step.row[map.step];
      if (!perStep.has(name)) perStep.set(name, { first: index, cases: 0, times: 0, bySystem: 0, systems: new Map(), people: new Set(), gaps: [], minutes: [], unreadable: 0 });
      const entry = perStep.get(name);
      entry.times += 1;
      entry.first = Math.min(entry.first, index);
      if (!seen.has(name)) { entry.cases += 1; seen.add(name); }
      if (knowsSystems && isSystem(step.row)) {
        entry.bySystem += 1;
        entry.systems.set(step.row[map.actor], (entry.systems.get(step.row[map.actor]) ?? 0) + 1);
      } else {
        entry.people.add(step.row[map.actor]);
        if (map.minutes) { if (readable(step.row[map.minutes])) entry.minutes.push(figure(step.row[map.minutes])); else entry.unreadable += 1; }
      }
      if (index > 0) entry.gaps.push((step.at - steps[index - 1].at) / 3_600_000);
    });
  }

  const total = cases.size;
  const ranked = [...orders].sort((a, b) => b[1] - a[1]);
  const steps = [...perStep].sort((a, b) => a[1].first - b[1].first || b[1].cases - a[1].cases);
  return {
    process: processName,
    cases_in_log: total,
    // The orders the steps come in, the commonest first. `share` is the share of this process's cases.
    // Three places, so that shares rounded one by one still add up: 105 and 95 of 200 are 0.525 and 0.475.
    orders: ranked.slice(0, FLOW_ORDERS).map(([key, count]) => ({ steps: JSON.parse(key), cases: count, share: round(count / total, 3) })),
    orders_left_out: Math.max(0, ranked.length - FLOW_ORDERS),
    cases_in_orders_left_out: ranked.slice(FLOW_ORDERS).reduce((sum, [, count]) => sum + count, 0),
    // Each step, in the order it first appears in a case.
    steps: steps.slice(0, FLOW_STEPS).map(([name, entry]) => ({
      step: name,
      in_cases: entry.cases,
      share_of_cases: round(entry.cases / total),
      done_by: !knowsSystems ? 'not in the log' : entry.bySystem === entry.times ? 'a system' : entry.bySystem === 0 ? 'a person' : 'a system or a person',
      ...(knowsSystems && entry.systems.size ? { systems: [...entry.systems].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([actor]) => actor) } : {}),
      ...(!knowsSystems || entry.bySystem < entry.times ? { people_who_did_it: entry.people.size } : {}),
      ...(entry.gaps.length ? { median_hours_after_the_step_before: round(median(entry.gaps), 1) } : {}),
      ...(entry.minutes.length && !entry.unreadable ? { median_minutes_of_work: round(median(entry.minutes), 1) } : {}),
    })),
    steps_left_out: Math.max(0, steps.length - FLOW_STEPS),
    not_in_log: [
      ...(knowsSystems ? [] : ['which steps a system does']),
      ...(map.minutes ? [] : ['minutes of work on each step']),
      'why a case takes one order and not another: the log records what happened, not the reason',
    ],
  };
}

// Run as a command, on any system: a Windows path, or a folder name with a space, has to become a file address first.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const number = (name) => (flag(name) === undefined ? undefined : Number(flag(name)));
  try {
    if (!args[0] || args[0].startsWith('--')) throw new Error('Give the log file first: node measure.mjs log.csv --case ... --process ... --time ... --actor ...');
    const map = {
      case: flag('--case'), process: flag('--process'), time: flag('--time'), actor: flag('--actor'),
      actorType: flag('--actor-type'), systemValue: flag('--system-value'), systemActors: flag('--system-actors'),
      minutes: flag('--minutes'), step: flag('--step'), reopenValue: flag('--reopen-value'), dateOrder: flag('--date-order'),
    };
    const csv = await readFile(args[0], 'utf8');
    // With --flow and the name of one process, print that process's flow in place of the counts.
    const result = flag('--flow') !== undefined
      ? measureFlow(csv, map, flag('--flow'))
      : measureLog(csv, map, { fn: flag('--function'), rate: number('--rate'), spend: number('--spend'), readiness: flag('--readiness'), department: flag('--department'), organisation: flag('--organisation') });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
