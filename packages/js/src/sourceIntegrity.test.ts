import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessInitiative } from './assessInitiative.js';
import { assessInputFromBrief, briefUrlFor, readBriefLink } from './briefLink.js';
import type { AssessInitiativeInput } from './types.js';

const base: AssessInitiativeInput = {
  proposal: 'A retail company wants GenAI to draft customer-service replies for human approval.',
  industry: 'retail', employees: 80, context_stated_by: 'owner',
  answered_by: 'evidence', confirmed: true,
  answers: { financial_return: 'd', governance_risk: 'd', strategic_alignment: 'd', change_enablement: 'd', work_architecture: 'd' },
  evidence: {
    financial_return: { quote: 'Finance measured trial savings above the full cost.', source: 'Finance trial report' },
    governance_risk: { quote: 'The controls are tested, Maya can switch it off, and every action is logged and reviewed.', source: 'Controls report' },
    strategic_alignment: { quote: 'First reply time is 24 hours; Maya owns the target of 12 hours.', source: 'Business plan' },
    change_enablement: { quote: 'The owner backs Maya with two days a week and the team helped design the pilot.', source: 'Project plan' },
    work_architecture: { quote: 'The workflow, roles, decision rights and team measures are redesigned.', source: 'Process design' },
  },
};

const withWork = (quote: string): AssessInitiativeInput => ({
  ...base, evidence: { ...base.evidence, work_architecture: { quote, source: 'Process design, 10 November 2026' } },
});

test('the live-test baseline clears the bar', () => {
  assert.equal(assessInitiative(base).verdict?.classification, 'Accelerate');
});

test('the full Halden process record keeps the qualification after character 400', () => {
  const doc = readFileSync(new URL('../../../examples/agent-run/halden/documents/customer-service-agent/process-design.md', import.meta.url), 'utf8');
  const quote = doc.slice(doc.indexOf('The new workflow')).replace(/\s+/g, ' ').trim();
  assert.ok(quote.length > 400 && quote.length < 2000);
  const input = withWork(quote);
  const result = assessInitiative(input);
  assert.equal(result.verdict?.classification, 'Fix');
  assert.equal(result.verdict.answers_given.work_architecture?.evidence?.[0].quote, quote);
  assert.ok(result.verdict.contradictions.some((c) => c.rule === 'measures_unchanged'));
  const brief = readBriefLink(briefUrlFor(input, result, '2026-11-28')!)!;
  assert.equal(brief.evidence?.work_architecture?.[0].quote, quote);
  assert.equal(assessInitiative(assessInputFromBrief(brief)).verdict?.classification, 'Fix');
});

test('the cut-short quote probe cannot earn Accelerate', () => {
  for (const tail of ['The team\'s measures s', 'The team\'s measures s…', 'The team\'s measures s...', 'The team\'s measures s…"']) {
    const result = assessInitiative(withWork('The workflow, roles and decision rights are rewritten. ' + tail));
    assert.notEqual(result.verdict?.classification, 'Accelerate', tail);
    assert.deepEqual(result.evidence_missing, ['work_architecture']);
  }
});

test('a quote above the supported limit is rejected whole', () => {
  const result = assessInitiative(withWork('The workflow is rewritten. '.repeat(90) + 'The team measures stay as they are.'));
  assert.notEqual(result.verdict?.classification, 'Accelerate');
  assert.deepEqual(result.evidence_missing, ['work_architecture']);
});

test('a partial counter-record cannot disappear and leave a go-ahead', () => {
  const result = assessInitiative({ ...base, evidence_against: { governance_risk: { quote: 'Nobody checks the', source: 'Incident log' } } });
  assert.notEqual(result.verdict?.classification, 'Accelerate');
  assert.deepEqual(result.evidence_missing, ['governance_risk']);
});

test('a partial entry cannot be discarded from an otherwise favourable list', () => {
  const result = assessInitiative({ ...base, evidence: { ...base.evidence, work_architecture: [
    { quote: 'The workflow, roles, decision rights and measures are redesigned.', source: 'Design' },
    { quote: 'Except the current targets wh', source: 'Qualification' },
  ] } });
  assert.notEqual(result.verdict?.classification, 'Accelerate');
});

test('common alternatives for keeping existing measures contradict a full redesign', () => {
  for (const quote of ["We're keeping the current targets.", 'We retain our existing measures.', 'The KPIs have not been changed.', 'The incentives will not be changed.', 'We will leave the existing KPIs in place.', 'The targets will continue unchanged.', 'Existing targets are being retained.']) {
    const result = assessInitiative(withWork('The workflow, roles and decision rights are redesigned. ' + quote));
    assert.equal(result.verdict?.classification, 'Fix', quote);
    assert.ok(result.verdict.contradictions.some((c) => c.rule === 'measures_unchanged'), quote);
  }
  assert.equal(assessInitiative(withWork('We are not keeping the current targets. The workflow, roles, decision rights and measures are redesigned.')).verdict?.classification, 'Accelerate');
});

test('an approval owner is kept only when the record actually names them', () => {
  const pending = { what: 'Data protection approval before go-live', by: 'Data protection officer', evidence: {
    quote: 'The Data protection officer must approve before go-live.', source: 'Approval record',
  } };
  const input = { ...base, pending_approvals: [pending] };
  const result = assessInitiative(input);
  assert.equal(result.pending_approvals?.[0].by, pending.by);
  const brief = readBriefLink(briefUrlFor(input, result, '2026-11-28')!)!;
  assert.equal(assessInitiative(assessInputFromBrief(brief)).pending_approvals?.[0].by, pending.by);
  const unquoted = assessInitiative({ ...input, pending_approvals: [{ ...pending, by: 'Someone not in the record' }] });
  assert.equal(unquoted.pending_approvals?.[0].by, undefined);
});

test('an explicitly supplied incomplete approval cannot silently disappear', () => {
  assert.throws(() => assessInitiative({ ...base, pending_approvals: [{
    what: 'Data protection approval before go-live', evidence: {
      quote: 'The officer has not yet approv', source: 'Approval record',
    },
  }] }), /pending_approvals\[0\]\.evidence must contain complete quoted sentences/);
});

test('funding quotes also survive the brief link without losing their qualification', () => {
  const quote = 'We request EUR 5000 for the pilot. ' + 'The pilot includes staff training and support. '.repeat(9) + 'No rollout funds have been approved.';
  const input = { ...base, funding: { stage: 'pilot' as const, ask: { amount_eur: 5000, evidence: { quote, source: 'Funding request' } } } };
  const result = assessInitiative(input);
  assert.equal(result.funding?.ask?.evidence?.quote, quote);
  const brief = readBriefLink(briefUrlFor(input, result, '2026-11-28')!)!;
  assert.equal(brief.funding?.ask?.evidence?.quote, quote);
});

test('an incidental substring is not the name of an approval owner', () => {
  const pending = { what: 'Sign-off before go-live', by: 'Ann', evidence: { quote: 'Annual sign-off is required before go-live.', source: 'Approval policy' } };
  assert.equal(assessInitiative({ ...base, pending_approvals: [pending] }).pending_approvals?.[0].by, undefined);
  const named = { ...pending, evidence: { quote: 'Ann must sign off before go-live.', source: 'Approval policy' } };
  assert.equal(assessInitiative({ ...base, pending_approvals: [named] }).pending_approvals?.[0].by, 'Ann');
});

test('an incomplete funding quote cannot carry an approved amount', () => {
  for (const quote of ['We request EUR 5000 but the', 'We request EUR 5000…']) {
    const result = assessInitiative({ ...base, funding: { ask: { amount_eur: 5000, evidence: { quote, source: 'Funding request' } } } });
    assert.equal(result.funding?.ask, undefined);
  }
});

test('numeric inputs cannot replace rejected quotations in agent mode', () => {
  const input = withWork('The team measures s…');
  assert.throws(() => assessInitiative({ ...input, scores: { financial_return: 90 } }), /not accepted/);
  assert.throws(() => assessInitiative({ ...input, work_architecture: { workflow_redesigned: true, roles_redesigned: true, decision_rights_defined: true, measures_updated: true } }), /not accepted/);
});

test('selecting complete sentences about only three work parts cannot clear all four', () => {
  const result = assessInitiative(withWork('The workflow is redrawn. The roles are rewritten. Decision and override rights are assigned.'));
  assert.notEqual(result.verdict?.classification, 'Accelerate');
  assert.deepEqual(result.evidence_missing, ['work_architecture']);
});

test('replaying the 36 historical calls keeps the customer-service review at Fix', () => {
  let calls = 0;
  for (const run of ['run-1', 'run-2']) {
    const lines = readFileSync(new URL(`../../../examples/agent-run/${run}/calls.jsonl`, import.meta.url), 'utf8').trim().split(/\r?\n/);
    const latest = new Map<string, ReturnType<typeof assessInitiative>>();
    for (const line of lines) {
      const recorded = JSON.parse(line);
      assert.equal(recorded.tool, 'assess_ai_initiative');
      const result = assessInitiative(recorded.args);
      latest.set(recorded.args.proposal, result);
      calls += 1;
    }
    assert.equal(latest.size, 3);
    for (const [proposal, result] of latest) {
      if (proposal.includes('first-line customer queries')) {
        assert.equal(result.verdict?.classification, 'Fix');
        if (run === 'run-2') assert.ok(result.verdict.contradictions.some((c) => c.rule === 'measures_unchanged'));
      } else if (proposal.includes('LedgerLight')) {
        assert.equal(result.status, 'not_enough_to_judge');
      } else {
        assert.equal(result.verdict?.classification, 'Stop');
      }
    }
  }
  assert.equal(calls, 36);
});
