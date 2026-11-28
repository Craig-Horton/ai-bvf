import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { score, recommendImprovements } from '@aibvf/core';

process.env.AIBVF_TELEMETRY_DISABLE = '1';
const { createAibvfServer } = await import('./dist/server.js');
const input = {
  industry: 'retail', revenue_eur: 300_000_000, function: 'cx',
  ai_tier: 'gen2', readiness: 'traditional',
  scores: { strategic_alignment: 80, financial_return: 75, change_enablement: 70, governance_risk: 30 },
  work_architecture: { workflow_redesigned: true, roles_redesigned: false,
    decision_rights_defined: true, measures_updated: false },
};

test('MCP scoring and improvement responses retain engine evidence', { timeout: 10000 }, async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createAibvfServer();
  const client = new Client({ name: 'output-regression', version: '1.0.0' });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    assert.match(client.getInstructions() || '', /call assess_ai_initiative first/);
    const scored = await client.callTool({ name: 'score_initiative', arguments: input });
    assert.notEqual(scored.isError, true);
    const text = JSON.parse(scored.content[0].text);
    assert.deepEqual(scored.structuredContent, text);
    const expected = score(input);
    assert.deepEqual(text.audit, expected.audit);
    assert.deepEqual(text.sensitivity, expected.sensitivity);
    assert.ok(text.audit.rules_fired.length > 0);
    assert.equal(text.classification, 'Fix');
    assert.equal(text.work_architecture.status, 'gap');
    // A Fix or Stop verdict points to the published method. It offers nothing and names no contact.
    assert.match(text.method_note, /https:\/\/github\.com\/Craig-Horton\/ai-bvf$/);
    assert.doesNotMatch(scored.content[0].text, /calendly|book a|teardown|advisory/i);

    const improved = await client.callTool({ name: 'recommend_improvements', arguments: input });
    assert.notEqual(improved.isError, true);
    const plan = JSON.parse(improved.content[0].text);
    // In-memory transport retains optional undefined properties; JSON wire transport omits them.
    assert.deepEqual(JSON.parse(JSON.stringify(improved.structuredContent)), plan);
    assert.deepEqual(plan.audit, recommendImprovements(input).audit);
    assert.ok(plan.audit.rules_fired.length > 0);

    const proposal = 'We are a retailer with 3,000 staff considering a GenAI assistant for customer service.';
    const assess = async (extra = {}) => {
      const result = await client.callTool({ name: 'assess_ai_initiative', arguments: { proposal, ...extra } });
      assert.notEqual(result.isError, true);
      return result.structuredContent;
    };
    // The front door is a guided conversation: confirm the reading, then one question at a time.
    const read = await assess();
    assert.equal(read.status, 'needs_confirmation');
    assert.match(read.understood, /3,000 people/);
    const first = await assess({ confirmed: true });
    assert.equal(first.status, 'not_enough_to_judge');
    assert.equal(first.verdict, undefined);
    assert.equal(first.question.id, 'financial_return');
    assert.equal(first.question.choices.length, 5);
    assert.doesNotMatch(JSON.stringify(first), /net_value_eur|gross_value_eur|scores_used|pillar_basis/);

    const judged = await assess({
      confirmed: true,
      answers: { financial_return: 'c', governance_risk: 'c', strategic_alignment: 'c', change_enablement: 'b' },
    });
    assert.equal(judged.status, 'verdict');
    assert.equal(judged.verdict.classification, 'Fix');
    assert.ok(judged.verdict.audit);
    assert.ok(judged.verdict.verdict_flips.length > 0);
    assert.equal(judged.verdict.answers_given.change_enablement.score, 45);
    assert.equal(judged.verdict.summary, 'Fix one thing first. The question on how the work changes comes after that.');
    assert.deepEqual(judged.verdict.holding_back.map((item) => item.id), ['change_enablement']);
    assert.equal(judged.verdict.holding_back[0].needed, 'An owner is named and the change work is funded.');
    assert.equal(judged.verdict.first_step, 'Name the owner of the change and fund the change work.');
    assert.match(judged.verdict.value_note, /own volumes, hours and costs/);
    assert.doesNotMatch(JSON.stringify(judged), /net_value_eur|gross_value_eur|scores_used|estimated/);
  } finally {
    await client.close();
    await server.close();
  }
});

const readyWork = {
  workflow_redesigned: true, roles_redesigned: true,
  decision_rights_defined: true, measures_updated: true,
};
const pillars = Object.keys(input.scores);
const organization = { name: 'Regression retailer', industry: 'retail', revenue_eur: 300_000_000 };

async function withMcp(run) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createAibvfServer();
  const client = new Client({ name: 'portfolio-output-regression', version: '1.0.0' });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await client.listTools();
    return await run(async (name, args) => {
      const response = await client.callTool({ name, arguments: args });
      assert.notEqual(response.isError, true, JSON.stringify(response.content));
      const payload = JSON.parse(response.content[0].text);
      assert.deepEqual(JSON.parse(JSON.stringify(response.structuredContent)), payload);
      return payload;
    }, client);
  } finally {
    await client.close();
    await server.close();
  }
}

function portfolioItem(id, extra = {}) {
  return { id, name: id, function: 'cx', ai_tier: 'gen2', scores: { ...input.scores }, ...extra };
}

test('MCP portfolio preserves ready, missing and failed work architecture gates', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const result = await call('score_portfolio', {
      readiness: 'traditional',
      portfolio: {
        bvf_version: '1.0', organization,
        initiatives: [
          portfolioItem('ready', { work_architecture: readyWork }),
          portfolioItem('missing'),
          portfolioItem('gap', { work_architecture: { ...readyWork, roles_redesigned: false } }),
          portfolioItem('stop', { work_architecture: readyWork, scores: { ...input.scores, governance_risk: 80 } }),
        ],
      },
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.summary, { accelerate: 1, fix: 2, stop: 1, skipped: 0 });
    const [ready, missing, gap, stop] = result.scored_initiatives;
    assert.equal(ready.classification, 'Accelerate');
    assert.equal(ready.work_architecture.status, 'ready');
    assert.deepEqual(ready.audit.inputs_used.work_architecture, readyWork);
    assert.equal(missing.classification, 'Fix');
    assert.equal(missing.work_architecture.status, 'unknown');
    assert.equal(gap.classification, 'Fix');
    assert.equal(gap.work_architecture.status, 'gap');
    assert.equal(stop.classification, 'Stop');
    assert.ok(ready.audit.rules_fired.length);
    assert.ok(ready.sensitivity);
    assert.match(result.interpretation.aggregate_net_value_eur, /overlapping scope/);
  });
});

test('MCP assembly retains work design and estimated provenance through scoring', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const assembled = await call('assemble_portfolio', {
      organization, readiness: 'traditional',
      initiatives: [
        { name: 'Supplied', function: 'customer service', ai_tier: 'copilot', scores: input.scores, work_architecture: readyWork },
        { name: 'Estimated', function: 'customer service', ai_tier: 'copilot', work_architecture: readyWork, signal_completeness: 1 },
        { name: 'Mixed', function: 'customer service', ai_tier: 'copilot', scores: { strategic_alignment: 80 }, work_architecture: readyWork },
      ],
    });
    assert.equal(assembled.validation.valid, true);
    const [supplied, estimated, mixed] = assembled.portfolio.initiatives;
    assert.deepEqual(supplied.work_architecture, readyWork);
    assert.ok(pillars.every((pillar) => estimated.pillar_basis[pillar] === 'estimated'));
    assert.equal(mixed.pillar_basis.strategic_alignment, 'given');
    const result = await call('score_portfolio', { portfolio: assembled.portfolio, readiness: 'traditional' });
    assert.equal(result.scored_initiatives[0].classification, 'Accelerate');
    const scored = result.scored_initiatives[1];
    assert.equal(scored.classification, 'Fix');
    assert.ok(pillars.every((pillar) => scored.pillar_basis[pillar] === 'estimated'));
    assert.equal(scored.signal_completeness, 0.4);
    assert.match(scored.caveat, /Estimated pillars/);
    const expected = score({ ...input, scores: {}, work_architecture: readyWork, signal_completeness: 0.4 });
    assert.equal(scored.decision_confidence, expected.confidence);
    const asSupplied = score({ ...input, scores: scored.scores_used, work_architecture: readyWork });
    assert.ok(scored.decision_confidence < asSupplied.confidence);
    assert.equal(result.scored_initiatives[2].pillar_basis.strategic_alignment, 'given');
    assert.equal(result.scored_initiatives[2].pillar_basis.financial_return, 'estimated');
    const changedContext = await call('score_portfolio', { portfolio: assembled.portfolio, readiness: 'siloed' });
    assert.equal(changedContext.scored_initiatives[1].scores_used.change_enablement, 32);
  });
});

test('MCP portfolio retains weak supplied evidence without relabelling it estimated', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const scores = Object.fromEntries(pillars.map((pillar) => [pillar, { value: input.scores[pillar], confidence: 20 }]));
    const result = await call('score_portfolio', {
      readiness: 'traditional',
      portfolio: { bvf_version: '1.0', organization, initiatives: [portfolioItem('weak-evidence', {
        scores, work_architecture: readyWork, signal_completeness: 0.9,
      })] },
    });
    const scored = result.scored_initiatives[0];
    assert.equal(scored.signal_completeness, 0.2);
    assert.ok(pillars.every((pillar) => scored.pillar_basis[pillar] === 'given'));
    assert.equal(scored.decision_confidence, score({ ...input, work_architecture: readyWork, signal_completeness: 0.2 }).confidence);
    const lower = await call('score_portfolio', {
      readiness: 'traditional',
      portfolio: { bvf_version: '1.0', organization, initiatives: [portfolioItem('explicit-quality', {
        work_architecture: readyWork, signal_completeness: 0.1,
      })] },
    });
    assert.equal(lower.scored_initiatives[0].signal_completeness, 0.1);
  });
});

test('MCP assembly keeps evidence attached when invalid entries are skipped and names repeat', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const result = await call('assemble_portfolio', {
      organization, readiness: 'traditional',
      initiatives: [
        { name: 'Same name', function: 123, ai_tier: 'copilot', work_architecture: { roles_redesigned: false } },
        { name: 'Same name', function: 'cx', ai_tier: 'gen2', scores: input.scores, work_architecture: readyWork },
        { name: 'Same name', function: 'cx', ai_tier: 'gen2', scores: input.scores, work_architecture: { ...readyWork, measures_updated: false } },
      ],
    });
    assert.equal(result.portfolio.initiatives.length, 2);
    assert.deepEqual(result.portfolio.initiatives[0].work_architecture, readyWork);
    assert.equal(result.portfolio.initiatives[1].work_architecture.measures_updated, false);
    assert.notEqual(result.portfolio.initiatives[0].id, result.portfolio.initiatives[1].id);
  });
});

test('MCP explanations disclose compatibility field limits on tool listings and responses', { timeout: 10000 }, async () => {
  await withMcp(async (call, client) => {
    const tools = await client.listTools();
    const schema = tools.tools.find((tool) => tool.name === 'score_initiative').outputSchema;
    assert.match(schema.properties.decision_confidence.description, /no probability calibration/);
    assert.match(schema.properties.net_value_eur.description, /before project build, run and change costs/);
    assert.match(schema.properties.applied_modules.description, /do not certify/);
    const single = await call('score_initiative', { ...input, industry: 'healthcare', function: 'risk' });
    assert.ok(single.applied_modules.includes('healthcare_hipaa_module'));
    assert.match(single.interpretation.applied_modules, /do not certify/);
    assert.match(single.interpretation.net_value_eur, /before project build, run and change costs/);
    const assessment = await call('assess_ai_initiative', {
      proposal: 'We are a retailer with 3,000 staff considering a GenAI assistant for customer service.',
      confirmed: true,
      scores: { strategic_alignment: 70, financial_return: 64, change_enablement: 48, governance_risk: 35 },
    });
    assert.match(assessment.verdict.interpretation.decision_confidence, /no probability calibration/);
    const improved = await call('recommend_improvements', input);
    assert.match(improved.interpretation.target_classification, /conditional on work-architecture readiness/);
  });
});

test('MCP declines out-of-range, mistyped and missing arguments with the field named', { timeout: 10000 }, async () => {
  await withMcp(async (_call, client) => {
    const declined = async (name, args, pattern) => {
      const response = await client.callTool({ name, arguments: args });
      assert.equal(response.isError, true, `${name} accepted invalid input`);
      assert.match(response.content[0].text, pattern);
    };
    await declined('score_initiative', { ...input, scores: { ...input.scores, strategic_alignment: 900 } }, /scores\.strategic_alignment must be <= 100/);
    await declined('score_initiative', { ...input, revenue_eur: '2.4bn' }, /revenue_eur must be a number/);
    await declined('score_initiative', { ...input, industry: 'Manufacturing' }, /industry must be one of .*map_to_taxonomy/);
    await declined('get_benchmark', { industry: 'retail', function: 'customer service' }, /function must be one of/);
    await declined('diagnose_process', { function: 'finance' }, /instances_per_year is required/);
    await declined('score_initiative', {}, /industry is required/);
  });
});

test('MCP front door holds a best-answer verdict at Fix when the proposal contradicts it', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const best = { financial_return: 'd', governance_risk: 'd', strategic_alignment: 'd', change_enablement: 'd', work_architecture: 'd' };
    const context = { industry: 'financial', function: 'risk', ai_tier: 'gen3', employees: 3500, confirmed: true, answers: best };
    const held = await call('assess_ai_initiative', { proposal: 'Autonomous agents approve consumer loans without human review.', ...context });
    assert.equal(held.verdict.classification, 'Fix');
    assert.equal(held.verdict.contradictions[0].proposal_words, 'without human review');
    assert.equal(held.verdict.holding_back[0].proposal_words, 'without human review');
    const clear = await call('assess_ai_initiative', { proposal: 'Agents draft consumer loan decisions and an underwriter approves each one.', ...context });
    assert.equal(clear.verdict.classification, 'Accelerate');
    assert.deepEqual(clear.verdict.contradictions, []);
  });
});

test('MCP evidence mode lets an agent answer alone, only from what it can quote', { timeout: 10000 }, async () => {
  await withMcp(async (call, client) => {
    const proposal = 'We are a 400-person online retailer. We want an AI agent to answer first-line customer queries and issue refunds up to 50 euros on its own.';
    const answers = { financial_return: 'c', governance_risk: 'b', strategic_alignment: 'c', change_enablement: 'c', work_architecture: 'c' };
    const evidence = {
      financial_return: { quote: 'Finance has checked the saving of 180,000 euros a year against the licence cost.', source: 'Business case v3, 4 November 2026' },
      governance_risk: { quote: 'Refund limits to be agreed after the pilot.', source: 'Steering minutes, 12 November 2026' },
      strategic_alignment: { quote: 'Target: first response under two minutes, owned by the customer director.', source: 'Objectives 2027, page 2' },
      change_enablement: { quote: 'Project lead named, with 40,000 euros set aside for training.', source: 'Project plan, 6 November 2026' },
      work_architecture: { quote: 'New workflow, team roles and override rights are designed. Team measures stay as they are.', source: 'Process design, 10 November 2026' },
    };
    const alone = { proposal, confirmed: true, answered_by: 'evidence', answers };

    // A contradiction after character 400 must survive the connector and its brief.
    const fullDesign = 'The workflow, roles and decision rights are rewritten. ' + 'The team has reviewed the new process. '.repeat(12) + 'The team measures stay as they are.';
    const best = { financial_return: 'd', governance_risk: 'd', strategic_alignment: 'd', change_enablement: 'd', work_architecture: 'd' };
    const longInput = { ...alone, answers: best, evidence: { ...evidence, governance_risk: { quote: 'The controls have been tested, Dana can stop the agent and every action is logged and reversible.', source: 'Controls report' }, work_architecture: { quote: fullDesign, source: 'Process design' } } };
    const longResult = await call('assess_ai_initiative', longInput);
    assert.equal(longResult.verdict.classification, 'Fix');
    assert.equal(longResult.verdict.answers_given.work_architecture.evidence[0].quote, fullDesign);
    const carriedDesign = JSON.parse(Buffer.from(longResult.verdict.brief_url.split('#')[1], 'base64url').toString('utf8'));
    assert.equal(carriedDesign.q.work_architecture[0][0], fullDesign);
    for (const quote of ['The workflow is rewritten. The team measures s', 'The workflow is rewritten. The team measures s…']) {
      const cutResult = await call('assess_ai_initiative', { ...longInput, evidence: { ...longInput.evidence, work_architecture: { quote, source: 'Process design' } } });
      assert.notEqual(cutResult.verdict?.classification, 'Accelerate');
      assert.deepEqual(cutResult.evidence_missing, ['work_architecture']);
    }

    const judged = await call('assess_ai_initiative', { ...alone, evidence });
    assert.equal(judged.status, 'verdict');
    assert.equal(judged.answered_by, 'evidence');
    assert.equal(judged.verdict.classification, 'Fix');
    assert.match(judged.verdict.provenance.statement, /No person has confirmed the answers/);
    assert.equal(judged.verdict.holding_back[0].evidence[0].source, 'Steering minutes, 12 November 2026');
    assert.match(judged.verdict.brief_url, /^https:\/\/www\.aibvf\.com\/verdict#[A-Za-z0-9_-]+$/);
    const carried = JSON.parse(Buffer.from(judged.verdict.brief_url.split('#')[1], 'base64url').toString('utf8'));
    assert.equal(carried.b, 'e');
    assert.equal(carried.p, undefined, 'the proposal wording stays out of the link unless the owner allows it');
    assert.deepEqual(carried.q.governance_risk, [['Refund limits to be agreed after the pilot.', 'Steering minutes, 12 November 2026']]);
    const shared = await call('assess_ai_initiative', { ...alone, evidence, brief_includes_proposal: true });
    assert.equal(JSON.parse(Buffer.from(shared.verdict.brief_url.split('#')[1], 'base64url').toString('utf8')).p, proposal);

    // An answer with nothing to quote is counted as not known, and no verdict rests on it.
    const { governance_risk: _dropped, ...partial } = evidence;
    const unsupported = await call('assess_ai_initiative', { ...alone, evidence: partial });
    assert.equal(unsupported.status, 'not_enough_to_judge');
    assert.deepEqual(unsupported.evidence_missing, ['governance_risk']);
    assert.match(unsupported.to_find_out[0].where_to_look, /limits set for the agent/);

    // An answer that rests on two documents takes a quote from each. A joined quote is not needed.
    const two = await call('assess_ai_initiative', { ...alone, evidence: { ...evidence, governance_risk: [
      { quote: 'The agent will work within a refund limit of 50 euros per order.', source: 'Steering minutes, 12 November 2026' },
      { quote: 'Nobody is named yet to approve refunds above the limit.', source: 'Service policy draft, 14 November 2026' },
    ] } });
    assert.equal(two.verdict.holding_back[0].evidence.length, 2);
    assert.equal(JSON.parse(Buffer.from(two.verdict.brief_url.split('#')[1], 'base64url').toString('utf8')).q.governance_risk.length, 2);
    const tooMany = await client.callTool({ name: 'assess_ai_initiative', arguments: { ...alone, evidence: { ...evidence, governance_risk: Array(4).fill(evidence.governance_risk) } } });
    assert.equal(tooMany.isError, true, 'a fourth quote is declined, with the field named');
    assert.match(tooMany.content[0].text, /evidence\.governance_risk/);

    // A number is no evidence.
    const refused = await client.callTool({ name: 'assess_ai_initiative', arguments: { ...alone, scores: { financial_return: 90 } } });
    assert.equal(refused.isError, true);
    assert.match(refused.content[0].text, /quote the evidence/);

    // A review is kept beside the verdict, and an agent has to quote what happened.
    const reviewed = await call('assess_ai_initiative', { ...alone, evidence, review: { previous_verdict: 'Fix', outcome: 'fixed_then_went_ahead', evidence: { quote: 'Limits signed off on 2 December, agent live from 9 December.', source: 'Steering minutes, 10 December 2026' } } });
    assert.equal(reviewed.review.accepted, true);
    assert.equal(reviewed.verdict.classification, 'Fix');
    const unquoted = await call('assess_ai_initiative', { ...alone, evidence, review: { previous_verdict: 'Fix', outcome: 'delivering' } });
    assert.equal(unquoted.review.accepted, false);

    // Two records that disagree: the answer is held as not known and both come back, with the question for the owner.
    const minutes = { quote: 'The returns lead approves every refund exception from 1 December and can switch the agent off.', source: 'Board minutes, 26 November 2026' };
    const policy = { quote: 'The agent pays refund exceptions of any amount when the customer asks twice.', source: 'Service policy v4, 3 September 2026' };
    const cleared = { ...answers, governance_risk: 'd', work_architecture: 'd' };
    const designed = { quote: 'The new workflow is drawn end to end. The roles are rewritten. Override rights and team measures are set.', source: 'Process design, 10 November 2026' };
    const conflicted = await call('assess_ai_initiative', {
      ...alone, answers: cleared, evidence: { ...evidence, governance_risk: minutes, work_architecture: designed }, evidence_against: { governance_risk: policy },
    });
    assert.equal(conflicted.status, 'not_enough_to_judge');
    assert.equal(conflicted.conflicts[0].id, 'governance_risk');
    assert.match(conflicted.conflicts[0].ask, /^Two records disagree\. Board minutes, 26 November 2026 says .* Which one applies today\?$/);

    // A return visit: the earlier brief link comes back in, and the result says what changed and what moved the verdict.
    const returned = await call('assess_ai_initiative', {
      ...alone, answers: cleared, evidence: { ...evidence, governance_risk: minutes, work_architecture: designed },
      review: { previous_brief: judged.verdict.brief_url },
    });
    assert.equal(returned.verdict.classification, 'Accelerate');
    assert.equal(returned.review.previous_verdict, 'Fix');
    assert.equal(returned.review.since_last.verdict_changed, true);
    assert.deepEqual(returned.review.since_last.changes.map((change) => change.id), ['governance_risk', 'work_architecture']);
    assert.match(returned.review.since_last.statement, /^The verdict moved from Fix to Accelerate\. Two answers changed since /);
    const carriedBack = JSON.parse(Buffer.from(returned.verdict.brief_url.split('#')[1], 'base64url').toString('utf8'));
    assert.equal(carriedBack.r.v, 'Fix', 'the new brief link carries the earlier verdict');
    // The funding record sits beside the verdict, and the agreed results come back from the earlier link at the return visit.
    const agreed = { quote: 'Release rollout funds if cost per contact falls to 2 euros or less.', source: 'Sponsor note, 20 November 2026' };
    const asked = { quote: 'We ask for 40,000 euros for the pilot from 1 December.', source: 'Project plan, 6 November 2026' };
    const funded = await call('assess_ai_initiative', { ...alone, evidence, funding: {
      stage: 'pilot', ask: { amount_eur: 40000, evidence: asked },
      thresholds: [{ measure: 'Cost per contact', unit: 'euros', direction: 'at_most', target: 2, baseline: 3.1, baseline_kind: 'measured', evidence: agreed }],
    } });
    assert.equal(funded.verdict.classification, 'Fix', 'the funding record does not move the verdict');
    assert.equal(funded.funding.ask.amount_eur, 40000);
    assert.equal(funded.funding.thresholds[0].line, 'Cost per contact. Today: €3.10, measured. Agreed: at most €2.');
    assert.deepEqual(funded.funding.gaps, ['No alternative is named, such as fixing the process as it is.']);
    assert.match(funded.funding.note, /does not say whether to fund/);
    const measured = await call('assess_ai_initiative', { ...alone, evidence, review: { previous_brief: funded.verdict.brief_url }, funding: {
      results: [{ measure: 'Cost per contact', value: 2.4, kind: 'measured', evidence: { quote: 'Cost per contact in December: 2.40 euros.', source: 'Pilot results, 31 December 2026' } }],
    } });
    assert.equal(measured.funding.review.met, 0);
    assert.match(measured.funding.review.statement, /^One result was agreed on \d+ \w+ \d{4}\. It is not met\. Not met: Cost per contact, at most €2 agreed, €2\.40 measured\.$/);
    const unquotedFigure = await call('assess_ai_initiative', { ...alone, evidence, funding: { ask: { amount_eur: 40000 } } });
    assert.equal(unquotedFigure.funding.ask, undefined, 'an agent keeps a figure only where it can quote it');

    const shortened = await client.callTool({ name: 'assess_ai_initiative', arguments: { ...alone, evidence, review: { previous_brief: 'https://bit.ly/3xYz' } } });
    assert.equal(shortened.isError, true, 'a shortened or changed link is refused');
    assert.match(shortened.content[0].text, /brief link the earlier verdict came with/);

    // A person-answered verdict is unchanged, and still gets its brief link.
    const owner = await call('assess_ai_initiative', { proposal, confirmed: true, answers });
    assert.equal(owner.answered_by, undefined);
    assert.equal(owner.verdict.provenance, undefined);
    assert.equal(JSON.parse(Buffer.from(owner.verdict.brief_url.split('#')[1], 'base64url').toString('utf8')).b, undefined);
  });
});

test('MCP offers the agent operating brief as a prompt and tells every assistant both ways of working', { timeout: 10000 }, async () => {
  await withMcp(async (_call, client) => {
    assert.match(client.getInstructions() || '', /WITH A PERSON PRESENT/);
    assert.match(client.getInstructions() || '', /WORKING ALONE/);
    assert.match(client.getInstructions() || '', /aibvf_agent/);
    const listed = await client.listPrompts();
    assert.deepEqual(listed.prompts.map((prompt) => prompt.name), ['aibvf_agent']);
    const brief = await client.getPrompt({ name: 'aibvf_agent' });
    const text = brief.messages[0].content.text;
    assert.match(text, /Evidence or unknown\. Never choose an answer or a company fact you cannot quote\./);
    assert.match(text, /May do: draft\. Send nothing, spend nothing, change no system\./);
    await assert.rejects(client.getPrompt({ name: 'nope' }));
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 13, 'the prompt adds no tool');
    const door = tools.tools.find((tool) => tool.name === 'assess_ai_initiative');
    assert.match(door.description, /WORKING ALONE/);
    assert.ok(door.inputSchema.properties.answered_by && door.inputSchema.properties.evidence && door.inputSchema.properties.review);
  });
});

test('MCP publishes one working call per tool, and each one succeeds the first time', { timeout: 20000 }, async () => {
  await withMcp(async (_call, client) => {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 13);
    for (const tool of tools) {
      const example = tool.inputSchema.examples?.[0];
      assert.ok(example && typeof example === 'object', `${tool.name} publishes no example call`);
      for (const field of tool.inputSchema.required ?? []) assert.ok(field in example, `${tool.name} example omits required ${field}`);
      const response = await client.callTool({ name: tool.name, arguments: example });
      assert.notEqual(response.isError, true, `${tool.name} declined its own example: ${response.content?.[0]?.text}`);
      assert.ok(response.structuredContent && Object.keys(response.structuredContent).length > 0, `${tool.name} returned nothing for its example`);
    }
  });
});

test('MCP diagnose_process gives the saving as a share of today\'s cost, the confidence in words, and what the figure rests on', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const verdict = await call('diagnose_process', {
      process_id: 'Delivery complaint', function: 'cx', instances_per_year: 1521, fte_hours_per_instance: 0.49, loaded_hourly_rate_eur: 38,
      cycle_time_days: 0.61, touch_ratio: 0.08, handoffs: 2, rework_rate: 0.19, automation_level: 0.27, direct_spend_eur: 0, signal_completeness: 0.89,
    });
    // Waiting and manual work both round to 0.33 of the drag. The larger one as counted decides, and the close call is said.
    assert.equal(verdict.intervention, 'Consolidate & re-sequence');
    assert.match(verdict.assumptions[1], /^close call: wait is 33\.4 percent of the drag and manual is 33\.2 percent/);
    assert.deepEqual(verdict.net_saving_eur, { low: 2832, high: 7930 });
    assert.deepEqual(verdict.net_saving_pct, { low: 10, high: 28 });
    // One scale: the figure from 0 to 100, and the word the engine gives for it.
    assert.equal(verdict.decision_confidence, 79);
    assert.equal(verdict.confidence_band, 'high');
    assert.ok(verdict.assumptions.some((line) => line.startsWith('saving band for Consolidate & re-sequence: 20 to 40 percent') && line.includes('The band is a draft')));
    assert.ok(verdict.assumptions.some((line) => line.startsWith('share kept: 50 to 70 percent') && line.includes('this is the default')));
    const low = await call('diagnose_process', {
      process_id: 'thin', function: 'sales', instances_per_year: 2000, fte_hours_per_instance: 1, loaded_hourly_rate_eur: 50,
      cycle_time_days: 20, touch_ratio: 0.2, handoffs: 4, rework_rate: 0.1, automation_level: 0.1, direct_spend_eur: 0, signal_completeness: 0.3,
    });
    assert.ok(low.decision_confidence < 50, String(low.decision_confidence));
    assert.equal(low.confidence_band, 'low');
  });
});

// From the audit of 24 November 2026. The portfolio tools pass one document along:
// assemble it, score it, sequence it. Each takes what the one before returned.
test('MCP portfolio chain runs from start to finish, and an estimate stays an estimate all the way', { timeout: 15000 }, async () => {
  await withMcp(async (call) => {
    const ready = { workflow_redesigned: true, roles_redesigned: true, decision_rights_defined: true, measures_updated: true };
    const assembled = await call('assemble_portfolio', {
      organization: { name: 'Halden & Co', industry: 'retail', revenue_eur: 400000000 },
      readiness: 'traditional',
      initiatives: [
        { name: 'Invoice matching', function: 'finance', ai_tier: 'gen1', scores: { strategic_alignment: 80, financial_return: 75, change_enablement: 70, governance_risk: 20 } },
        { name: 'Service assistant', function: 'cx', ai_tier: 'gen2', scores: { strategic_alignment: 65 } },
        { name: 'Credit decisions', function: 'risk', ai_tier: 'gen3', scores: { strategic_alignment: 60, financial_return: 60, change_enablement: 60, governance_risk: 85 } },
      ],
    });
    // The estimate is marked in the document itself.
    const assistant = assembled.portfolio.initiatives.find((item) => item.name === 'Service assistant');
    assert.deepEqual(assistant.scores.financial_return, { value: assistant.scores.financial_return.value, confidence: 40, basis: 'estimated' });
    assembled.portfolio.initiatives[0].work_architecture = ready;

    const scored = await call('score_portfolio', { portfolio: assembled.portfolio, readiness: assembled.readiness_used });
    assert.equal(scored.organization.revenue_eur, 400000000);
    const verdicts = Object.fromEntries(scored.scored_initiatives.map((item) => [item.name, item.classification]));
    assert.deepEqual(verdicts, { 'Invoice matching': 'Accelerate', 'Service assistant': 'Fix', 'Credit decisions': 'Stop' });
    assert.deepEqual(scored.scored_initiatives[1].pillar_basis, { strategic_alignment: 'given', financial_return: 'estimated', change_enablement: 'estimated', governance_risk: 'estimated' });

    // The description of sequence_portfolio says: pass the portfolio returned by score_portfolio directly through portfolio.
    const plan = await call('sequence_portfolio', { portfolio: scored });
    const placed = Object.fromEntries(plan.waves.flatMap((wave) => wave.initiatives.map((item) => [item.name, item.classification])));
    assert.deepEqual(placed, verdicts, 'the sequencer reaches the verdicts score_portfolio reached');
    const sequencedAssistant = plan.waves.flatMap((wave) => wave.initiatives).find((item) => item.name === 'Service assistant');
    assert.equal(sequencedAssistant.decision_confidence, scored.scored_initiatives[1].decision_confidence);
    assert.equal(plan.warnings, undefined);

    // An agent that flattens the estimated pillars to bare numbers and says which are estimated gets the same result.
    const flat = Object.fromEntries(Object.entries(assistant.scores).map(([pillar, value]) => [pillar, typeof value === 'number' ? value : value.value]));
    const context = { industry: 'retail', revenue_eur: 400000000, function: 'cx', ai_tier: 'gen2', readiness: 'traditional' };
    const single = await call('score_initiative', { ...context, scores: assistant.scores });
    const marked = await call('score_initiative', { ...context, scores: flat, pillar_basis: scored.scored_initiatives[1].pillar_basis });
    assert.deepEqual(single.pillar_basis, scored.scored_initiatives[1].pillar_basis);
    assert.deepEqual(marked.pillar_basis, single.pillar_basis);
    // Bare numbers with no word on where they came from are still read as given: the caller has said nothing else.
    const unmarked = await call('score_initiative', { ...context, scores: flat });
    assert.deepEqual(Object.values(unmarked.pillar_basis), ['given', 'given', 'given', 'given']);
    // The document's own confidence of 40 on each estimate counts for a little less than the bare word "estimated".
    assert.ok(single.decision_confidence <= marked.decision_confidence && marked.decision_confidence < unmarked.decision_confidence, `${single.decision_confidence} ${marked.decision_confidence} ${unmarked.decision_confidence}`);
    assert.equal(scored.scored_initiatives[1].signal_completeness, 0.55);
  });
});

test('MCP signal_completeness is an upper limit: a caller can lower the signal and cannot raise it', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const context = { industry: 'retail', revenue_eur: 500000000, function: 'cx', ai_tier: 'gen2', readiness: 'traditional' };
    const none = await call('score_initiative', context);
    const raised = await call('score_initiative', { ...context, signal_completeness: 1 });
    // With no pillar supplied, a signal of 1 used to lift the score from 38 to 51.
    assert.equal(none.decision_confidence, 38);
    assert.equal(raised.decision_confidence, 38);
    assert.match(raised.caveat, /signal_completeness 1 was given\. The pillars supplied support 0\.5, so 0\.5 is used/);
    assert.deepEqual(raised.audit.inputs_used.signal_completeness, { used: 0.5, supported: 0.5, given: 1 });
    assert.ok(raised.audit.rules_fired.includes('signal_completeness:0.5(given 1, capped at what the pillars support)'));
    // Lowering still works, and a signal within what the pillars support is used as given.
    const all = { strategic_alignment: 70, financial_return: 70, change_enablement: 70, governance_risk: 30 };
    const full = await call('score_initiative', { ...context, scores: all });
    const lowered = await call('score_initiative', { ...context, scores: all, signal_completeness: 0.4 });
    assert.ok(lowered.decision_confidence < full.decision_confidence);
    assert.deepEqual(lowered.audit.inputs_used.signal_completeness, { used: 0.4, supported: 1, given: 0.4 });
    // A pillar given with a low confidence lowers what the pillars support.
    const doubted = await call('score_initiative', { ...context, scores: { ...all, financial_return: { value: 70, confidence: 20 } } });
    assert.equal(doubted.pillar_basis.financial_return, 'given');
    assert.ok(doubted.decision_confidence < full.decision_confidence);
    // The verdict itself never moves with the signal.
    assert.equal(lowered.classification, full.classification);
  });
});

test('MCP says which fields of a call it did not read', { timeout: 20000 }, async () => {
  await withMcp(async (call, client) => {
    const context = { industry: 'retail', revenue_eur: 500000000, function: 'cx', ai_tier: 'gen2', readiness: 'traditional' };
    // "socres" for "scores": the verdict rests on defaults, and the answer now says why.
    const typo = await call('score_initiative', { ...context, socres: { strategic_alignment: 90, financial_return: 90, change_enablement: 90, governance_risk: 10 } });
    assert.deepEqual(typo.warnings, [{ code: 'unknown_field', path: 'socres', message: '"socres" is not a field this tool reads, so it was ignored. Did you mean "scores"?' }]);
    assert.equal(typo.pillar_basis.strategic_alignment, 'estimated');
    // Inside an object the schema names, too.
    const nested = await call('score_initiative', { ...context, scores: { strategic_alignment: 70, finacial_return: 80 } });
    assert.equal(nested.warnings[0].path, 'scores.finacial_return');
    assert.match(nested.warnings[0].message, /Did you mean "financial_return"\?/);
    assert.equal((await call('calculate_pace_layer_drag', { revenue_eur: 1000000, ai_tier: 'gen2', readiness: 'siloed', foo: 1 })).warnings[0].path, 'foo');
    // A call with nothing unknown carries no warnings field, and no published example sets one off.
    assert.equal((await call('score_initiative', context)).warnings, undefined);
    const { tools } = await client.listTools();
    for (const tool of tools) {
      const response = await client.callTool({ name: tool.name, arguments: tool.inputSchema.examples[0] });
      assert.equal(response.structuredContent.warnings, undefined, `${tool.name}: ${JSON.stringify(response.structuredContent.warnings)}`);
      assert.ok(tool.outputSchema.properties.warnings, `${tool.name} publishes no warnings field`);
    }
  });
});

test('MCP assemble_portfolio says when the same initiative seems to be entered twice', { timeout: 10000 }, async () => {
  await withMcp(async (call) => {
    const assembled = await call('assemble_portfolio', {
      organization: { name: 'Halden & Co', industry: 'retail', revenue_eur: 400000000 },
      initiatives: [
        { name: 'Invoice matching', function: 'finance', ai_tier: 'gen1' },
        { name: 'invoice matching ', function: 'finance', ai_tier: 'gen1' },
        { name: 'Invoice matching', function: 'finance', ai_tier: 'gen2' },
      ],
    });
    // Both are kept: the tool does not decide which one is real. The third differs in tier and is no duplicate.
    assert.deepEqual(assembled.portfolio.initiatives.map((item) => item.id), ['invoice-matching', 'invoice-matching-2', 'invoice-matching-3']);
    const issues = assembled.issues.filter((issue) => issue.code === 'duplicate_suspected');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].path, 'initiatives[1]');
    assert.match(issues[0].msg, /Same name, function and tier as initiatives\[0\] \("invoice-matching"\)\. Both are kept, this one as "invoice-matching-2"/);
  });
});

test('the remote endpoint answers a call with no Origin and refuses a web page it does not know', async () => {
  const { isAllowedOrigin } = await import('./dist/server.js');
  for (const origin of [undefined, '', 'https://www.aibvf.com', 'https://aibvf.com', 'http://localhost:6274', 'http://127.0.0.1:3000', 'app://claude', 'vscode-webview://abc']) {
    assert.equal(isAllowedOrigin(origin), true, String(origin));
  }
  for (const origin of ['https://evil.example', 'https://aibvf.com.evil.example', 'http://aibvf.com.evil.example:8080', 'null', 'not an origin']) {
    assert.equal(isAllowedOrigin(origin), false, String(origin));
  }
});
