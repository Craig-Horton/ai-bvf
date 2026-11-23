/**
 * Two rules from the Norhaven test. An approval still to come is carried into
 * the first step of an Accelerate and never changes the verdict. A company fact
 * the records do not state stays unknown, and the default used in its place is
 * said out loud.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessInitiative, HEADCOUNT_DEFAULT_LINE, HEADCOUNT_UNQUOTED_LINE, INDUSTRY_DEFAULT_LINE, INDUSTRY_UNQUOTED_LINE,
} from './assessInitiative.js';
import { assessInputFromBrief, briefUrlFor, readBriefLink } from './briefLink.js';
import { score } from './score.js';
import type { AssessInitiativeInput } from './types.js';

const PROPOSAL = 'ClearPay matches supplier invoices and pays the ones that match. The France expansion adds the French entities.';
const ALL_D = { financial_return: 'd', governance_risk: 'd', strategic_alignment: 'd', change_enablement: 'd', work_architecture: 'd' } as const;
const COMPANY = { industry: 'logistics', function: 'finance', ai_tier: 'gen3', employees: 900 };
const RETEST = { quote: 'The repaired configuration passed the controls retest on 15 January.', source: 'B04 Controls retest' };
const PENDING = {
  what: 'France activation is pending separate controls sign-off',
  by: 'Priya Shah',
  evidence: { quote: 'France activation still needs separate controls sign-off from Priya Shah.', source: 'B04 Controls retest' },
};
const QUOTES = Object.fromEntries(Object.keys(ALL_D).map((id) => [id, { quote: `Quoted support for ${id} in the record.`, source: 'A05 Business case' }]));
const owner: AssessInitiativeInput = { proposal: PROPOSAL, ...COMPANY, confirmed: true, answers: ALL_D };
const agent: AssessInitiativeInput = {
  proposal: PROPOSAL, ...COMPANY, confirmed: true, answered_by: 'evidence', answers: ALL_D, evidence: QUOTES,
  context_stated_by: 'owner',
};

test('an approval still to come keeps Accelerate and becomes the first step', () => {
  const plain = assessInitiative(owner);
  const pending = assessInitiative({ ...owner, pending_approvals: [PENDING] });
  assert.equal(pending.verdict!.classification, 'Accelerate');
  assert.equal(pending.verdict!.classification, plain.verdict!.classification);
  assert.equal(pending.verdict!.first_step, 'France activation is pending separate controls sign-off. Sign-off: Priya Shah. Go ahead once it is given, and answer the same questions again at the first review.');
  assert.match(pending.verdict!.summary, /One approval is still to come\.$/);
  assert.equal(pending.pending_approvals!.length, 1);
  assert.ok(pending.verdict!.audit.rules_fired.includes('pending_approvals:1'));
  assert.doesNotMatch(JSON.stringify(pending), /Fund it/);
});

test('with an approval pending, an Accelerate never says go ahead without the condition', () => {
  const result = assessInitiative({ ...owner, pending_approvals: [PENDING, { what: 'The works council has to agree the new rota' }] });
  assert.match(result.verdict!.first_step, /^France activation is pending separate controls sign-off\. Sign-off: Priya Shah\. The works council has to agree the new rota\. Go ahead once each is given/);
  assert.match(result.verdict!.summary, /Two approvals are still to come\./);
});

test('an approval never changes a Fix or a Stop, and is listed beside it', () => {
  const fix = assessInitiative({ ...owner, answers: { ...ALL_D, governance_risk: 'b' }, pending_approvals: [PENDING] });
  const plainFix = assessInitiative({ ...owner, answers: { ...ALL_D, governance_risk: 'b' } });
  assert.equal(fix.verdict!.classification, 'Fix');
  assert.equal(fix.verdict!.first_step, plainFix.verdict!.first_step);
  assert.equal(fix.pending_approvals!.length, 1);
  const stop = assessInitiative({ ...owner, answers: { ...ALL_D, financial_return: 'a' }, pending_approvals: [PENDING] });
  assert.equal(stop.verdict!.classification, 'Stop');
});

test('controls that two records dispute hold the verdict, whatever approval is pending', () => {
  const disputed = assessInitiative({
    ...agent,
    evidence: { ...QUOTES, governance_risk: RETEST },
    evidence_against: { governance_risk: { quote: 'Three invoices of 8,400 euros were paid with no approval and are missing from the log.', source: 'A10 Incident report' } },
    pending_approvals: [PENDING],
  });
  assert.notEqual(disputed.verdict?.classification, 'Accelerate');
  assert.equal(disputed.conflicts!.length, 1);
});

test('in evidence mode an approval counts only with a quote, and the approver only when the quote names them', () => {
  const unquoted = assessInitiative({ ...agent, pending_approvals: [{ what: 'Board sign-off is still to come' }] });
  assert.equal(unquoted.pending_approvals, undefined);
  assert.equal(unquoted.verdict!.first_step, 'Go ahead, and answer the same questions again at the first review.');
  const wrongName = assessInitiative({ ...agent, pending_approvals: [{ ...PENDING, by: 'Mara de Vries' }] });
  assert.equal(wrongName.pending_approvals![0].by, undefined);
  assert.equal(wrongName.verdict!.first_step, 'France activation is pending separate controls sign-off. Go ahead once it is given, and answer the same questions again at the first review.');
  const named = assessInitiative({ ...agent, pending_approvals: [PENDING] });
  assert.equal(named.pending_approvals![0].by, 'Priya Shah');
});

test('the pending approval travels in the brief link and the brief reaches the same first step', () => {
  const input = { ...agent, pending_approvals: [PENDING] };
  const result = assessInitiative(input);
  const brief = readBriefLink(briefUrlFor(input, result, '2027-01-18')!)!;
  assert.equal(brief.pending_approvals![0].what, PENDING.what);
  assert.deepEqual(brief.pending_approvals![0].evidence, [PENDING.evidence]);
  const again = assessInitiative(assessInputFromBrief(brief));
  assert.equal(again.verdict!.first_step, result.verdict!.first_step);
});

test('the score engine no longer says to fund an Accelerate', () => {
  const result = score({ industry: 'retail', function: 'cx', ai_tier: 'gen2', revenue_eur: 0, readiness: 'traditional', scores: { strategic_alignment: 80, financial_return: 80, change_enablement: 80, governance_risk: 20 }, work_architecture: { workflow_redesigned: true, roles_redesigned: true, decision_rights_defined: true, measures_updated: true } });
  assert.equal(result.classification, 'Accelerate');
  assert.doesNotMatch(result.reason, /fund/i);
});

test('in evidence mode an industry or headcount without a quote counts as not stated, and the default is said', () => {
  const result = assessInitiative({ ...agent, context_stated_by: undefined, industry: 'financial', employees: 20000 });
  assert.equal(result.status, 'verdict');
  assert.equal(result.resolved_inputs.industry, 'universal');
  assert.equal(result.resolved_inputs.employees, undefined);
  assert.equal(result.resolved_inputs.track, 'enterprise');
  assert.deepEqual(result.context_defaults!.map((item) => item.line), [INDUSTRY_UNQUOTED_LINE, HEADCOUNT_UNQUOTED_LINE]);
  assert.match(result.understood, /headcount not stated, so the questions are worded for a larger organisation/);
  assert.equal(result.verdict!.classification, 'Accelerate', 'company facts never move the verdict');
});

test('a quote that shows the number counts, and one that does not is not enough', () => {
  const shown = assessInitiative({
    ...agent, context_stated_by: undefined, industry: 'logistics', employees: 1200,
    context_evidence: { industry: { quote: 'Norhaven is an industrial spare-parts distributor.', source: 'A01 Group profile' }, employees: { quote: 'The group employs 1,200 people across six sites.', source: 'A01 Group profile' } },
  });
  assert.equal(shown.resolved_inputs.employees, 1200);
  assert.equal(shown.resolved_inputs.industry, 'logistics');
  assert.equal(shown.context_defaults, undefined);
  const other = assessInitiative({
    ...agent, context_stated_by: undefined, industry: 'logistics', employees: 120,
    context_evidence: { industry: { quote: 'Norhaven is an industrial spare-parts distributor.', source: 'A01' }, employees: { quote: 'The group employs 1,200 people across six sites.', source: 'A01 Group profile' } },
  });
  assert.equal(other.resolved_inputs.employees, undefined);
  assert.deepEqual(other.context_defaults!.map((item) => item.field), ['employees']);
});

test('a person may say the headcount is not known, and the engine goes on with the default said', () => {
  const result = assessInitiative({ ...owner, industry: 'unknown', employees: 'unknown' });
  assert.equal(result.status, 'verdict');
  assert.deepEqual(result.context_defaults!.map((item) => item.line), [INDUSTRY_DEFAULT_LINE, HEADCOUNT_DEFAULT_LINE]);
  assert.equal(result.missing_fields.length, 0);
});

test('a brief link without a headcount reads back, and rebuilds the same verdict and defaults', () => {
  const input = { ...agent, employees: 'unknown' as const };
  const result = assessInitiative(input);
  const url = briefUrlFor(input, result, '2027-01-04')!;
  const data = JSON.parse(Buffer.from(url.split('#')[1], 'base64url').toString('utf8'));
  assert.equal(data.c.e, undefined);
  const again = assessInitiative(assessInputFromBrief(readBriefLink(url)!));
  assert.equal(again.verdict!.classification, result.verdict!.classification);
  assert.deepEqual(again.context_defaults, result.context_defaults);
});
