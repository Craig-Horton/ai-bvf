// A funding review on a made-up service desk, both visits, with the engine as built here.
//
//   npm run build
//   node examples/funding-review/run.mjs
//
// The first visit records what is asked and what was agreed. The second visit
// passes only the earlier brief link and what was measured. Nothing is stored.

import { assessInitiative, briefUrlFor } from '../../packages/js/dist/index.js';

const proposal = 'We are a 180-person software firm. We want GenAI to sort incoming service desk tickets and suggest the team to send each one to. A person approves each one.';
const answers = { financial_return: 'b', governance_risk: 'c', strategic_alignment: 'c', change_enablement: 'c' };

const first = {
  proposal, confirmed: true, answers,
  funding: {
    stage: 'pilot',
    ask: { amount_eur: 5000 },
    alternative: { description: 'Rewrite the ticket form so customers pick the team themselves.' },
    thresholds: [
      { measure: 'Cost per resolved ticket', unit: 'euros', direction: 'at_most', target: 10, baseline: 12, baseline_kind: 'measured' },
      { measure: 'Reopened tickets', unit: 'percent', direction: 'at_most', target: 6, baseline: 6, baseline_kind: 'measured' },
    ],
  },
};
const before = assessInitiative(first);
const link = briefUrlFor(first, before, '2026-11-23');

const second = {
  proposal, confirmed: true, answers,
  review: { previous_brief: link },
  funding: {
    results: [
      { measure: 'Cost per resolved ticket', value: 9.5, kind: 'measured' },
      { measure: 'Reopened tickets', value: 10, kind: 'measured' },
    ],
    decision: 'deferred',
  },
};
const after = assessInitiative(second);

const show = (title, result) => {
  console.log(`\n${title}`);
  console.log(`Verdict: ${result.verdict.classification}. ${result.verdict.summary}`);
  console.log(result.funding.statement);
  for (const item of result.funding.thresholds) console.log(`- ${item.line}`);
  for (const gap of result.funding.gaps) console.log(`- Still open: ${gap}`);
  console.log(result.funding.note);
};
show('23 November 2026, before the pilot', before);
show('4 January 2027, after the pilot', after);
