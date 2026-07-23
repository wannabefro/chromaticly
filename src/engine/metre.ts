// Metre classification (D7 helper; generalized to all Grade-4 metres in the
// time-signatures slice, chromaticly-570). Pure, RN-free — lives outside
// `generators/` because the validator (U6's metreClassificationHook) must
// import it, and validator.ts must not import from generators/ (import
// cycle via retry.ts → validate).

export type Division = 'simple' | 'compound';
export type Beats = 'duple' | 'triple' | 'quadruple';

export interface MetreClass {
  division: Division;
  beats: Beats;
}

const BEAT_NAMES: Record<number, Beats> = { 2: 'duple', 3: 'triple', 4: 'quadruple' };

/** Parses "<num>/<den>" strictly: exactly two finite positive integers.
 *  Rejects bare "4", "4/", "/4", "NaN/8", "" — a malformed signature must
 *  fail loud, never silently mis-classify via NaN. */
function parseSignature(sig: string): { num: number; den: number } {
  const parts = sig.split('/');
  if (parts.length !== 2) {
    throw new Error(`metre: malformed time signature "${sig}"`);
  }
  const num = Number(parts[0]);
  const den = Number(parts[1]);
  if (!Number.isInteger(num) || !Number.isInteger(den) || num <= 0 || den <= 0) {
    throw new Error(`metre: malformed time signature "${sig}"`);
  }
  return { num, den };
}

/** True for a compound signature — one whose beat is a dotted note, i.e. the
 *  numerator is a multiple of three greater than three (6, 9, 12), regardless
 *  of denominator (6/4, 6/8, 6/16 are all compound duple). 3/8 is NOT compound:
 *  three quaver beats is simple triple. This is the same rule the emitter's
 *  `beatUnit` uses (abc-emitter.ts). */
export function isCompoundTimeSignature(sig: string): boolean {
  const { num } = parseSignature(sig);
  return num % 3 === 0 && num > 3;
}

/** Classifies a time signature as simple/compound × duple/triple/quadruple by
 *  its NUMERATOR — compound (dotted-note beat) when num ∈ {6,9,12} with
 *  beats = num/3; simple otherwise with beats = num. The denominator never
 *  affects the class. Throws on a malformed signature or one whose beat count
 *  falls outside {2,3,4} (fail loud, no silent default class —
 *  scale-construction.ts:150-156 precedent). Byte-identical to the former
 *  six-entry table for 2/4, 3/4, 4/4, 6/8, 9/8, 12/8. */
export function classifyMetre(sig: string): MetreClass {
  const { num } = parseSignature(sig);
  const compound = num % 3 === 0 && num > 3;
  const beats = BEAT_NAMES[compound ? num / 3 : num];
  if (!beats) {
    throw new Error(`classifyMetre: no classification for time signature "${sig}"`);
  }
  return { division: compound ? 'compound' : 'simple', beats };
}
