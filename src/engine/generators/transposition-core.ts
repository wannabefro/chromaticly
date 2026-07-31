// Shared, RNG-free machinery for the clef-rewrite generators
// (octave_transposition, clef_equivalence). Only the deterministic constants
// and pure range math live here — each generator keeps its OWN draw
// orchestration, so extracting this module can never perturb an existing
// generator's RNG sequence (octave_transposition stays byte-identical). What is
// shared is the "clef helper" surface (KTD5): clef ranking, the two-endpoint
// comfortable-range clamp, and the full-bar rhythm pattern tables.

import type { Clef, Dots, Duration } from '../../music/types';
import { comfortablePitchRange } from '../scope';
import { scientificPitchOrdinal } from './pitch-math';

export type TimeSig = '3/4' | '4/4';

export interface BarNote {
  dur: Duration;
  dots?: Dots;
}

export interface SourceNote {
  natural: string; // natural-letter scientific pitch, e.g. "F3" — spelled in key at emission
  dur: Duration;
  dots?: Dots;
}

// CLEF_RANK orders clefs by pitch height (bass lowest, treble highest; tenor
// between bass and alto) so the
// octave direction of a transposition is a lookup, not a ternary. The validator
// keeps an INDEPENDENT copy (recompute-don't-trust); this one is the generators'.
export const CLEF_RANK: Record<Clef, number> = { treble: 3, alto: 2, tenor: 1, bass: 0 };

export const TIME_SIGS: readonly TimeSig[] = ['3/4', '4/4'];

// Full-bar patterns, unbeamed durations only — each entry sums exactly to its
// time signature's bar total, so "bars are metrically full" holds by
// construction (the validator hooks re-check it independently).
export const PATTERNS: Record<TimeSig, readonly BarNote[][]> = {
  '3/4': [
    [{ dur: 'minim', dots: 1 }],
    [{ dur: 'minim' }, { dur: 'crotchet' }],
    [{ dur: 'crotchet' }, { dur: 'minim' }],
    [{ dur: 'crotchet' }, { dur: 'crotchet' }, { dur: 'crotchet' }],
  ],
  '4/4': [
    [{ dur: 'semibreve' }],
    [{ dur: 'minim' }, { dur: 'minim' }],
    [{ dur: 'minim' }, { dur: 'crotchet' }, { dur: 'crotchet' }],
    [{ dur: 'crotchet' }, { dur: 'crotchet' }, { dur: 'minim' }],
    [{ dur: 'minim', dots: 1 }, { dur: 'crotchet' }],
    [{ dur: 'crotchet' }, { dur: 'minim', dots: 1 }],
  ],
};

/** The natural-pitch ordinal band a source note may occupy: within the given
 *  clef's comfortable range AND whose target (shifted by `delta` natural steps)
 *  also fits the answer clef's comfortable range. delta = ±7 for an octave
 *  rewrite, 0 for a same-octave cross-clef rewrite (the intersection of both
 *  clefs' comfortable ranges — the pitches legible on both staves). */
export function sourceOrdinalRange(
  givenClef: Clef,
  answerClef: Clef,
  delta: number,
  grade: number,
): { low: number; high: number } {
  const given = comfortablePitchRange(givenClef, grade);
  const answer = comfortablePitchRange(answerClef, grade);
  const givenLow = scientificPitchOrdinal(given.low);
  const givenHigh = scientificPitchOrdinal(given.high);
  const answerLow = scientificPitchOrdinal(answer.low) - delta;
  const answerHigh = scientificPitchOrdinal(answer.high) - delta;
  return { low: Math.max(givenLow, answerLow), high: Math.min(givenHigh, answerHigh) };
}
