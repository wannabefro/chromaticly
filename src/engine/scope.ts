// Per-grade scope accessor (commandment 1, exercise-construction-spec.md §5:
// "scope is law, per grade" — every pitch/value/key/signature/term/clef a
// generator touches must come from here, via an explicit grade).

import { KB } from '../content/knowledge-base';
import type { Clef, Duration, Pitch } from '../music/types';

export interface GradeScope {
  clefs: readonly Clef[];
  noteValues: readonly Duration[];
  keysMajor: readonly string[];
  keysMinor: readonly string[];
  minorForms: readonly string[];
  timeSignatures: readonly string[];
  rhythmDevices: readonly string[];
  intervalRule: {
    aboveTonicOnly: boolean;
    namingStyle: string;
    maxOctaves: number;
  };
  pitchRanges: Record<Clef, { low: Pitch; high: Pitch }>;
}

const GRADE_1_SCOPE: GradeScope = {
  clefs: ['treble', 'bass'],
  noteValues: ['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver'],
  keysMajor: ['C', 'G', 'D', 'F'],
  keysMinor: [],
  minorForms: [],
  timeSignatures: ['2/4', '3/4', '4/4'],
  rhythmDevices: ['tie', 'single_dot'],
  intervalRule: {
    aboveTonicOnly: true,
    namingStyle: 'number',
    maxOctaves: 1,
  },
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
  pitchRanges: {
    treble: { low: 'C4', high: 'A5' },
    bass: { low: 'E2', high: 'D4' },
  },
};

const GRADE_2_SCOPE: GradeScope = {
  clefs: ['treble', 'bass'],
  noteValues: ['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver'],
  keysMajor: [...GRADE_1_SCOPE.keysMajor, 'A', 'Bb', 'Eb'],
  keysMinor: ['A', 'E', 'D'],
  minorForms: ['harmonic'],
  timeSignatures: ['2/4', '3/4', '4/4', '2/2', '3/2', '4/2'],
  rhythmDevices: [...GRADE_1_SCOPE.rhythmDevices, 'triplet', 'triplet_with_rests', 'dotted_rests'],
  intervalRule: {
    aboveTonicOnly: true,
    namingStyle: 'number',
    maxOctaves: 1,
  },
  // KB's grade_scopes["2"].adds.pitch_range only says "ledger_lines: up to 2
  // above and below each stave" (prose). Resolved conservatively at the
  // outermost ledger-line NOTE (not the space beyond it — see D3 in the plan
  // for the rejected wider alternative):
  //   - treble: A3 (2nd ledger below; C4 is the 1st) .. C6 (2nd ledger above;
  //     A5 is the 1st).
  //   - bass: C2 (2nd ledger below; E2 is the 1st) .. E4 (2nd ledger above;
  //     C4/middle-C is the 1st).
  // Flagged for curriculum sign-off before the first G2 pitch-content slice
  // ships; a one-line table edit if that review disagrees, and cannot affect
  // Grade 1.
  pitchRanges: {
    treble: { low: 'A3', high: 'C6' },
    bass: { low: 'C2', high: 'E4' },
  },
};

// Grade 3 (D1): keys widen to KB.grade3Adds' minors/majors and harmonic +
// melodic minor forms. timeSignatures widens to the compound trio
// (6/8, 9/8, 12/8 — D2, compound-time slice U2). noteValues now widens to
// demisemiquaver (U4, plan R1): bar-math.ts's UNITS table carries a
// demisemiquaver row as of this unit, so no simple consumer can draw a
// duration with no unit entry. rhythmDevices widens to include 'anacrusis'
// (anacrusis slice D6) — the device is now implemented, so scope no longer
// lies about what Grade 3 covers; rhythmDevices has no consumer in
// generators/ or validator.ts, so this is byte-identity-safe.
const GRADE_3_SCOPE: GradeScope = {
  clefs: GRADE_2_SCOPE.clefs,
  noteValues: [...GRADE_2_SCOPE.noteValues, ...(KB.grade3Adds.note_values as Duration[])],
  keysMajor: [...GRADE_2_SCOPE.keysMajor, ...KB.grade3Adds.keys_major],
  keysMinor: [...GRADE_2_SCOPE.keysMinor, ...KB.grade3Adds.keys_minor],
  minorForms: [...GRADE_2_SCOPE.minorForms, ...KB.grade3Adds.minor_forms],
  timeSignatures: [...GRADE_2_SCOPE.timeSignatures, ...KB.grade3Adds.time_signatures],
  rhythmDevices: [...GRADE_2_SCOPE.rhythmDevices, ...KB.grade3Adds.rhythm_devices],
  // Distinct object (not a reference copy of grade 2's) per KB.grade3Adds.intervals.naming
  // "number + type (perfect, major, minor)" — the number+type widening lands in U3.
  intervalRule: {
    aboveTonicOnly: true,
    namingStyle: 'number_and_type',
    maxOctaves: 1,
  },
  // KB.grade3Adds.pitch_range.ledger_lines: "up to 3 (and beyond) above and
  // below" (prose). Resolved the same way as grade 2's range — one more
  // outermost ledger-line NOTE each direction (+2 diatonic letters, a 3rd,
  // per ledger line):
  //   - treble: F3 (3rd ledger below; A3 was the 2nd) .. E6 (3rd ledger
  //     above; C6 was the 2nd).
  //   - bass: A1 (3rd ledger below; C2 was the 2nd) .. G4 (3rd ledger above;
  //     E4 was the 2nd).
  // Flagged for curriculum sign-off before this range's first pitch-content
  // slice ships, same as grade 2's; a one-line table edit if that review
  // disagrees, and cannot affect grades 1 or 2 (pitchRange/diatonicPitchesInRange
  // are grade-parameterized).
  pitchRanges: {
    treble: { low: 'F3', high: 'E6' },
    bass: { low: 'A1', high: 'G4' },
  },
};

export const GRADE_SCOPES: { 1: GradeScope; 2: GradeScope; 3: GradeScope } = {
  1: GRADE_1_SCOPE,
  2: GRADE_2_SCOPE,
  3: GRADE_3_SCOPE,
};

export function scopeForGrade(grade: number): GradeScope {
  const scope = (GRADE_SCOPES as Record<number, GradeScope | undefined>)[grade];
  if (!scope) {
    throw new Error(`scope: grade ${grade} is not supported`);
  }
  return scope;
}

const SIMPLE_RENDERABLE_TIME_SIGNATURES: readonly string[] = ['2/4', '3/4', '4/4'];
const GRADE_3_RENDERABLE_TIME_SIGNATURES: readonly string[] = [
  ...SIMPLE_RENDERABLE_TIME_SIGNATURES,
  '6/8',
  '9/8',
  '12/8',
];

// grade-2 /2 meters need minim-beat bar math; until the time-signatures
// slice, only /4 renders correctly — see plan D6. Grades 1/2 stay the frozen
// /4 subset (byte-identity); grade 3 opens the compound trio alongside it
// (D2) — the /2 meters stay non-renderable at every grade, that axis is
// still the deferred time-signatures slice.
export function renderableTimeSignatures(grade: number): readonly string[] {
  return grade >= 3 ? GRADE_3_RENDERABLE_TIME_SIGNATURES : SIMPLE_RENDERABLE_TIME_SIGNATURES;
}

export function pitchRange(clef: Clef, grade: number): { low: Pitch; high: Pitch } {
  return scopeForGrade(grade).pitchRanges[clef];
}

// Ledger-lines-3 fix (chromaticly-1v5.6 follow-up): pitchRange/pitchRanges is
// the READING range — correct for exercises whose subject IS the pitch
// (note_naming, interval_naming, scale_construction reading ledger lines).
// But add_time_signature/metre_classification only need ONE incidental pitch
// to give the bar a stave position; rhythm is the subject, pitch is
// decorative. Sampling those from the wide grade-3 reading range put ~20% of
// rhythm bars on a 3rd-ledger-line pitch — a notation-quality regression, not
// a curriculum requirement. comfortablePitchRange caps at the grade-2 range
// (staff + up to 2 ledger lines, comfortable at every grade) so incidental
// notation never drifts onto the extreme ledger lines the wider reading range
// allows. Grade 1/2 are unaffected (min(grade, 2) === grade there).
export function comfortablePitchRange(clef: Clef, grade: number): { low: Pitch; high: Pitch } {
  return pitchRange(clef, Math.min(grade, 2));
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
 * Diatonic (natural-letter, white-key) pitches within the grade's range for a
 * clef, e.g. ["C4","D4","E4",...]. G1/G2 keys carry their accidentals via key
 * signature rather than per-pitch accidentals (Eb major = 3 flats, A major =
 * 3 sharps, still key-signature-carried), so a natural-only enumerator is
 * sufficient at both grades.
 */
export function diatonicPitchesInRange(clef: Clef, grade: number): Pitch[] {
  return diatonicPitchesInBounds(pitchRange(clef, grade));
}

/** Same enumeration as diatonicPitchesInRange, but over comfortablePitchRange
 *  — for incidental-notation generators (add_time_signature,
 *  metre_classification) where pitch must stay comfortable, not widen with
 *  the grade's reading range. See comfortablePitchRange for why. */
export function diatonicPitchesInComfortableRange(clef: Clef, grade: number): Pitch[] {
  return diatonicPitchesInBounds(comfortablePitchRange(clef, grade));
}

function diatonicPitchesInBounds(bounds: { low: Pitch; high: Pitch }): Pitch[] {
  const { low, high } = bounds;
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
