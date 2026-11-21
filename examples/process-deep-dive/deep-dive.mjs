#!/usr/bin/env node
// A deep dive into one department, from its system log.
//
//   node examples/process-deep-dive/deep-dive.mjs                 the report before the owner has given the hourly cost
//   node examples/process-deep-dive/deep-dive.mjs --rate 38       the report with euro figures
//   node examples/process-deep-dive/deep-dive.mjs --rate 38 --write   also writes report.md, report-before-rate.md and signals.json
//
// Three parts, kept apart on purpose:
//   1. measure()  code counts the log. No model, no judgement.
//   2. diagnoseProcess()  the published engine in @aibvf/core picks the intervention and sizes the saving.
//   3. report()   the words. Every figure in it comes from 1 or 2.
import { readFile, writeFile } from 'node:fs/promises';
import { diagnoseProcess } from '../../packages/js/dist/index.js';

const here = (name) => new URL(name, import.meta.url);
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const median = (list) => { const sorted = [...list].sort((a, b) => a - b); const mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
const mean = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

/** 1. Count the log. One row is one step of one case. */
export function measure(csv) {
  const [head, ...lines] = csv.trim().split('\n').map((line) => line.split(','));
  const rows = lines.map((cells) => Object.fromEntries(head.map((name, index) => [name, cells[index]])));
  const times = rows.map((row) => Date.parse(row.timestamp));
  const periodDays = Math.max(1, Math.ceil((Math.max(...times) - Math.min(...times)) / 86_400_000));
  const byProcess = new Map();
  for (const row of rows) {
    if (!byProcess.has(row.category)) byProcess.set(row.category, new Map());
    const cases = byProcess.get(row.category);
    if (!cases.has(row.case_id)) cases.set(row.case_id, []);
    cases.get(row.case_id).push(row);
  }
  const processes = [...byProcess].map(([name, cases]) => {
    const perCase = [...cases.values()].map((steps) => {
      const at = steps.map((step) => Date.parse(step.timestamp));
      const elapsed = (Math.max(...at) - Math.min(...at)) / 60_000;
      const worked = steps.reduce((sum, step) => sum + Number(step.minutes_worked), 0);
      // A case that runs past one working day is counted at eight working hours a day.
      const working = Math.max(worked, elapsed > 480 ? elapsed / 3 : elapsed);
      return {
        elapsedDays: elapsed / 1440, worked, working,
        people: new Set(steps.filter((step) => step.actor_type === 'person').map((step) => step.actor)).size,
        reopened: steps.some((step) => step.step === 'Reopened'),
      };
    });
    const steps = [...cases.values()].flat();
    const people = steps.filter((step) => step.actor_type === 'person');
    const workedTotal = people.reduce((sum, step) => sum + Number(step.minutes_worked), 0);
    return {
      name,
      cases_in_log: perCase.length,
      instances_per_year: Math.round(perCase.length * 365 / periodDays),
      fte_hours_per_instance: round(mean(perCase.map((item) => item.worked)) / 60),
      cycle_time_days: round(median(perCase.map((item) => item.elapsedDays))),
      touch_ratio: round(perCase.reduce((sum, item) => sum + item.worked, 0) / perCase.reduce((sum, item) => sum + item.working, 0)),
      handoffs: median(perCase.map((item) => item.people)),
      rework_rate: round(perCase.filter((item) => item.reopened).length / perCase.length),
      automation_level: round(steps.filter((step) => step.actor_type === 'system').length / steps.length),
      // Not an engine input: the share of handling time spent reading or writing free text. Kept for the second judgement, after a redesign.
      text_share: workedTotal ? round(people.filter((step) => step.input === 'text').reduce((sum, step) => sum + Number(step.minutes_worked), 0) / workedTotal) : 0,
    };
  });
  return { period_days: periodDays, cases: new Set(rows.map((row) => row.case_id)).size, steps: rows.length, first: new Date(Math.min(...times)).toISOString().slice(0, 10), last: new Date(Math.max(...times)).toISOString().slice(0, 10), processes };
}

/** 2. Ask the engine. Seven signals come from the log. The hourly cost comes from the owner. Tool spend was not found and counts as zero. */
export function judge(measured, { rate, fn = 'cx' } = {}) {
  const measuredCount = 7 + (rate ? 1 : 0);
  return measured.processes.map((item) => {
    const verdict = diagnoseProcess({
      process_id: item.name, function: fn,
      instances_per_year: item.instances_per_year, fte_hours_per_instance: item.fte_hours_per_instance,
      // With no hourly cost the engine still picks the intervention. Its euro figures are then dropped.
      loaded_hourly_rate_eur: rate ?? 1,
      cycle_time_days: item.cycle_time_days, touch_ratio: item.touch_ratio, handoffs: item.handoffs,
      rework_rate: item.rework_rate, automation_level: item.automation_level, direct_spend_eur: 0,
      signal_completeness: round(measuredCount / 9),
    });
    return { ...item, verdict, sized: Boolean(rate) };
  }).sort((a, b) => b.verdict.net_saving_high_eur - a.verdict.net_saving_high_eur);
}

const DRAG = { manual: 'manual work', handoffs: 'hand-offs', wait: 'waiting', rework: 'work that comes back', cycle: 'the time from open to close' };
const HOW = {
  'Automate': 'Take the repeated manual steps out. A rule or a workflow does the step that is the same every time, and a person handles the exceptions.',
  'Consolidate & re-sequence': 'Redesign the flow before any AI. Cut the hand-offs: give one role the right to decide, and run the checks side by side.',
  'Quality controls': 'Stop the error where it starts. Check the input when it arrives, so that the case does not come back.',
  'Eliminate / insource': 'Stop running it as its own process. Fold it into the process next to it, or give it whole to the one team that owns the outcome.',
};
const euro = (value) => `€${Math.round(value).toLocaleString('en-GB')}`;
const percent = (value) => `${Math.round(value * 100)} percent`;
const day = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** 3. The words. */
export function report(measured, judged, { department, organisation, rate }) {
  const lines = [
    `AI BVF deep dive: ${department}, ${organisation}`,
    '',
    `Source: the ticket log from ${day(measured.first)} to ${day(measured.last)}. ${measured.cases} cases, ${measured.steps.toLocaleString('en-GB')} steps.`,
    `This is what I found: ${judged.length} processes. Fixed published rules chose each recommendation and sized each saving. Directional, not audited.`,
  ];
  judged.forEach((item, index) => {
    const { verdict } = item;
    const heaviest = Object.entries(verdict.drag_decomposition).sort((a, b) => b[1] - a[1])[0];
    const leave = verdict.verdict === 'Stop';
    lines.push('', `${index + 1}. ${item.name}`);
    const minutes = Math.round(item.fte_hours_per_instance * 60);
    const touched = item.handoffs === 0 ? 'Most cases are touched by nobody' : item.handoffs === 1 ? '1 person touches a case' : `${item.handoffs} people touch a case`;
    lines.push(`   Found: ${item.instances_per_year.toLocaleString('en-GB')} a year. ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} of work each. ${item.cycle_time_days} days from open to close. ${touched}. ${percent(item.rework_rate)} come back. A system does ${percent(item.automation_level)} of the steps.`);
    if (leave) {
      lines.push('   Do: leave it. It is light already, and a change would save too little to matter.');
      return;
    }
    lines.push(`   Do: ${verdict.intervention}.`);
    lines.push(verdict.intervention === 'Eliminate / insource'
      ? `   Why: it is rare and heavy. It runs ${item.instances_per_year} times a year and scores ${verdict.heaviness} of 100 for heaviness.`
      : `   Why: ${DRAG[heaviest[0]]} is the largest part of what makes it heavy, at ${percent(heaviest[1])}.`);
    lines.push(`   How: ${HOW[verdict.intervention]}`);
    lines.push(item.sized
      ? `   Saves: ${euro(verdict.net_saving_low_eur)}–${Math.round(verdict.net_saving_high_eur).toLocaleString('en-GB')} a year of ${euro(verdict.baseline_cost_eur)}, about ${verdict.efficiency_gain_pct} percent of the effort. Confidence ${verdict.decision_confidence}.`
      : `   Saves: about ${verdict.efficiency_gain_pct} percent of the effort. No euro figure yet: the hourly cost of this team is not in the log.`);
    lines.push('   Would you like me to draft it?');
  });
  lines.push('', 'GenAI comes second. I recommend it for a process only after that process has been redesigned and judged again.');
  lines.push('');
  lines.push(rate
    ? `Not in the log: the hourly cost, which you gave as ${euro(rate)}, and the yearly spend on tools for each process, which is counted as zero.`
    : 'One question, asked once: what does an hour of this team cost, with salary and overheads? With that number I can size each saving.');
  return `${lines.join('\n')}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const measured = measure(await readFile(here('halden-service-desk/tickets.csv'), 'utf8'));
  const about = { department: 'customer service desk', organisation: 'Halden & Co' };
  const rate = flag('--rate') ? Number(flag('--rate')) : undefined;
  const text = report(measured, judge(measured, { rate }), { ...about, rate });
  if (args.includes('--write')) {
    await writeFile(here('signals.json'), `${JSON.stringify(measured, null, 2)}\n`);
    await writeFile(here('report-before-rate.md'), report(measured, judge(measured), about));
    if (rate) await writeFile(here('report.md'), text);
  }
  process.stdout.write(text);
}
