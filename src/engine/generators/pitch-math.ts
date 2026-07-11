// Shared diatonic (letter-name) pitch arithmetic for generators that need to
// walk the staff by line/space steps: note-naming's clef-confusion distractor
// (same staff position, other clef) and interval-naming's "N diatonic steps
// above the tonic". Natural (unaccidented) pitches only — G1 keys apply their
// accidental via key signature, not per-pitch, so callers that need an
// accidented pitch (note-naming) apply the symbol themselves after this math.

import type { Pitch } from '../../music/types';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];

export interface ParsedNaturalPitch {
  letter: Letter;
  octave: number;
}

export function parseNaturalPitch(pitch: Pitch): ParsedNaturalPitch {
  const match = /^([A-G])(-?\d+)$/.exec(pitch);
  if (!match) throw new Error(`not a natural scientific pitch: ${pitch}`);
  const [, letter, octaveStr] = match;
  return { letter: letter as Letter, octave: Number(octaveStr) };
}

/** Diatonic ordinal: increases by 1 per letter-name step (line or space), C0 = 0. */
export function pitchOrdinal(letter: Letter, octave: number): number {
  return octave * 7 + LETTERS.indexOf(letter);
}

export function scientificPitchOrdinal(pitch: Pitch): number {
  const { letter, octave } = parseNaturalPitch(pitch);
  return pitchOrdinal(letter, octave);
}

export function naturalPitchAtOrdinal(ordinal: number): Pitch {
  const octave = Math.floor(ordinal / 7);
  const letter = LETTERS[((ordinal % 7) + 7) % 7];
  return `${letter}${octave}`;
}

/** N diatonic (letter-name) steps above a natural pitch, e.g. steps=4 is a 5th above. */
export function naturalPitchStepsAbove(pitch: Pitch, steps: number): Pitch {
  return naturalPitchAtOrdinal(scientificPitchOrdinal(pitch) + steps);
}
