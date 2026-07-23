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
  '6/8': 24,
  '9/8': 36,
  '12/8': 48,
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

// A dotted-crotchet beat (compound time's beat unit) = 12 32nd-units
// (crotchet=8, dot adds half=4). Every pattern below sums to exactly 12, so
// filling a bar one beat at a time can never straddle a beat boundary —
// grouping is guaranteed by construction (D4), not by generic recursive fill.
const COMPOUND_BEAT_UNITS = 12;

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

/** Fills a compound bar (6/8, 9/8, 12/8) one dotted-crotchet beat at a time,
 *  each beat independently filled with a weighted pick from
 *  `COMPOUND_PATTERNS`. No event can cross a beat boundary — the pattern
 *  table guarantees ABRSM-conventional grouping by construction. */
export function buildCompoundBarDurations(rng: () => number, sig: string): BarDuration[] {
  const totalUnits = barUnitsFor(sig);
  if (totalUnits % COMPOUND_BEAT_UNITS !== 0) {
    throw new Error(`bar-math: "${sig}" is not a compound (dotted-crotchet-beat) time signature`);
  }
  const beatCount = totalUnits / COMPOUND_BEAT_UNITS;
  const events: BarDuration[] = [];
  for (let beat = 0; beat < beatCount; beat++) {
    const pattern = weighted(rng, COMPOUND_PATTERNS.map((p) => ({ value: p, weight: 1 })));
    events.push(...pattern);
  }
  return events;
}
