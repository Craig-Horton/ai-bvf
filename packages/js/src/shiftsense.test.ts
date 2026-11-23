/**
 * The ShiftSense regression from the Norhaven test. The source asks for £60,000
 * for discovery, and the only figure on the return is a supplier's claim about
 * other warehouses. The record has to say discovery, £60,000 requested, and the
 * return not known.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { aboutOthers, assessInitiative } from './assessInitiative.js';
import { assessInputFromBrief, briefUrlFor, readBriefLink } from './briefLink.js';
import type { AssessInitiativeInput } from './types.js';

const ASK = { quote: 'Norhaven is asked to fund a discovery phase of £60,000, of which £10,000 is change work.', source: 'A12 ShiftSense proposal' };
const VENDOR = { quote: 'ShiftSense delivered 15% fewer agency hours at comparable warehouses.', source: 'A12 ShiftSense proposal' };
const OWNER = { quote: 'The warehouse operations director owns the agency-hours target.', source: 'A13 Operations plan' };
const input: AssessInitiativeInput = {
  proposal: 'ShiftSense forecasts warehouse staffing and books agency workers.',
  industry: 'logistics', function: 'supply', ai_tier: 'gen2', employees: 'unknown', confirmed: true, answered_by: 'evidence',
  context_stated_by: 'owner',
  answers: { financial_return: 'b', strategic_alignment: 'c' },
  evidence: { financial_return: VENDOR, strategic_alignment: OWNER },
  funding: { stage: 'discovery', ask: { amount: 60000, currency: 'GBP', evidence: ASK } },
};

test('ShiftSense reads as discovery, £60,000 requested, and the return not known', () => {
  const result = assessInitiative(input);
  assert.match(result.funding!.statement, /^The next stage is discovery\. The ask is £60,000\./);
  assert.deepEqual(result.funding!.ask, { amount: 60000, currency: 'GBP', evidence: ASK });
  assert.ok(!result.funding!.gaps.some((gap) => /amount asked/.test(gap)), 'the amount is known');
  assert.ok(result.evidence_missing!.includes('financial_return'), 'the return is not known');
  assert.equal(result.evidence_set_aside![0].id, 'financial_return');
  assert.equal(result.evidence_set_aside![0].quote, VENDOR.quote);
  assert.match(result.evidence_set_aside![0].line, /other organisations/);
});

test('a figure about other organisations is set aside, and the organisation\'s own is kept', () => {
  for (const quote of [
    'ShiftSense delivered 15% fewer agency hours at comparable warehouses.',
    'Clients of your size see 60 to 70 percent fewer manual touches.',
    'Customers like you save around 20 percent in the first year.',
    'The industry average saving is 12 percent.',
  ]) assert.ok(aboutOthers(quote), quote);
  for (const quote of [
    'Our pilot at two of our warehouses cut agency hours by 15 percent, measured over twelve weeks.',
    'Finance has checked the saving of 180,000 euros a year against the licence cost.',
    'Our customers wait four days for a reply today.',
  ]) assert.ok(!aboutOthers(quote), quote);
});

test('a set-aside quote counts on no other question than the return and the result', () => {
  const risk = assessInitiative({ ...input, answers: { governance_risk: 'c' }, evidence: { governance_risk: VENDOR } });
  assert.equal(risk.evidence_set_aside, undefined);
});

test('the funding record keeps its currency and stage in the brief link, and an old link still reads as euros', () => {
  const full = { ...input, answers: { financial_return: 'b', governance_risk: 'c', strategic_alignment: 'c', change_enablement: 'c' }, evidence: {
    financial_return: { quote: 'Finance has checked the saving against the licence cost and signed it off.', source: 'A13' },
    governance_risk: { quote: 'A planner approves every agency booking before it is sent.', source: 'A13' },
    strategic_alignment: OWNER, change_enablement: { quote: 'A change lead is named, with budget for training.', source: 'A13' },
  } } as AssessInitiativeInput;
  const result = assessInitiative(full);
  const brief = readBriefLink(briefUrlFor(full, result, '2027-01-04')!)!;
  assert.equal(brief.funding!.stage, 'discovery');
  assert.equal(brief.funding!.ask!.currency, 'GBP');
  assert.match(brief.funding!.statement, /^The next stage is discovery\. The ask is £60,000\./);
  assert.equal(assessInitiative(assessInputFromBrief(brief)).verdict!.classification, result.verdict!.classification);
  // A link made before currencies carries no third field, and was in euros.
  const old = { v: 1, c: { i: 'technology', f: 'cx', t: 'gen2', e: 180 }, d: '2027-01-04', a: { financial_return: 'b' }, u: { s: 'p', k: [5000, 0], t: [] } };
  const read = readBriefLink(`https://www.aibvf.com/verdict#${Buffer.from(JSON.stringify(old)).toString('base64url')}`)!;
  assert.equal(read.funding!.ask!.currency, 'EUR');
  assert.match(read.funding!.statement, /The ask is €5,000\./);
});

test('an amount with no stated currency is shown as written, and says so', () => {
  const result = assessInitiative({ ...input, funding: { ask: { amount: 60000, evidence: { quote: 'The ask is 60,000 for the first phase.', source: 'A12' } } } });
  assert.match(result.funding!.statement, /The ask is 60,000, currency not stated\./);
});
