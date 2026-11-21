/**
 * The guided questions: at most five, each with four everyday answers and
 * "I do not know yet". Every answer carries a fixed, published score, so a
 * regular user never types a number and the engine never fills one in.
 *
 * Two wordings, one rule set. Organisations under 250 people get questions
 * phrased for an owner; larger ones get questions phrased for an executive.
 * The scores behind the answers, the thresholds and the work redesign gate
 * are identical for both.
 */
import type {
  AssessChoiceId, AssessQuestionId, AssessTrack, PillarScores, WorkArchitectureInput,
} from './types.js';

/** Organisations below this headcount get the smaller-firm wording. */
export const SMALLER_FIRM_BELOW = 250;

export const UNKNOWN_LABEL = 'I do not know yet.';

/**
 * The score each answer carries. governance_risk is inverted: higher means more risk.
 * On cost and return, the evidence decides and the length of the payback does not.
 * The four answers run from a loss, to untested figures, to figures finance has
 * checked, to results measured in a pilot or in live use.
 */
export const CHOICE_SCORES: Record<keyof PillarScores, Record<Exclude<AssessChoiceId, 'unknown'>, number>> = {
  financial_return:    { a: 15, b: 40, c: 65, d: 85 },
  governance_risk:     { a: 80, b: 55, c: 35, d: 15 },
  strategic_alignment: { a: 20, b: 45, c: 65, d: 85 },
  change_enablement:   { a: 20, b: 45, c: 65, d: 85 },
};

/** The work redesign answers are cumulative: each one includes the one before. */
export const WORK_ARCHITECTURE_CHOICES: Record<Exclude<AssessChoiceId, 'unknown'>, Required<WorkArchitectureInput>> = {
  a: { workflow_redesigned: false, roles_redesigned: false, decision_rights_defined: false, measures_updated: false },
  b: { workflow_redesigned: true,  roles_redesigned: false, decision_rights_defined: false, measures_updated: false },
  c: { workflow_redesigned: true,  roles_redesigned: true,  decision_rights_defined: true,  measures_updated: false },
  d: { workflow_redesigned: true,  roles_redesigned: true,  decision_rights_defined: true,  measures_updated: true },
};

export interface Wording { question: string; a: string; b: string; c: string; d: string }

/** Why each answer decides the outcome, stated as the rule the engine applies. */
export const QUESTION_WHY: Record<AssessTrack, Record<AssessQuestionId, string>> = {
  smaller_firm: {
    financial_return: 'If it costs more than it saves, the answer is stop.',
    governance_risk: 'If it deals with customers, money or personal data and nobody checks it, the answer is stop.',
    strategic_alignment: 'A go-ahead needs one number, a target and someone responsible.',
    change_enablement: 'A go-ahead needs a named person with time set aside.',
    work_architecture: 'A go-ahead needs all four parts of the job changed.',
  },
  enterprise: {
    financial_return: 'A return below the cost stops the initiative on its own.',
    governance_risk: 'Risk that nobody controls stops the initiative on its own.',
    strategic_alignment: 'A go-ahead needs a tracked result with a target and a named owner.',
    change_enablement: 'A go-ahead needs a named owner and funded change work.',
    work_architecture: 'A go-ahead needs the work redesigned in all four parts.',
  },
};

/** A short name for each question, for lists of answers. */
export const QUESTION_SHORT: Record<AssessTrack, Record<AssessQuestionId, string>> = {
  smaller_firm: {
    financial_return: 'Cost and return',
    governance_risk: 'What could go wrong',
    strategic_alignment: 'What gets better',
    change_enablement: 'Who makes it happen',
    work_architecture: 'How the work changes',
  },
  enterprise: {
    financial_return: 'Cost and return',
    governance_risk: 'Risk and control',
    strategic_alignment: 'Business result',
    change_enablement: 'Ownership of the change',
    work_architecture: 'Redesign of the work',
  },
};

/** The one thing to do first when an answer holds the initiative back. */
export const FIRST_STEP: Record<AssessTrack, Record<keyof PillarScores, string>> = {
  smaller_firm: {
    financial_return: 'Write down what it costs each month and what it saves, and check the numbers.',
    governance_risk: 'Name one person who checks its work and can switch it off.',
    strategic_alignment: 'Pick one number in the business this should move, set a target and make someone responsible.',
    change_enablement: 'Name who makes this happen and set time aside for them.',
  },
  enterprise: {
    financial_return: 'Build the cost and return case on measured figures and have finance check it.',
    governance_risk: 'Name the owner of the risks, give that person the right to override, and put its work under review.',
    strategic_alignment: 'Tie it to a result the organisation already tracks, with a target and a named executive owner.',
    change_enablement: 'Name the owner of the change and fund the change work.',
  },
};

/** The four parts of the work redesign, in the order they are done. */
export const WORK_PARTS = ['workflow_redesigned', 'roles_redesigned', 'decision_rights_defined', 'measures_updated'] as const;
export type WorkPart = typeof WORK_PARTS[number];

/** Each part of the work redesign in everyday words, and the step that completes it. */
export const WORK_PART_WORDING: Record<AssessTrack, Record<WorkPart, { name: string; step: string }>> = {
  smaller_firm: {
    workflow_redesigned: { name: 'the steps of the job', step: 'Write down the new steps of the job, with the AI in them.' },
    roles_redesigned: { name: 'who does what', step: 'Agree who does what once the AI is doing its part.' },
    decision_rights_defined: { name: 'who decides and who can overrule', step: 'Agree who decides, and who can overrule the AI.' },
    measures_updated: { name: 'how good work is judged', step: 'Change how good work is judged, so people are measured on the new way of working.' },
  },
  enterprise: {
    workflow_redesigned: { name: 'the workflow', step: 'Redesign the end-to-end workflow around the AI and the human judgement that stays.' },
    roles_redesigned: { name: 'the roles', step: 'Rewrite the affected roles and accountabilities.' },
    decision_rights_defined: { name: 'the decision and override rights', step: 'Name the people who hold the decision, override and escalation rights.' },
    measures_updated: { name: 'the measures people are judged on', step: 'Update the performance measures and incentives to match the redesigned work.' },
  },
};

/** The first step once every answer clears the bar. */
export const GO_AHEAD_STEP = 'Go ahead, and answer the same questions again at the first review.';

export const WORDING: Record<AssessTrack, Record<AssessQuestionId, Wording>> = {
  enterprise: {
    financial_return: {
      question: 'What does it cost to build and run, and what does it return each year?',
      a: 'It costs more than it returns.',
      b: 'The return rests on figures nobody has tested, or it only breaks even.',
      c: 'The return covers the cost, on figures finance has checked.',
      d: 'The return covers the cost, on results measured in a pilot or in live use.',
    },
    governance_risk: {
      question: 'What could go wrong, and who can stop or override the AI?',
      a: 'It acts on customers, money or regulated decisions, and nobody can stop or override it.',
      b: 'The risks are known, and no named person owns them.',
      c: 'A named person owns the risks, checks its work and can override it.',
      d: 'The controls are tested, a named person can stop it, and its actions are logged and reviewed.',
    },
    strategic_alignment: {
      question: 'Which business result does this move, and by how much?',
      a: 'No business result is named.',
      b: 'A result is named, with no target.',
      c: 'A result the organisation already tracks, with a target and a named executive owner.',
      d: 'A board-level result, with a target, a named owner and a baseline measured today.',
    },
    change_enablement: {
      question: 'Who owns the change, and are the time and budget for it funded?',
      a: 'Nobody owns it.',
      b: 'An owner is named, with no time or budget for the change work.',
      c: 'An owner is named and the change work is funded.',
      d: 'A senior sponsor is active, the owner is named, the change work is funded and the people affected are involved.',
    },
    work_architecture: {
      question: 'What has been redesigned in the work itself before go-live?',
      a: 'Nothing yet. The AI is added to the existing process.',
      b: 'The workflow has been redesigned.',
      c: 'The workflow, the affected roles, and the decision and override rights have been redesigned.',
      d: 'All four: the workflow, the roles, the decision and override rights, and the measures people are judged on.',
    },
  },
  smaller_firm: {
    financial_return: {
      question: 'What does it cost each month, and what does it save or earn?',
      a: 'It costs more than it saves.',
      b: 'We are estimating, or it only breaks even.',
      c: 'It pays for itself, on numbers we have checked.',
      d: 'It pays for itself, on results we have measured in a trial or in use.',
    },
    governance_risk: {
      question: 'What could go wrong, and who can step in?',
      a: 'It deals with customers, money or personal data, and nobody checks it.',
      b: 'We know the risks, and nobody is responsible for them.',
      c: 'One named person is responsible, checks its work and can step in.',
      d: 'It has been tested, one person can switch it off, and what it does is recorded and reviewed.',
    },
    strategic_alignment: {
      question: 'What will be better in the business, and by how much?',
      a: 'We have not said.',
      b: 'We know what should improve, with no target.',
      c: 'One number we already watch, with a target and someone responsible.',
      d: 'The number that matters most to the business, with a target, someone responsible and the figure for today written down.',
    },
    change_enablement: {
      question: 'Who makes this happen, and do they have the time?',
      a: 'Nobody in particular.',
      b: 'Someone is named, on top of their normal job.',
      c: 'Someone is named and has time set aside.',
      d: 'The owner backs it, someone is named with time set aside, and the people who will use it are involved.',
    },
    work_architecture: {
      question: 'What changes in how the work gets done?',
      a: 'Nothing yet. We are adding the AI to how we work today.',
      b: 'We have rewritten the steps of the job.',
      c: 'We have rewritten the steps, who does what, and who decides or overrides.',
      d: 'All four: the steps, who does what, who decides, and how we judge good work.',
    },
  },
};

/**
 * Agentic AI takes actions on its own, so its risk question asks what it may do
 * without a person approving it. Same four scores and the same stop rule as the
 * standard risk question: only the wording is specific to an agent.
 */
export const AGENT_RISK_WORDING: Record<AssessTrack, Wording> = {
  enterprise: {
    question: 'What can the agent do without a person approving it, and who can stop it?',
    a: 'It can spend money, change records or contact customers, with no limit and no approval.',
    b: 'It works within limits, and nobody has written them down or owns them.',
    c: 'Its limits are written down, and a named person approves anything above them and can stop it.',
    d: 'Its limits are tested, a named person can stop it, and every action is logged and can be reversed.',
  },
  smaller_firm: {
    question: 'What can the agent do without someone approving it, and who can step in?',
    a: 'It can spend money, change records or contact customers, and nobody approves or limits it.',
    b: 'It has limits, and nobody has written them down.',
    c: 'Its limits are written down, and one named person approves anything beyond them and can step in.',
    d: 'Its limits have been tested, one person can switch it off, and everything it does is recorded and can be undone.',
  },
};

export const AGENT_RISK_WHY: Record<AssessTrack, string> = {
  enterprise: 'An agent that acts with no limit and no approval stops the initiative on its own.',
  smaller_firm: 'If the agent can act without limits and nobody approves it, the answer is stop.',
};

export const AGENT_RISK_FIRST_STEP: Record<AssessTrack, string> = {
  enterprise: 'Write down what the agent may do without approval, name the person who approves anything above that, and give that person the right to stop it.',
  smaller_firm: 'Write down what the agent may do on its own, and name one person who approves the rest and can switch it off.',
};

const isAgentRisk = (id: AssessQuestionId, aiTier?: string) => id === 'governance_risk' && aiTier === 'gen3';

/** The wording of a question for this organisation and AI type. Use these in place of the tables. */
export function wordingFor(track: AssessTrack, id: AssessQuestionId, aiTier?: string): Wording {
  return isAgentRisk(id, aiTier) ? AGENT_RISK_WORDING[track] : WORDING[track][id];
}
export function whyFor(track: AssessTrack, id: AssessQuestionId, aiTier?: string): string {
  return isAgentRisk(id, aiTier) ? AGENT_RISK_WHY[track] : QUESTION_WHY[track][id];
}
export function firstStepFor(track: AssessTrack, id: keyof PillarScores, aiTier?: string): string {
  return isAgentRisk(id, aiTier) ? AGENT_RISK_FIRST_STEP[track] : FIRST_STEP[track][id];
}

/**
 * Where the answer to each question is usually written down. Returned with
 * every question, so a person or an agent knows where to look before saying
 * "I do not know yet".
 */
export const WHERE_TO_LOOK: Record<AssessQuestionId, string> = {
  financial_return: 'The business case, the budget request, a finance sign-off or the results of a pilot.',
  governance_risk: 'The risk assessment, the approval or control design, and the record of who can overrule the AI.',
  strategic_alignment: 'The objectives or plan the initiative is tied to, with its target and its owner.',
  change_enablement: 'The project plan and its budget: the named owner, the money for the change work and the time people are given.',
  work_architecture: 'The process design: the new workflow, the roles, who decides and overrides, and the measures people are judged on.',
};
export const AGENT_RISK_WHERE_TO_LOOK = 'The limits set for the agent, the rule for approving anything above them, and the record of who can stop it.';

export function whereToLookFor(id: AssessQuestionId, aiTier?: string): string {
  return id === 'governance_risk' && aiTier === 'gen3' ? AGENT_RISK_WHERE_TO_LOOK : WHERE_TO_LOOK[id];
}

export function trackFor(employees: number): AssessTrack {
  return employees < SMALLER_FIRM_BELOW ? 'smaller_firm' : 'enterprise';
}
