#!/usr/bin/env node
// Counts one department's system log, process by process. Code counts. No model, no judgement.
// The rows stay on this computer. Only the counts this script prints go to the AI BVF tool.
//
//   node measure.mjs log.csv --case case_id --process category --time timestamp --actor actor \
//     [--actor-type actor_type --system-value system] [--system-actors "Web form,Order system"] \
//     [--minutes minutes_worked] [--step step --reopen-value Reopened] \
//     [--function cx] [--rate 38] [--spend 0] [--department "Service desk"] [--organisation "Halden & Co"]
//
// One row is one step of one case. Prints JSON: what was counted, what was not in the log,
// and for each process the arguments for diagnose_process, to pass on unchanged.
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { pathToFileURL } from 'node:url';

/** A small CSV reader: quoted cells, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text) {
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
    else if (char === ',') { row.push(cell); cell = ''; } else if (char === '\n' || char === '\r') {
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

const median = (list) => { const sorted = [...list].sort((a, b) => a - b); const mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
const mean = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
/** How many processes one report link carries. The page reads up to this many. */
export const LINK_PROCESSES = 40;

/**
 * `map` names the columns: case, process, time and actor are needed. The rest are optional,
 * and each one that is missing leaves a signal uncounted and listed under `not_in_log`.
 */
export function measureLog(csv, map, { fn, rate, spend, department, organisation } = {}) {
  const [head, ...lines] = parseCsv(csv);
  for (const need of ['case', 'process', 'time', 'actor']) {
    if (!map[need]) throw new Error(`Name the ${need} column with --${need}.`);
    if (!head.includes(map[need])) throw new Error(`The log has no column named "${map[need]}". Its columns are: ${head.join(', ')}.`);
  }
  for (const optional of ['actorType', 'minutes', 'step']) {
    if (map[optional] && !head.includes(map[optional])) throw new Error(`The log has no column named "${map[optional]}". Its columns are: ${head.join(', ')}.`);
  }
  const rows = lines.map((cells) => Object.fromEntries(head.map((name, index) => [name, cells[index] ?? ''])));
  const systemActors = new Set((map.systemActors ?? '').split(',').map((name) => name.trim()).filter(Boolean));
  const knowsSystems = Boolean(map.actorType && map.systemValue) || systemActors.size > 0;
  const isSystem = (row) => (map.actorType && map.systemValue ? row[map.actorType] === map.systemValue : false) || systemActors.has(row[map.actor]);
  // A blank or unreadable value in the minutes column is not zero work. With any such value on a step a person did,
  // the work time is left uncounted, so no saving is sized from a guess.
  const readable = (value) => String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
  const unreadableMinutes = map.minutes ? rows.filter((row) => !isSystem(row) && !readable(row[map.minutes])).length : 0;
  const knowsMinutes = Boolean(map.minutes) && unreadableMinutes === 0;
  const knowsReopen = Boolean(map.step && map.reopenValue);

  // A loop, so that a log of any length is read. Spreading a long log into Math.max stops the script.
  let earliest = Infinity;
  let latest = -Infinity;
  for (const row of rows) {
    const at = Date.parse(row[map.time]);
    if (Number.isNaN(at)) throw new Error(`Some values in "${map.time}" are not dates the script can read. Use a form like 2026-09-01T08:30Z.`);
    if (at < earliest) earliest = at;
    if (at > latest) latest = at;
  }
  if (!rows.length) throw new Error('The log has no rows.');
  const periodDays = Math.max(1, Math.ceil((latest - earliest) / 86_400_000));

  const byProcess = new Map();
  for (const row of rows) {
    const name = row[map.process] || '(no process named)';
    if (!byProcess.has(name)) byProcess.set(name, new Map());
    const cases = byProcess.get(name);
    if (!cases.has(row[map.case])) cases.set(row[map.case], []);
    cases.get(row[map.case]).push(row);
  }

  const notInLog = [];
  if (unreadableMinutes) notInLog.push(`minutes of work: ${unreadableMinutes} of ${rows.length} steps have no readable value in "${map.minutes}", so the work time for each case and the share of time spent working are not counted`);
  else if (!knowsMinutes) notInLog.push('minutes of work on each step, so the work time for each case and the share of time spent working are not counted');
  if (!knowsSystems) notInLog.push('which steps a system does, so the share of automated steps is not counted');
  if (!knowsReopen) notInLog.push('what marks a case that comes back, so the share of reworked cases is not counted');
  if (rate === undefined) notInLog.push('the hourly cost of the team, with salary and overheads');
  if (spend === undefined) notInLog.push('the yearly spend on tools for each process: counted as zero');

  // The engine takes nine signals. Volume, time from open to close and people on a case always come from the log.
  const counted = 3 + (knowsMinutes ? 2 : 0) + (knowsSystems ? 1 : 0) + (knowsReopen ? 1 : 0) + (rate !== undefined ? 1 : 0) + (spend !== undefined ? 1 : 0);
  const complete = knowsMinutes && knowsSystems && knowsReopen;

  const processes = [...byProcess].map(([name, cases]) => {
    const perCase = [...cases.values()].map((steps) => {
      const at = steps.map((step) => Date.parse(step[map.time]));
      const elapsed = (Math.max(...at) - Math.min(...at)) / 60_000; // one case's steps, never the whole log
      const worked = knowsMinutes ? steps.reduce((sum, step) => sum + (Number(step[map.minutes]) || 0), 0) : 0;
      // A case that runs past one working day is counted at eight working hours a day.
      const working = Math.max(worked, elapsed > 480 ? elapsed / 3 : elapsed);
      return {
        elapsedDays: elapsed / 1440, worked, working,
        people: new Set(steps.filter((step) => !isSystem(step)).map((step) => step[map.actor])).size,
        reopened: knowsReopen && steps.some((step) => step[map.step] === map.reopenValue),
      };
    });
    const steps = [...cases.values()].flat();
    const signals = {
      instances_per_year: Math.round(perCase.length * 365 / periodDays),
      cycle_time_days: round(median(perCase.map((item) => item.elapsedDays))),
      handoffs: median(perCase.map((item) => item.people)),
      ...(knowsMinutes ? {
        fte_hours_per_instance: round(mean(perCase.map((item) => item.worked)) / 60),
        touch_ratio: round(perCase.reduce((sum, item) => sum + item.worked, 0) / Math.max(1, perCase.reduce((sum, item) => sum + item.working, 0))),
      } : {}),
      ...(knowsReopen ? { rework_rate: round(perCase.filter((item) => item.reopened).length / perCase.length) } : {}),
      ...(knowsSystems ? { automation_level: round(steps.filter(isSystem).length / steps.length) } : {}),
    };
    return {
      name,
      cases_in_log: perCase.length,
      counted: signals,
      // Ready for diagnose_process only when every signal the engine needs was counted. Pass it on unchanged.
      ...(complete && !(signals.fte_hours_per_instance > 0) ? { not_judged: 'no work time is recorded for this process, so there is no baseline to size a saving against' } : {}),
      diagnose_process: complete && signals.fte_hours_per_instance > 0 ? {
        process_id: name, ...(fn ? { function: fn } : {}), ...signals,
        loaded_hourly_rate_eur: rate ?? 1, direct_spend_eur: spend ?? 0,
        signal_completeness: round(counted / 9),
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
  const omitted = processes.length - inLink.length;
  const linked = complete && fn && inLink.length ? {
    v: 1, k: 'dd', n: String(department ?? '').slice(0, 80), o: String(organisation ?? '').slice(0, 80), f: first, l: last,
    c: new Set(rows.map((row) => row[map.case])).size, t: rows.length, fn, r: rate ?? null,
    ...(omitted ? { x: omitted } : {}),
    p: inLink.map((item) => [item.name.slice(0, 120), item.counted.instances_per_year, item.counted.fte_hours_per_instance, item.counted.cycle_time_days,
      item.counted.touch_ratio, item.counted.handoffs, item.counted.rework_rate, item.counted.automation_level, round(counted / 9)]),
  } : null;

  return {
    report_url: linked ? `https://www.aibvf.com/deep-dive#${Buffer.from(JSON.stringify(linked)).toString('base64url')}` : null,
    report_leaves_out: linked ? omitted : 0,
    period: { first, last, days: periodDays },
    cases: new Set(rows.map((row) => row[map.case])).size,
    steps: rows.length,
    euro_figures: rate !== undefined && complete,
    not_in_log: notInLog,
    processes,
  };
}

// Run as a command, on any system: a Windows path, or a folder name with a space, has to become a file address first.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const number = (name) => (flag(name) === undefined ? undefined : Number(flag(name)));
  try {
    if (!args[0] || args[0].startsWith('--')) throw new Error('Give the log file first: node measure.mjs log.csv --case ... --process ... --time ... --actor ...');
    const result = measureLog(await readFile(args[0], 'utf8'), {
      case: flag('--case'), process: flag('--process'), time: flag('--time'), actor: flag('--actor'),
      actorType: flag('--actor-type'), systemValue: flag('--system-value'), systemActors: flag('--system-actors'),
      minutes: flag('--minutes'), step: flag('--step'), reopenValue: flag('--reopen-value'),
    }, { fn: flag('--function'), rate: number('--rate'), spend: number('--spend'), department: flag('--department'), organisation: flag('--organisation') });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
