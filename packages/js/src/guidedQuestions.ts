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

/** The score each answer carries. governance_risk is inverted: higher means more risk. */
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

interface Wording { question: string; a: string; b: string; c: string; d: string }

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
      b: 'It roughly breaks even, or the return rests on assumptions nobody has tested.',
      c: 'The return covers the cost within two years, on figures finance has checked.',
      d: 'The return covers the cost within a year, on measured figures.',
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
      b: 'About even, or we are estimating.',
      c: 'It pays for itself within two years, on numbers we have checked.',
      d: 'It pays for itself within a year, on numbers we have measured.',
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

export function trackFor(employees: number): AssessTrack {
  return employees < SMALLER_FIRM_BELOW ? 'smaller_firm' : 'enterprise';
}
