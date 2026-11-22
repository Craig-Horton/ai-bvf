/**
 * The funding record: what the person who holds the budget still needs to
 * know once the verdict is read. It sits beside the verdict and never changes
 * it.
 *
 * It holds what is asked for the next stage, the alternative, and the results
 * the owner agreed would release more money. Every figure is the
 * organisation's own, repeated with its source and marked measured, estimate
 * or not known. The engine works out none of them.
 *
 * At a return visit the agreed results travel back in the earlier brief link,
 * and today's results are set beside them as met or not met. The engine never
 * says fund or do not fund. That decision stays with the person who holds the
 * budget.
 */
import type {
  AssessEvidence, AssessFunding, AssessFundingInput, AssessFundingThreshold, FundingDecision, FundingKind, FundingStage,
} from './types.js';

export const FUNDING_STAGES: readonly FundingStage[] = ['pilot', 'rollout'];
export const FUNDING_DECISIONS: readonly FundingDecision[] = ['released', 'deferred', 'withdrew'];
/** The three decisions in everyday words, for a person or an agent to choose from at a review. */
export const FUNDING_DECISION_LABEL: Record<FundingDecision, string> = {
  released: 'The next round of money was released.',
  deferred: 'The decision was put off until more is known.',
  withdrew: 'The request was withdrawn.',
};
export const FUNDING_NOTE = 'Every figure here is the organisation\'s own. AI BVF works out none of them, and it does not say whether to fund. That decision stays with the person who holds the budget.';
/** At most this many agreed results. More than a few and none of them decides. */
export const FUNDING_THRESHOLDS_MAX = 3;

const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const KIND_WORD: Record<FundingKind, string> = { measured: 'measured', estimate: 'an estimate', unknown: 'not known' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const text = (given: unknown, limit: number): string => (typeof given === 'string' ? given.replace(/\s+/g, ' ').trim().slice(0, limit) : '');
const amount = (given: unknown, field: string): number | undefined => {
  if (given === undefined || given === null) return undefined;
  if (typeof given !== 'number' || !Number.isFinite(given) || given < 0) throw new Error(`funding.${field} must be a number, 0 or more.`);
  return given;
};
function evidenceOf(given: unknown): AssessEvidence | undefined {
  if (!given || typeof given !== 'object') return undefined;
  const quote = text((given as Record<string, unknown>).quote, 400);
  const source = text((given as Record<string, unknown>).source, 160);
  return quote.length >= 8 && source.length >= 3 ? { quote, source } : undefined;
}

/** The text without its closing full stop, question mark or exclamation mark. A plain loop: no pattern to run slowly on a long input. */
export function withoutClosingStop(given: string): string {
  let end = given.length;
  while (end > 0 && '.!?'.includes(given[end - 1])) end -= 1;
  return given.slice(0, end);
}

/** A number as it is written in a sentence: thousands separated, at most two decimals. */
export function plainNumber(value: number): string {
  const [whole, fraction = ''] = (Math.round(value * 100) / 100).toString().split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''}`;
}
/** Euros as written: whole euros bare, anything else to the cent. */
const euros = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return `€${plainNumber(rounded)}`;
  const [whole, cents] = rounded.toFixed(2).split('.');
  return `€${plainNumber(Number(whole))}.${cents}`;
};
/** A value with its unit: euros take the sign, anything else follows the number. */
export function withUnit(value: number, unit?: string): string {
  if (!unit) return plainNumber(value);
  return /^(€|eur|euro|euros)$/i.test(unit) ? euros(value) : `${plainNumber(value)} ${unit}`;
}

function thresholdFrom(given: unknown, index: number, byEvidence: boolean): AssessFundingThreshold | undefined {
  if (!given || typeof given !== 'object') throw new Error(`funding.thresholds[${index}] must name a measure, a direction and a target.`);
  const item = given as Record<string, unknown>;
  const measure = text(item.measure, 80);
  if (!measure) throw new Error(`funding.thresholds[${index}].measure must say what is measured, for example "Cost per resolved ticket".`);
  if (item.direction !== 'at_most' && item.direction !== 'at_least') throw new Error(`funding.thresholds[${index}].direction must be at_most or at_least.`);
  if (typeof item.target !== 'number' || !Number.isFinite(item.target)) throw new Error(`funding.thresholds[${index}].target must be a number.`);
  const evidence = evidenceOf(item.evidence);
  // An agent keeps an agreed result only where it can quote the agreement.
  if (byEvidence && !evidence) return undefined;
  const unit = text(item.unit, 24);
  const baseline = amount(item.baseline, `thresholds[${index}].baseline`);
  const baselineKind: FundingKind = baseline === undefined ? 'unknown' : item.baseline_kind === 'measured' ? 'measured' : 'estimate';
  return {
    measure, ...(unit ? { unit } : {}), direction: item.direction, target: item.target,
    ...(baseline !== undefined ? { baseline } : {}), baseline_kind: baselineKind,
    ...(evidence ? { evidence } : {}),
    line: '',
  };
}

const sameAgreement = (a: AssessFundingThreshold, b: AssessFundingThreshold): boolean =>
  a.measure.toLowerCase() === b.measure.toLowerCase() && a.direction === b.direction && a.target === b.target && (a.unit ?? '') === (b.unit ?? '');

function thresholdLine(item: AssessFundingThreshold): string {
  const bound = `${item.direction === 'at_most' ? 'at most' : 'at least'} ${withUnit(item.target, item.unit)}`;
  const today = item.baseline === undefined ? 'Today: not known.' : `Today: ${withUnit(item.baseline, item.unit)}, ${KIND_WORD[item.baseline_kind]}.`;
  if (item.result === undefined) return `${item.measure}. ${today} Agreed: ${bound}.`;
  return `${item.measure}. Agreed: ${bound}. Result: ${withUnit(item.result, item.unit)}, ${KIND_WORD[item.result_kind ?? 'estimate']}. ${item.met ? 'Met.' : 'Not met.'}`;
}

/**
 * Builds the funding record from what was passed today and, at a return
 * visit, from the record the earlier brief link carried. Returns nothing when
 * neither holds one.
 */
export function fundingRecord(
  given: AssessFundingInput | undefined, byEvidence: boolean, earlier?: AssessFunding, earlierDate?: string,
): AssessFunding | undefined {
  if (given === undefined && !earlier) return undefined;
  if (given !== undefined && (!given || typeof given !== 'object' || Array.isArray(given))) throw new Error('funding must be an object.');
  const input = (given ?? {}) as AssessFundingInput;

  if (input.stage !== undefined && !FUNDING_STAGES.includes(input.stage)) throw new Error('funding.stage must be pilot or rollout.');
  if (input.decision !== undefined && !FUNDING_DECISIONS.includes(input.decision)) throw new Error(`funding.decision must be one of ${FUNDING_DECISIONS.join(', ')}.`);
  const stage = input.stage ?? earlier?.stage;

  // What is asked for the next stage. An agent keeps the amount only where it can quote it.
  const askEvidence = evidenceOf(input.ask?.evidence);
  const askAmount = amount(input.ask?.amount_eur, 'ask.amount_eur');
  const ask = askAmount !== undefined && (!byEvidence || askEvidence)
    ? { amount_eur: askAmount, ...(askEvidence ? { evidence: askEvidence } : {}) }
    : earlier?.ask;

  const altText = text(input.alternative?.description, 200);
  const altEvidence = evidenceOf(input.alternative?.evidence);
  const altAmount = amount(input.alternative?.amount_eur, 'alternative.amount_eur');
  const alternative = altText && (!byEvidence || altEvidence)
    ? { description: altText, ...(altAmount !== undefined ? { amount_eur: altAmount } : {}), ...(altEvidence ? { evidence: altEvidence } : {}) }
    : earlier?.alternative;

  if (input.thresholds !== undefined && !Array.isArray(input.thresholds)) throw new Error('funding.thresholds must be a list.');
  if ((input.thresholds?.length ?? 0) > FUNDING_THRESHOLDS_MAX) throw new Error(`funding.thresholds takes ${FUNDING_THRESHOLDS_MAX} at most.`);
  const today = (input.thresholds ?? []).map((item, index) => thresholdFrom(item, index, byEvidence)).filter((item): item is AssessFundingThreshold => item !== undefined);
  // The agreement made before the work is the one the results are checked against.
  // Results agreed today never replace it without that being said.
  const agreed = earlier?.thresholds.length ? earlier.thresholds.map((item) => ({ ...item })) : today;
  const agreementChanged = Boolean(earlier?.thresholds.length) && today.length > 0
    && (today.length !== agreed.length || today.some((item) => !agreed.some((kept) => sameAgreement(kept, item))));

  if (input.results !== undefined && !Array.isArray(input.results)) throw new Error('funding.results must be a list.');
  const unmatched: string[] = [];
  for (const [index, raw] of (input.results ?? []).entries()) {
    if (!raw || typeof raw !== 'object') throw new Error(`funding.results[${index}] must name a measure and a value.`);
    const measure = text(raw.measure, 80);
    if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) throw new Error(`funding.results[${index}].value must be a number.`);
    const evidence = evidenceOf(raw.evidence);
    // An agent reports a result only where it can quote it.
    if (byEvidence && !evidence) continue;
    const target = agreed.find((item) => item.measure.toLowerCase() === measure.toLowerCase());
    if (!target) { unmatched.push(measure); continue; }
    target.result = raw.value;
    target.result_kind = raw.kind === 'measured' ? 'measured' : 'estimate';
    if (evidence) target.result_evidence = evidence; else delete target.result_evidence;
    target.met = target.direction === 'at_most' ? raw.value <= target.target : raw.value >= target.target;
  }
  const thresholds = agreed.map((item) => ({ ...item, line: thresholdLine(item) }));
  const reviewed = thresholds.filter((item) => item.result !== undefined);

  // What the person who holds the budget still does not know, most important first.
  const gaps: string[] = [];
  if (!stage) gaps.push('The stage is not known: a pilot or a rollout.');
  if (!ask) gaps.push('The amount asked for the next stage is not known.');
  if (!alternative) gaps.push('No alternative is named, such as fixing the process as it is.');
  if (!thresholds.length) gaps.push('No result is agreed that would release more money.');
  for (const item of thresholds) {
    if (item.baseline === undefined) gaps.push(`${item.measure}: today's figure is not known.`);
    else if (item.baseline_kind === 'estimate') gaps.push(`${item.measure}: today's figure is an estimate. Nobody has measured it.`);
  }
  if (reviewed.length) {
    for (const item of thresholds) {
      if (item.result === undefined) gaps.push(`${item.measure}: there is no result yet.`);
      else if (item.result_kind === 'estimate') gaps.push(`${item.measure}: the result is an estimate. Nobody has measured it.`);
    }
  }
  for (const measure of unmatched) gaps.push(`${measure}: a result was given, and no such result was agreed.`);

  const sentences: string[] = [];
  if (stage || ask) {
    sentences.push(`${stage ? `The next stage is a ${stage}.` : 'The next stage is not named.'} ${ask ? `The ask is ${euros(ask.amount_eur)}.` : 'The amount asked is not known.'}`);
  }
  if (alternative) sentences.push(`The alternative: ${withoutClosingStop(alternative.description)}${alternative.amount_eur !== undefined ? `, at ${euros(alternative.amount_eur)}` : ''}.`);
  let review: AssessFunding['review'];
  if (reviewed.length) {
    const met = reviewed.filter((item) => item.met).length;
    const missed = reviewed.filter((item) => !item.met);
    const dated = earlierDate && /^\d{4}-\d{2}-\d{2}$/.test(earlierDate)
      ? ` on ${Number(earlierDate.slice(8, 10))} ${MONTHS[Number(earlierDate.slice(5, 7)) - 1]} ${earlierDate.slice(0, 4)}` : '';
    const counted = `${COUNT[thresholds.length]} result${thresholds.length === 1 ? ' was' : 's were'} agreed${dated}.`;
    const tally = reviewed.length < thresholds.length
      ? `${COUNT[reviewed.length]} ${reviewed.length === 1 ? 'has' : 'have'} a result so far, and ${met === reviewed.length ? (met === 1 ? 'it is met' : 'each is met') : `${COUNT[met].toLowerCase()} ${met === 1 ? 'is' : 'are'} met`}.`
      : met === thresholds.length ? (met === 1 ? 'It is met.' : 'Each one is met.')
      : met === 0 ? (thresholds.length === 1 ? 'It is not met.' : 'None is met.')
      : `${COUNT[met]} ${met === 1 ? 'is' : 'are'} met and ${COUNT[missed.length].toLowerCase()} ${missed.length === 1 ? 'is' : 'are'} not.`;
    const which = missed.length ? ` Not met: ${missed.map((item) => `${item.measure}, ${item.direction === 'at_most' ? 'at most' : 'at least'} ${withUnit(item.target, item.unit)} agreed, ${withUnit(item.result!, item.unit)} ${item.result_kind === 'measured' ? 'measured' : 'estimated'}`).join('; ')}.` : '';
    const statement = `${counted} ${tally}${which}`;
    review = { met, of: thresholds.length, statement };
    sentences.push(statement);
  } else if (thresholds.length) {
    sentences.push(`${COUNT[thresholds.length]} result${thresholds.length === 1 ? ' is' : 's are'} agreed for the review.`);
  }
  if (agreementChanged) sentences.push('The results passed today differ from those agreed earlier. The check uses the earlier ones.');
  if (gaps.length) sentences.push(`${gaps.length === 1 ? 'One point is' : `${COUNT[gaps.length] ?? gaps.length} points are`} still open.`);

  return {
    ...(stage ? { stage } : {}),
    ...(ask ? { ask } : {}),
    ...(alternative ? { alternative } : {}),
    thresholds,
    gaps,
    ...(review ? { review } : {}),
    ...(agreementChanged ? { agreement_changed: true } : {}),
    ...(input.decision ? { decision: input.decision } : {}),
    statement: sentences.join(' '),
    note: FUNDING_NOTE,
  };
}
