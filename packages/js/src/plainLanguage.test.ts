/**
 * Plain-language reading set. Each proposal is written the way a regular
 * user writes one. The reading must be right, or the field must stay open
 * and become a question. A wrong reading is the failure this file exists
 * to prevent: add a case here whenever a user reports one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessInitiative } from './assessInitiative.js';
import { mapToTaxonomy } from './aliases.js';

interface Case {
  proposal: string;
  resolved: Record<string, string | number>;
  ambiguous?: Record<string, string[]>;
}

const CASES: Case[] = [
  {"proposal":"We are a European retail bank with around 2 billion euros in revenue. We want to deploy autonomous agents in customer service to handle complaints end to end. We are quite hierarchical.","resolved":{"industry":"financial","function":"cx","ai_tier":"gen3"}},
  {"proposal":"We are a 40-person accountancy firm and we want to use AI to speed up our month-end bookkeeping for clients.","resolved":{"industry":"professional","function":"finance","employees":40,"track":"smaller_firm"}},
  {"proposal":"Should we roll out Copilot to our sales team? We're a 15m euro IT services company.","resolved":{"industry":"technology","function":"sales","ai_tier":"gen2"}},
  {"proposal":"We are a 12 person MSP with revenue of EUR 1.8 million. We want an AI agent to triage helpdesk tickets. We are agile.","resolved":{"industry":"technology","function":"cx","ai_tier":"gen3","employees":12,"track":"smaller_firm"}},
  {"proposal":"Our hospital pharmacy wants to use a chatbot for staff rota questions. Revenue about €300m. Departments mostly work separately.","resolved":{"industry":"healthcare","ai_tier":"gen2"}},
  {"proposal":"A company wants to use AI for invoicing.","resolved":{"function":"finance"}},
  {"proposal":"We sell laptops and want a chatbot on our website.","resolved":{"ai_tier":"gen2"}},
  {"proposal":"We want AI to help our people write better proposals.","resolved":{}},
  {"proposal":"Our contact centre agents spend too long on wrap-up notes. We want GenAI to draft them.","resolved":{"function":"cx","ai_tier":"gen2"}},
  {"proposal":"A law firm with turnover of €8m wants Claude to draft first versions of contracts.","resolved":{"industry":"professional","ai_tier":"gen2"}},
  {"proposal":"We are a software company selling to hospitals and want a copilot for our support team.","resolved":{"function":"cx","ai_tier":"gen2"},"ambiguous":{"industry":["healthcare","technology"]}},
  {"proposal":"We established a pilot last year using ChatGPT for marketing copy.","resolved":{"function":"sales","ai_tier":"gen2"}},
  {"proposal":"Any ideas on using AI in a 30 person architecture practice?","resolved":{"industry":"professional","employees":30,"track":"smaller_firm"}},
  {"proposal":"We are a slow growing charity with revenue of £4m and want a chatbot for donor questions.","resolved":{"industry":"nonprofit","ai_tier":"gen2"}},
  {"proposal":"Our factory wants predictive maintenance using machine learning.","resolved":{"industry":"manufacturing"}},
  {"proposal":"We have €15m in sales and want AI for accounts payable.","resolved":{},"ambiguous":{"function":["finance","sales"]}},
  {"proposal":"A logistics company with EUR 80m revenue wants agentic AI for procurement. We are siloed.","resolved":{"industry":"logistics","function":"supply","ai_tier":"gen3"}},
  {"proposal":"We want to use technology to improve our product.","resolved":{}},
  {"proposal":"An insurer, €900m revenue, traditional, wants RPA for claims handling in customer service.","resolved":{"industry":"financial","function":"cx","ai_tier":"gen1"}},
  {"proposal":"Our council wants a chatbot to answer housing questions from residents.","resolved":{"industry":"public_sector","ai_tier":"gen2"}},
  {"proposal":"A design agency of 9 people wants AI agents to run its social media.","resolved":{"industry":"creative","ai_tier":"gen3","employees":9,"track":"smaller_firm"}},
  {"proposal":"We are a regional building society and want AI to check mortgage applications for fraud.","resolved":{"industry":"financial","function":"risk"}},
  {"proposal":"Our university IT helpdesk wants an AI assistant for password resets.","resolved":{"industry":"education","function":"it","ai_tier":"gen2"}},
  {"proposal":"We run a chain of care homes and want AI to draft care notes.","resolved":{"industry":"healthcare"}},
  {"proposal":"A 200 million euro manufacturer wants an AI copilot for its engineers in R&D. Cross-functional teams.","resolved":{"industry":"manufacturing","function":"rd","ai_tier":"gen2"}},
  {"proposal":"We are a recruitment agency and want AI to screen CVs.","resolved":{"industry":"professional"}},
  {"proposal":"Our finance team wants to automate reconciliations with RPA. We are a retailer with revenue of EUR 450m, bureaucratic.","resolved":{"industry":"retail","function":"finance","ai_tier":"gen1"}},
  {"proposal":"A power company wants autonomous agents to manage grid maintenance schedules.","resolved":{"industry":"energy","ai_tier":"gen3"}},
  {"proposal":"Our pilot budget is €250k for a GenAI assistant in HR. We are a bank.","resolved":{"industry":"financial","function":"hr","ai_tier":"gen2"}},
  {"proposal":"We are a tech startup, revenue €3m, want AI agents for lead generation.","resolved":{"industry":"technology","function":"sales","ai_tier":"gen3"}},
  {"proposal":"The business went bankrupt once, so we are careful. We want AI for stock forecasting in our warehouse.","resolved":{"function":"supply"}},
  {"proposal":"We want a healthy return from AI in our garden centre shops.","resolved":{}},
  {"proposal":"Our platform team wants to automate cloud cost reports.","resolved":{}},
  {"proposal":"We are a general contractor in construction, revenue of EUR 60m, and want AI to price tenders.","resolved":{"industry":"real_estate"}},
  {"proposal":"A school trust wants an AI assistant for teachers to plan lessons.","resolved":{"ai_tier":"gen2"}},
  {"proposal":"We are a marketing agency of 25 people, turnover €3.5m, and want GenAI to write first drafts for clients.","resolved":{"industry":"creative","ai_tier":"gen2","employees":25,"track":"smaller_firm"}},
  {"proposal":"Our law firm wants autonomous agents to review contracts. Partners decide everything by committee.","resolved":{"industry":"professional","ai_tier":"gen3"}},
  {"proposal":"We want an AI agent for our estate agency to book viewings.","resolved":{"industry":"real_estate","ai_tier":"gen3"}},
  {"proposal":"An NGO wants to use AI to translate field reports.","resolved":{"industry":"nonprofit"}},
  {"proposal":"A 500 million euro insurer wants GenAI in claims. Hierarchical.","resolved":{"industry":"financial","ai_tier":"gen2"}},
  {"proposal":"We are a dental clinic with 14 staff and want AI to handle appointment calls.","resolved":{"industry":"healthcare","employees":14,"track":"smaller_firm"}},
  {"proposal":"Our IT department wants Copilot for all 600 staff. We are a housing association with revenue of €95m.","resolved":{"industry":"real_estate","function":"it","ai_tier":"gen2","employees":600,"track":"enterprise"}},
  {"proposal":"We are a telecom with EUR 4bn revenue and want agentic AI in the call centre. Siloed.","resolved":{"industry":"technology","function":"cx","ai_tier":"gen3"}},
  {"proposal":"Our growth has stalled. We are a SaaS company with ARR of €6m and want AI in customer support.","resolved":{"industry":"technology","function":"cx"}},
  {"proposal":"We are a family-run haulage firm, 60 drivers, and want AI to plan routes.","resolved":{"industry":"logistics"}},
  {"proposal":"A pharma company wants generative AI to speed up regulatory submissions. Revenue €12bn. Matrix organisation.","resolved":{"industry":"healthcare","function":"risk","ai_tier":"gen2"}},
];

test('every plain-language proposal is read correctly or left open as a question', () => {
  assert.ok(CASES.length >= 40);
  for (const c of CASES) {
    const r = assessInitiative({ proposal: c.proposal });
    assert.deepEqual(r.resolved_inputs, c.resolved, c.proposal);
    assert.deepEqual(r.ambiguous_fields ?? {}, c.ambiguous ?? {}, c.proposal);
    assert.equal(r.status, r.missing_fields.length ? 'needs_input' : 'needs_confirmation', c.proposal);
  }
});

test('a word never matches inside another word', () => {
  assert.equal(mapToTaxonomy({ industry: 'a company' }).industry?.resolved, null);
  assert.equal(mapToTaxonomy({ function: 'laptops' }).function?.resolved, null);
  assert.equal(mapToTaxonomy({ industry: 'we went bankrupt' }).industry?.resolved, null);
  assert.equal(mapToTaxonomy({ industry: 'a healthy business' }).industry?.resolved, null);
});

test('the longest phrase wins, so a retail bank is a bank', () => {
  const m = mapToTaxonomy({ industry: 'European retail bank' }).industry;
  assert.equal(m?.resolved, 'financial');
  assert.equal(m?.matched_on, 'retail bank');
});

test('wording that points two ways returns no value and names both candidates', () => {
  const m = mapToTaxonomy({ industry: 'a software company selling to hospitals and clinics across Europe' }).industry;
  assert.equal(m?.resolved, null);
  assert.deepEqual(m?.candidates, ['healthcare', 'technology']);
});

test('ordinary words count as a short direct answer and never inside a long description', () => {
  assert.equal(mapToTaxonomy({ function: 'people' }).function?.resolved, 'hr');
  assert.equal(mapToTaxonomy({ function: 'we want AI to help our people write better proposals' }).function?.resolved, null);
  assert.equal(mapToTaxonomy({ ai_tier: 'agents' }).ai_tier?.resolved, 'gen3');
  assert.equal(mapToTaxonomy({ ai_tier: 'our contact centre agents spend too long on notes' }).ai_tier?.resolved, null);
});

test('a proposal padded with long runs of spaces is read in linear time', () => {
  const padded = `A retailer wants a chatbot. ${`revenue${' '.repeat(20_000)}`.repeat(3)}x`;
  const started = performance.now();
  const r = assessInitiative({ proposal: padded });
  assert.ok(performance.now() - started < 1_000);
  assert.equal(r.resolved_inputs.industry, 'retail');
});
