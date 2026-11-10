/**
 * The front-door result in everyday words: one sentence for the outcome,
 * the answers that hold the initiative back, and the one thing to do first.
 * Built only from what the user answered or supplied.
 */
import {
  FIRST_STEP, GO_AHEAD_STEP, QUESTION_SHORT, UNKNOWN_LABEL, WORDING, WORK_PARTS, WORK_PART_WORDING,
} from './guidedQuestions.js';
import type {
  AssessAnswer, AssessHoldingBack, AssessQuestionId, AssessTrack, Classification, PillarScores,
  WorkArchitectureAssessment,
} from './types.js';

type Pillar = keyof PillarScores;

/** The two answers that can stop the initiative come first, then the two a go-ahead needs. */
const PILLAR_ORDER: Pillar[] = ['financial_return', 'governance_risk', 'strategic_alignment', 'change_enablement'];
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];

function clears(pillar: Pillar, value: number): boolean {
  return pillar === 'governance_risk' ? value <= 40 : value >= 60;
}

function stops(pillar: Pillar, value: number): boolean {
  return (pillar === 'governance_risk' && value >= 70) || (pillar === 'financial_return' && value <= 20);
}

export interface PlainResultInput {
  track: AssessTrack;
  classification: Classification;
  supplied: Partial<PillarScores>;
  answers: Partial<Record<AssessQuestionId, AssessAnswer>>;
  work: WorkArchitectureAssessment;
  /** True when the user answered the work question or supplied the four checks. */
  workAnswered: boolean;
  /** True when the user answered the work question with "I do not know yet". */
  workUnknown: boolean;
}

export interface PlainResult {
  summary: string;
  holding_back: AssessHoldingBack[];
  first_step: string;
}

function openWorkParts(work: WorkArchitectureAssessment) {
  return WORK_PARTS.filter((part) => work.checks.find((check) => check.id === part)?.status !== 'met');
}

export function plainResult(input: PlainResultInput): PlainResult {
  const { track, classification, supplied, answers, work } = input;
  const wording = WORDING[track];

  const failing = PILLAR_ORDER.filter((pillar) => supplied[pillar] !== undefined && !clears(pillar, supplied[pillar]!));
  // An answer that stops the initiative on its own leads the list. When both stop it,
  // risk leads, which is the cause the verdict's reason names.
  const rank = (pillar: Pillar) => (!stops(pillar, supplied[pillar]!) ? 2 : pillar === 'governance_risk' ? 0 : 1);
  failing.sort((x, y) => rank(x) - rank(y));

  const holdingBack: AssessHoldingBack[] = failing.map((pillar) => {
    const answer = answers[pillar];
    return {
      id: pillar,
      short: QUESTION_SHORT[track][pillar],
      question: wording[pillar].question,
      answer: answer ? answer.label : `A score of ${supplied[pillar]} out of 100.`,
      needed: answer ? wording[pillar].c : pillar === 'governance_risk' ? 'A score of 40 or less.' : 'A score of 60 or more.',
    };
  });

  // The work redesign holds the initiative back only once it has been asked about or supplied.
  const pillarsClear = PILLAR_ORDER.every((pillar) => supplied[pillar] !== undefined && clears(pillar, supplied[pillar]!));
  const workBlocks = work.status !== 'ready' && (input.workAnswered || input.workUnknown || pillarsClear);
  const stillOpen = openWorkParts(work);
  if (workBlocks) {
    const names = stillOpen.map((part) => WORK_PART_WORDING[track][part].name);
    const answer = answers.work_architecture;
    holdingBack.push({
      id: 'work_architecture',
      short: QUESTION_SHORT[track].work_architecture,
      question: wording.work_architecture.question,
      answer: answer ? answer.label : input.workUnknown || !input.workAnswered ? UNKNOWN_LABEL : `Not shown as changed: ${names.join(', ')}.`,
      needed: wording.work_architecture.d,
    });
  }

  if (classification === 'Accelerate') {
    const answered = Object.keys(answers).length > 0;
    return {
      summary: answered ? 'Go ahead. Your answers clear the bar on every question.' : 'Go ahead. Every score clears the bar.',
      holding_back: [],
      first_step: GO_AHEAD_STEP,
    };
  }

  const first = holdingBack[0];
  const firstStep = !first
    ? GO_AHEAD_STEP
    : first.id === 'work_architecture'
      ? WORK_PART_WORDING[track][stillOpen[0] ?? 'workflow_redesigned'].step
      : FIRST_STEP[track][first.id];

  let summary: string;
  if (classification === 'Stop') {
    const stopper = failing.find((pillar) => stops(pillar, supplied[pillar]!));
    const answer = stopper ? answers[stopper] : undefined;
    summary = answer
      ? `Stop. ${answer.label}`
      : stopper === 'financial_return'
        ? 'Stop. The return is too thin for the cost.'
        : 'Stop. The risk is above the level where this can go ahead.';
  } else {
    const count = holdingBack.length;
    const things = `${COUNT_WORDS[count] ?? count} thing${count === 1 ? '' : 's'}`;
    // The work question is asked only once the four answers clear, so it is still to come here.
    const workStillToAsk = work.status !== 'ready' && !workBlocks;
    summary = workStillToAsk
      ? `Fix ${things} first. The question on how the work changes comes after that.`
      : `Fix ${things} before you go ahead.`;
  }

  return { summary, holding_back: holdingBack, first_step: firstStep };
}
