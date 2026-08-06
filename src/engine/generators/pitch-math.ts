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

// Accidental-aware arithmetic, used by the two by-ear generators. It is separate
// from the natural-only helpers above because a by-ear mutation must compare what
// SOUNDS, so an enharmonic "step" that changes nothing is caught before it ships.

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export interface ParsedPitch {
  letter: string;
  accidental: string;
  octave: number;
}

export function parsePitch(pitch: Pitch): ParsedPitch | null {
  const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/.exec(pitch);
  if (!m) return null;
  return { letter: m[1], accidental: m[2] ?? '', octave: Number(m[3]) };
}

/** Absolute semitone height, so an enharmonic step that sounds identical is caught. */
export function semitoneOf(pitch: Pitch): number | null {
  const p = parsePitch(pitch);
  if (!p) return null;
  const shift = p.accidental.startsWith('#') ? p.accidental.length : -p.accidental.length;
  return (p.octave + 1) * 12 + SEMITONES[p.letter] + shift;
}

/** The next letter name up or down, carrying the octave across the B/C boundary. */
export function stepPitch(pitch: Pitch, up: boolean): Pitch | null {
  const p = parsePitch(pitch);
  if (!p) return null;
  const i = LETTERS.indexOf(p.letter as Letter);
  const next = (i + (up ? 1 : 6)) % 7;
  const octave = up && next === 0 ? p.octave + 1 : !up && i === 0 ? p.octave - 1 : p.octave;
  return `${LETTERS[next]}${octave}`;
}
