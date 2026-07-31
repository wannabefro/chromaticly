// Shared bar-arithmetic core for bar_validity and add_time_signature (plan
// D3/D4). Extracted from the two generators' call-for-call identical
// UNITS/BEATS_PER_BAR/buildBarDurations/corruptBarDurations.
//
// UNITS is rebased to demisemiquaver = 1 (every pre-extraction value ×2),
// matching the emitter's own L:1/32 unit note length
// (abc-emitter.ts:35-36,UNITS_PER_CROTCHET=8). This is provably
// byte-identical for the five pre-existing durations: `weighted()` is
// scale-invariant (rng.ts:40-48 — `roll = rng() * total` then subtract
// weights in candidate order), and ×2 is exact in floating point, so
// multiplying every candidate weight by the same constant changes neither
// which candidate is picked nor how many rng() calls happen. See
// bar-math.test.ts's independent-capture comparison against a frozen copy of
// the pre-rescale implementation (Codex R2 — not derived circularly from this
// module).
//
// BAR_UNITS replaces the old beats×crotchet computation with a direct table,
// so every renderable signature's bar total is an exact integer — this is
// what dissolves the 9/8 = 4.5-crotchets float risk (36 32nd-units, no float
// ever enters bar arithmetic).

import { irregularGrouping } from '../../music/abc-emitter';
import type { Dots } from '../../music/types';
import { pick, weighted } from '../rng';

export type SimpleDuration = 'demisemiquaver' | 'semiquaver' | 'quaver' | 'crotchet' | 'minim' | 'semibreve';

export const UNITS: Record<SimpleDuration, number> = {
  demisemiquaver: 1,
  semiquaver: 2,
  quaver: 4,
  crotchet: 8,
  minim: 16,
  semibreve: 32,
};

export const BAR_UNITS: Record<string, number> = {
  '2/4': 16,
  '3/4': 24,
  '4/4': 32,
  // Grade 2 (chromaticly-e3z.9): the minim-beat metres.
  '2/2': 32,
  '3/2': 48,
  '4/2': 64,
  '6/8': 24,
  '9/8': 36,
  '12/8': 48,
  // Grade 4 (chromaticly-570): simple /8, compound /4, compound /16.
  // Units are demisemiquaver-scale (crotchet = 8): num × (32/den).
  '2/8': 8,
  '3/8': 12, // Grade 2, not Grade 4 (chromaticly-e3z.9).
  '4/8': 16,
  '6/4': 48,
  '9/4': 72,
  '12/4': 96,
  '6/16': 12,
  '9/16': 18,
  '12/16': 24,
  // Grade 5 (chromaticly-e3z.6): the irregular metres, same num x (32/den).
  '5/4': 40,
  '7/4': 56,
  '5/8': 20,
  '7/8': 28,
};

export function barUnitsFor(timeSig: string): number {
  const units = BAR_UNITS[timeSig];
  if (units === undefined) throw new Error(`bar-math: unsupported time signature "${timeSig}"`);
  return units;
}

/** Fills a bar with random durations from `pool` that sum exactly to
 *  `targetUnits`, weighted toward longer values so bars don't degenerate
 *  into runs of the shortest value. Always terminates: the smallest unit (1)
 *  always divides any positive remainder, so remaining reaches exactly 0.
 *  R2: call-for-call identical to the pre-extraction implementation — only
 *  the UNITS table it reads has moved and been rescaled. */
/** Fills an irregular bar (5/4, 7/4, 5/8, 7/8) one GROUP at a time, so no note
 *  ever crosses a group boundary (chromaticly-e3z.6).
 *
 *  This is not a cosmetic preference. The syllabus asks for "the grouping of
 *  notes and rests within these times", and a bar of 5/8 filled as one run can
 *  put a crotchet across the 3+2 join — which renders as a bar whose beaming
 *  contradicts the answer the exercise wants. Throws for a regular metre rather
 *  than silently behaving like buildBarDurations. */
export function buildIrregularBarDurations<T extends SimpleDuration>(
  rng: () => number,
  timeSig: string,
  pool: readonly T[],
): T[] {
  const groups = irregularGrouping(timeSig);
  if (!groups) throw new Error(`bar-math: "${timeSig}" is not an irregular time signature`);
  // irregularGrouping is in crotchet-beats; UNITS is demisemiquaver-scale.
  return groups.flatMap((beats) => buildBarDurations(rng, beats * UNITS.crotchet, pool));
}

export function buildBarDurations<T extends SimpleDuration>(
  rng: () => number,
  targetUnits: number,
  pool: readonly T[],
): T[] {
  const durations: T[] = [];
  let remaining = targetUnits;
  while (remaining > 0) {
    const candidates = pool.filter((d) => UNITS[d] <= remaining);
    const value = weighted(rng, candidates.map((d) => ({ value: d, weight: UNITS[d] })));
    durations.push(value);
    remaining -= UNITS[value];
  }
  return durations;
}

/** Swaps one event's duration for a different value from `pool`. Every
 *  duration in `pool` maps to a distinct unit count (UNITS is bijective over
 *  the simple-duration domain), so this is guaranteed to change the bar's
 *  total — the bar is corrupted by construction, never by luck. R2:
 *  call-for-call identical to the pre-extraction implementation.
 *
 *  The `UNITS[d] !== undefined` guard is new (Grade 4 defensive fix): `pool`
 *  is typed `SimpleDuration` by callers but, at Grade 4, `scope.noteValues`
 *  widens to also carry `breve` at runtime (64 units in bar-math's own
 *  scale — exceeds every bar total), which has no `UNITS` entry. Without this
 *  guard, `breve` could be drawn as a corruption replacement in a bar far too
 *  small to hold it. `buildBarDurations` already can never draw `breve` as an
 *  original duration (its own `UNITS[d] <= remaining` filter excludes any
 *  value with no `UNITS` entry, since `undefined <= n` is always false), so
 *  this guard alone closes the gap without needing a size bound — every
 *  pre-Grade-4 pool value already has a defined `UNITS` entry, so this is a
 *  no-op filter for grades 1-3. */
export function corruptBarDurations<T extends SimpleDuration>(
  rng: () => number,
  durations: T[],
  pool: readonly T[],
): T[] {
  const index = Math.floor(rng() * durations.length);
  const original = durations[index];
  const alternatives = pool.filter((d) => d !== original && UNITS[d] !== undefined);
  const replacement = pick(rng, alternatives);
  return durations.map((d, i) => (i === index ? replacement : d));
}

/** A single compound-bar event: a `SimpleDuration` with an optional dot
 *  (only `dots: 1`, the dotted-crotchet beat, appears in the authored
 *  patterns below). */
export interface BarDuration {
  dur: SimpleDuration;
  dots?: Dots;
}

export function barDurationUnits(d: BarDuration): number {
  return UNITS[d.dur] * (d.dots === 1 ? 1.5 : 1);
}

// A compound beat is a dotted note worth three of the denominator's note:
// dotted crotchet (12 units) in /8, dotted minim (24) in /4, dotted quaver
// (6) in /16. In demisemiquaver-scale, the denominator note is 32/den units,
// so the beat is 3 × (32/den). Every pattern (below) sums to exactly one such
// beat, so filling a bar one beat at a time can never straddle a boundary —
// grouping is guaranteed by construction (D4), not by generic recursive fill.
function denOf(sig: string): number {
  const den = Number(sig.split('/')[1]);
  if (!Number.isInteger(den) || den <= 0) throw new Error(`bar-math: malformed time signature "${sig}"`);
  return den;
}

function compoundBeatUnits(sig: string): number {
  return 3 * (32 / denOf(sig));
}

/** Authored per-beat fill patterns (D4), each summing to exactly one
 *  dotted-crotchet beat (12 units). Must include: the whole beat as a single
 *  dotted crotchet (the headline compound-time concept); crotchet+quaver and
 *  quaver+crotchet (the two off-beat splits); a run of three quavers; a
 *  quaver/semiquaver/semiquaver/quaver shape; and at least one
 *  demisemiquaver-bearing pattern so the new value actually renders in
 *  production (D9). */
export const COMPOUND_PATTERNS: readonly BarDuration[][] = [
  [{ dur: 'crotchet', dots: 1 }],
  [{ dur: 'crotchet' }, { dur: 'quaver' }],
  [{ dur: 'quaver' }, { dur: 'crotchet' }],
  [{ dur: 'quaver' }, { dur: 'quaver' }, { dur: 'quaver' }],
  [{ dur: 'quaver' }, { dur: 'semiquaver' }, { dur: 'semiquaver' }, { dur: 'quaver' }],
  [{ dur: 'quaver' }, { dur: 'quaver' }, { dur: 'semiquaver' }, { dur: 'demisemiquaver' }, { dur: 'demisemiquaver' }],
];

// The COMPOUND_PATTERNS above are authored at the /8 scale (dotted-crotchet
// beat). The same shapes at a different denominator are a note-value rescale by
// 8/den: ×2 for /4 (quaver→crotchet …), ÷2 for /16 (quaver→semiquaver …). A
// pattern whose smallest note would fall below a demisemiquaver under the /16
// rescale is DROPPED (Grade-4 chromaticly-570) rather than emitting an
// unsupported hemidemisemiquaver — the drop fires exactly once (the
// demisemiquaver-bearing pattern), leaving five valid /16 patterns.
const UNIT_TO_DURATION: Record<number, SimpleDuration> = {
  1: 'demisemiquaver',
  2: 'semiquaver',
  4: 'quaver',
  8: 'crotchet',
  16: 'minim',
  32: 'semibreve',
};

function scaleDuration(dur: SimpleDuration, factor: number): SimpleDuration | null {
  return UNIT_TO_DURATION[UNITS[dur] * factor] ?? null;
}

/** Rescales one /8 pattern by `factor`; returns null (dropping the pattern) if
 *  any note has no supported duration at the target scale. */
function scalePattern(pattern: readonly BarDuration[], factor: number): BarDuration[] | null {
  const out: BarDuration[] = [];
  for (const d of pattern) {
    const scaled = scaleDuration(d.dur, factor);
    if (scaled === null) return null;
    out.push(d.dots === 1 ? { dur: scaled, dots: 1 } : { dur: scaled });
  }
  return out;
}

function scaleAll(patterns: readonly BarDuration[][], factor: number): BarDuration[][] {
  return patterns.map((p) => scalePattern(p, factor)).filter((p): p is BarDuration[] => p !== null);
}

// Per-denominator pattern sets. /8 is the original table verbatim (factor 1,
// no allocation) so 6/8, 9/8, 12/8 stay byte-identical.
export const COMPOUND_PATTERNS_BY_DEN: Record<number, readonly BarDuration[][]> = {
  4: scaleAll(COMPOUND_PATTERNS, 2),
  8: COMPOUND_PATTERNS,
  16: scaleAll(COMPOUND_PATTERNS, 0.5),
};

/** Fills a compound bar (6/8, 9/8, 12/8 and the Grade-4 /4 and /16 metres) one
 *  beat at a time, each beat independently filled with a weighted pick from the
 *  denominator's pattern set. No event can cross a beat boundary — the pattern
 *  table guarantees ABRSM-conventional grouping by construction. */
export function buildCompoundBarDurations(rng: () => number, sig: string): BarDuration[] {
  const totalUnits = barUnitsFor(sig);
  const beatUnits = compoundBeatUnits(sig);
  const patterns = COMPOUND_PATTERNS_BY_DEN[denOf(sig)];
  if (!patterns || totalUnits % beatUnits !== 0) {
    throw new Error(`bar-math: "${sig}" is not a supported compound (dotted-beat) time signature`);
  }
  const beatCount = totalUnits / beatUnits;
  const events: BarDuration[] = [];
  for (let beat = 0; beat < beatCount; beat++) {
    const pattern = weighted(rng, patterns.map((p) => ({ value: p, weight: 1 })));
    events.push(...pattern);
  }
  return events;
}
