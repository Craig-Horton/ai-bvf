#!/usr/bin/env node
// Writes the made-up ticket log this example reads: 30 days at the service desk of
// Halden & Co, a made-up retailer. The same seed gives the same file every time.
//
//   node examples/process-deep-dive/make-log.mjs
import { writeFile } from 'node:fs/promises';

let seed = 20260901;
function random() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (low, high) => low + random() * (high - low);
const pick = (list) => list[Math.floor(random() * list.length)];

const AGENTS = ['Ana', 'Bram', 'Chloe', 'Deniz', 'Eli', 'Femi'];
const LEADS = ['Lea (team lead)', 'Marc (team lead)'];
const FINANCE = ['Nora (finance)', 'Omar (finance)'];
const BUYERS = ['Pia (buying)', 'Ravi (buying)'];
const WAREHOUSE = ['Sven (warehouse)', 'Tess (warehouse)'];

// Each process: how many cases in the 30 days, and the steps a case goes through.
// A step is [name, who, minutes of work, hours of waiting before it, kind of input].
const PROCESSES = [
  { name: 'Order status query', cases: 300, reopen: 0.03, steps: () => {
    const agent = pick(AGENTS);
    return [['Received', 'Service desk system', 0, 0, 'system'], ['Looked up the order', agent, between(2, 4), between(0.3, 3), 'form'], ['Replied', agent, between(2, 4), 0, 'form']];
  } },
  { name: 'Delivery complaint', cases: 150, reopen: 0.18, steps: () => {
    const agent = pick(AGENTS);
    return [['Received', 'Service desk system', 0, 0, 'system'], ['Read the complaint', agent, between(6, 10), between(1, 6), 'text'],
      ['Checked the delivery', pick(WAREHOUSE), between(4, 8), between(4, 10), 'form'], ['Wrote the reply', agent, between(10, 16), between(1, 5), 'text']];
  } },
  { name: 'Refund request', cases: 120, reopen: 0.08, steps: () => {
    const agent = pick(AGENTS);
    return [['Received', 'Service desk system', 0, 0, 'system'], ['Checked the order', agent, between(5, 8), between(2, 8), 'form'],
      ['Approved', pick(LEADS), between(3, 6), between(14, 30), 'form'], ['Checked the amount', pick(FINANCE), between(5, 9), between(16, 40), 'form'],
      ['Paid', 'Payment system', 0, between(2, 6), 'system'], ['Told the customer', agent, between(3, 5), between(1, 4), 'form']];
  } },
  { name: 'Address change', cases: 200, reopen: 0.5, steps: () =>
    [['Received', 'Web form', 0, 0, 'system'], ['Applied', 'Order system', 0, 0.02, 'system'], ['Checked', pick(AGENTS), between(8, 12), 0.1, 'form'], ['Confirmed', 'Order system', 0, 0.02, 'system']] },
  { name: 'Supplier claim', cases: 12, reopen: 0.3, steps: () => {
    const agent = pick(AGENTS);
    return [['Opened', agent, between(20, 30), 0, 'text'], ['Photos gathered', pick(WAREHOUSE), between(30, 45), between(20, 40), 'form'],
      ['Claim written', pick(BUYERS), between(60, 90), between(30, 60), 'text'], ['Approved', pick(LEADS), between(10, 20), between(20, 50), 'form'],
      ['Credit checked', pick(FINANCE), between(30, 45), between(60, 120), 'form'], ['Closed', agent, between(10, 15), between(10, 30), 'form']];
  } },
  { name: 'Invoice copy request', cases: 100, reopen: 0.02, steps: () =>
    [['Received', 'Web form', 0, 0, 'system'], ['Invoice found', 'Finance system', 0, 0.02, 'system'], ['Sent', 'Finance system', 0, 0.02, 'system'],
      ...(random() < 0.3 ? [['Checked', pick(AGENTS), between(1, 3), 0.1, 'form']] : [])] },
];

const start = Date.parse('2026-09-01T08:00:00Z');
const rows = [['case_id', 'category', 'step', 'timestamp', 'actor', 'actor_type', 'minutes_worked', 'input']];
let number = 48200;
for (const process of PROCESSES) {
  for (let index = 0; index < process.cases; index += 1) {
    number += 1;
    let at = start + Math.floor(between(0, 26) * 24) * 3_600_000 + Math.floor(between(0, 9) * 60) * 60_000;
    const steps = process.steps();
    if (random() < process.reopen) {
      const worker = steps.findLast((step) => step[4] !== 'system') ?? steps.at(-1);
      steps.push(['Reopened', 'Service desk system', 0, between(8, 30), 'system'], ['Fixed', worker[1], worker[2], between(1, 6), worker[4]]);
    }
    for (const [step, actor, minutes, waitHours, input] of steps) {
      at += Math.round(waitHours * 3_600_000) + Math.round(minutes * 60_000);
      const system = input === 'system';
      rows.push([`HD-${number}`, process.name, step, new Date(at).toISOString().slice(0, 16) + 'Z', actor, system ? 'system' : 'person', system ? 0 : Math.round(minutes), input]);
    }
  }
}
await writeFile(new URL('halden-service-desk/tickets.csv', import.meta.url), rows.map((row) => row.join(',')).join('\n') + '\n');
console.log(`Wrote ${rows.length - 1} steps in ${number - 48200} cases.`);
