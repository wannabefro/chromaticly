// Grade 1 scope accessor (commandment 1, exercise-construction-spec.md §5:
// "scope is law" — every pitch/value/key/signature/term/clef a generator
// touches must come from here).

import type { Clef, Duration, Pitch } from '../music/types';

export const G1_CLEFS: readonly Clef[] = ['treble', 'bass'];

export const G1_NOTE_VALUES: readonly Duration[] = [
  'semibreve',
  'minim',
  'crotchet',
  'quaver',
  'semiquaver',
];

export const G1_KEYS_MAJOR: readonly string[] = ['C', 'G', 'D', 'F'];

export const G1_TIME_SIGNATURES: readonly string[] = ['2/4', '3/4', '4/4'];

export const G1_INTERVAL_RULE = {
  aboveTonicOnly: true,
  namingStyle: 'number',
  maxOctaves: 1,
} as const;

// knowledge-base.json's grade_scopes["1"].pitch_range is prose, not concrete
// bounds ("G5 (top of stave... A5 space above)" for treble; "D4 (ledger
// context above middle C)" for bass). These concrete numeric bounds are the
// judgment call that resolves that prose:
//   - treble: C4 (1 ledger line below stave) .. A5. The JSON names G5 as
//     "top of stave" but explicitly calls out A5 as the space immediately
//     above it, and G1's ledger-line allowance is "middle C only" — A5 sits
//     on the stave/just above it, not on a new ledger line, so it's within
//     scope and used here as the effective usable high bound.
//   - bass: E2 (bottom line, "lower not required") .. D4 (explicitly named
//     ledger-line-above-middle-C bound).
const PITCH_RANGES: Record<Clef, { low: Pitch; high: Pitch }> = {
  treble: { low: 'C4', high: 'A5' },
  bass: { low: 'E2', high: 'D4' },
};

export function pitchRange(clef: Clef): { low: Pitch; high: Pitch } {
  return PITCH_RANGES[clef];
}

const NATURAL_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

function pitchOrdinal(letter: string, octave: number): number {
  return octave * 7 + NATURAL_LETTERS.indexOf(letter as (typeof NATURAL_LETTERS)[number]);
}

function parsePitch(pitch: Pitch): { letter: string; octave: number } {
  const match = /^([A-G])(\d)$/.exec(pitch);
  if (!match) throw new Error(`not a natural scientific pitch: ${pitch}`);
  return { letter: match[1], octave: Number(match[2]) };
}

/**
 * Diatonic (natural-letter, white-key) pitches within the G1 range for a
 * clef, e.g. ["C4","D4","E4",...]. G1 keys (C/G/D/F) need at most one
 * sharp/flat, applied via key signature rather than per-pitch accidentals,
 * so a natural-only enumerator is sufficient for this grade.
 */
export function diatonicPitchesInRange(clef: Clef): Pitch[] {
  const { low, high } = pitchRange(clef);
  const lowP = parsePitch(low);
  const highP = parsePitch(high);
  const lowOrd = pitchOrdinal(lowP.letter, lowP.octave);
  const highOrd = pitchOrdinal(highP.letter, highP.octave);

  const result: Pitch[] = [];
  for (let octave = lowP.octave; octave <= highP.octave; octave++) {
    for (const letter of NATURAL_LETTERS) {
      const ord = pitchOrdinal(letter, octave);
      if (ord >= lowOrd && ord <= highOrd) {
        result.push(`${letter}${octave}`);
      }
    }
  }
  return result;
}
