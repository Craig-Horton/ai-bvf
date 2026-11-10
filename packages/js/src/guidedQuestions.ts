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

export const QUESTION_WHY: Record<AssessQuestionId, string> = {
  financial_return: 'A return too thin for the scope stops the initiative on its own.',
  governance_risk: 'Risk that nobody controls stops the initiative on its own.',
  strategic_alignment: 'Accelerate needs a clear link to a result the organisation already tracks.',
  change_enablement: 'Accelerate needs a named owner and funded change work.',
  work_architecture: 'Accelerate needs the work redesigned around the AI, with all four parts shown.',
};

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
