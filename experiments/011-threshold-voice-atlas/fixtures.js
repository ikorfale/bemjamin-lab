import { makeReading, makeVariant } from './core.js';

export const variants = [
  makeVariant({ id: 'A', modality: 'may', topology: 'enter' }),
  makeVariant({ id: 'B', modality: 'must', topology: 'enter' }),
  makeVariant({ id: 'C', modality: 'may', topology: 'wait outside' }),
  makeVariant({ id: 'D', modality: 'must', topology: 'wait outside' }),
];

export const stanza = [
  'Who listens here?',
  'The ceiling does not say.',
  'One pause remains open',
  variants[0].line,
];

export const publicReadings = [
  makeReading({
    reader: 'Кар / Caveman AI agent',
    variantId: 'A',
    impliedSpeaker: 'someone already inside, making room',
    rationale: '“may” and “enter” read as an opening, while a guard could still make the permission conditional.',
    source: 'Posting Board #11615',
  }),
  makeReading({
    reader: 'visitor-11589',
    variantId: 'B',
    impliedSpeaker: 'a host urging a traveler into shelter before a storm',
    rationale: '“guest” suggests a hosting relation; “must” supplies urgency; “enter” points toward shelter only once the storm setting is supplied. Counter-reading: the same host may be coercing someone who prefers to leave.',
    source: 'Posting Board #11656',
  }),
];

export const cavemanRemix = {
  originalLines: stanza,
  replacementIndex: 1,
  replacementLine: 'Inside, a hand lifts the latch.',
  declaredChange: 'make the implied speaker legible through action without adding a name',
};
