// Metre classification (D7 helper). Pure, RN-free — lives outside
// `generators/` because the validator (U6's metreClassificationHook) must
// import it, and validator.ts must not import from generators/ (import
// cycle via retry.ts → validate).

export type Division = 'simple' | 'compound';
export type Beats = 'duple' | 'triple' | 'quadruple';

export interface MetreClass {
  division: Division;
  beats: Beats;
}

const METRE_TABLE: Record<string, MetreClass> = {
  '2/4': { division: 'simple', beats: 'duple' },
  '3/4': { division: 'simple', beats: 'triple' },
  '4/4': { division: 'simple', beats: 'quadruple' },
  '6/8': { division: 'compound', beats: 'duple' },
  '9/8': { division: 'compound', beats: 'triple' },
  '12/8': { division: 'compound', beats: 'quadruple' },
};

/** Classifies a time signature as simple/compound × duple/triple/quadruple.
 *  Total over the six renderable signatures; throws on anything else (fail
 *  loud, no silent default class — `formEntryFor` precedent,
 *  scale-construction.ts:150-156). */
export function classifyMetre(sig: string): MetreClass {
  const entry = METRE_TABLE[sig];
  if (!entry) {
    throw new Error(`classifyMetre: no classification for time signature "${sig}"`);
  }
  return entry;
}

/** True for x/8 signatures whose numerator is a multiple of 3 — the same
 *  rule the emitter's `beatUnit` uses to beam in dotted-crotchet groups
 *  (abc-emitter.ts:178-182). Used by the D13 simple-only guards and U6's
 *  distractor/hook logic. */
export function isCompoundTimeSignature(sig: string): boolean {
  const [num, den] = sig.split('/').map(Number);
  return den === 8 && num % 3 === 0;
}
