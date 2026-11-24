// From the audit of 24 November 2026: where the tools meet each other.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score, resolvePillars } from './score.js';
import { sequencePortfolio } from './sequencePortfolio.js';
import { assemblePortfolio } from './assemblePortfolio.js';
import type { ScoreInput } from './types.js';

const context: ScoreInput = { industry: 'retail', revenue_eur: 500_000_000, function: 'cx', ai_tier: 'gen2', readiness: 'traditional' };
const all = { strategic_alignment: 70, financial_return: 70, change_enablement: 70, governance_risk: 30 };

test('signal_completeness is an upper limit: it lowers the signal and never raises it', () => {
  const none = score(context);
  const raised = score({ ...context, signal_completeness: 1 });
  assert.equal(none.confidence, 38);
  assert.equal(raised.confidence, 38, 'with no pillar supplied, a signal of 1 used to give 51');
  assert.match(raised.caveat ?? '', /signal_completeness 1 was given\. The pillars supplied support 0\.5, so 0\.5 is used/);
  assert.ok(raised.audit.rules_fired.includes('signal_completeness:0.5(given 1, capped at what the pillars support)'));
  assert.equal(score({ ...context, scores: all, signal_completeness: 0.4 }).confidence, Math.round(70 * (0.5 + 0.5 * 0.4)));
  assert.equal(score({ ...context, scores: all, signal_completeness: 1 }).confidence, score({ ...context, scores: all }).confidence);
  assert.throws(() => score({ ...context, signal_completeness: Number.NaN }), /signal_completeness must be a number/);
});

test('a pillar is a number or an object, and a pillar marked estimated is never counted as given', () => {
  const estimate = resolvePillars(context).scores.financial_return;
  // Marked in the object, as assemble_portfolio writes it.
  const inObject = resolvePillars({ ...context, scores: { ...all, financial_return: { value: 95, confidence: 40, basis: 'estimated' } } });
  assert.equal(inObject.basis.financial_return, 'estimated');
  assert.equal(inObject.scores.financial_return, estimate, 'the engine uses its own estimate, not the figure sent');
  assert.equal(inObject.givenCount, 3);
  // Marked beside bare numbers.
  const beside = resolvePillars({ ...context, scores: { ...all, financial_return: 95 }, pillar_basis: { financial_return: 'estimated' } });
  assert.equal(beside.basis.financial_return, 'estimated');
  assert.equal(beside.scores.financial_return, estimate);
  // An object with no basis is given, and its confidence lowers what the pillars support.
  const doubted = resolvePillars({ ...context, scores: { ...all, financial_return: { value: 70, confidence: 20 } } });
  assert.equal(doubted.basis.financial_return, 'given');
  assert.equal(doubted.supported, 0.8);
  assert.equal(resolvePillars({ ...context, scores: all }).supported, 1);
  // A mark the engine does not know, and a value out of range, are refused.
  assert.throws(() => resolvePillars({ ...context, scores: all, pillar_basis: { financial_return: 'evidenced' as never } }), /must be given or estimated/);
  assert.throws(() => resolvePillars({ ...context, scores: { ...all, financial_return: { value: 900 } } }), /scores\.financial_return must be a number from 0 to 100/);
});

test('the sequencer reads what score_portfolio returns: scored_initiatives, with readiness inside', () => {
  const ready = [
    { id: 'workflow_redesigned', status: 'met' }, { id: 'roles_redesigned', status: 'met' },
    { id: 'decision_rights_defined', status: 'met' }, { id: 'measures_updated', status: 'met' },
  ];
  const scored = {
    organization: { name: 'Halden & Co', industry: 'retail', revenue_eur: 400_000_000 },
    readiness: 'traditional',
    scored_initiatives: [
      { id: 'a', name: 'Invoice matching', function: 'finance', ai_tier: 'gen1', scores_used: { strategic_alignment: 80, financial_return: 75, change_enablement: 70, governance_risk: 20 },
        pillar_basis: { strategic_alignment: 'given', financial_return: 'given', change_enablement: 'given', governance_risk: 'given' }, signal_completeness: 1, work_architecture: { status: 'ready', checks: ready } },
      { id: 'b', name: 'Service assistant', function: 'cx', ai_tier: 'gen2', scores_used: { strategic_alignment: 65, financial_return: 52, change_enablement: 45, governance_risk: 42 },
        pillar_basis: { strategic_alignment: 'given', financial_return: 'estimated', change_enablement: 'estimated', governance_risk: 'estimated' }, signal_completeness: 0.55 },
    ],
  };
  const plan = sequencePortfolio({ portfolio: scored });
  const placed = Object.fromEntries(plan.waves.flatMap((wave) => wave.initiatives.map((item) => [item.id, item])));
  // The work design travels with the initiative, so an Accelerate stays an Accelerate.
  assert.equal(placed.a.classification, 'Accelerate');
  assert.equal(placed.b.classification, 'Fix');
  assert.equal(placed.b.decision_confidence, 43, 'the estimate and the signal are carried, not flattened to given');
  // Without readiness anywhere, the reason is said.
  assert.throws(() => sequencePortfolio({ portfolio: { ...scored, readiness: undefined } }), /needs readiness, either top-level or inside the portfolio/);
  assert.throws(() => sequencePortfolio({ portfolio: { ...scored, scored_initiatives: [] }, readiness: 'traditional' }), /read from its scored_initiatives/);
});

test('the assembler marks its estimates in the document and says when an initiative seems entered twice', () => {
  const assembled = assemblePortfolio({
    organization: { name: 'Halden & Co', industry: 'retail', revenue_eur: 400_000_000 },
    initiatives: [
      { name: 'Invoice matching', function: 'finance', ai_tier: 'gen1', scores: { strategic_alignment: 80 } },
      { name: ' invoice MATCHING', function: 'finance', ai_tier: 'gen1' },
    ],
  });
  const first = assembled.portfolio!.initiatives[0].scores as unknown as Record<string, unknown>;
  assert.equal(first.strategic_alignment, 80);
  assert.deepEqual(first.financial_return, { value: (first.financial_return as { value: number }).value, confidence: 40, basis: 'estimated' });
  const twice = assembled.issues.filter((issue) => issue.code === 'duplicate_suspected');
  assert.equal(twice.length, 1);
  assert.equal(twice[0].path, 'initiatives[1]');
  assert.ok(assembled.audit.rules_fired.includes('duplicate_suspected'));
  assert.equal(assembled.validation?.valid, true);
});
