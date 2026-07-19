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
// melodic minor forms — but timeSignatures/noteValues/rhythmDevices/
// intervalRule/pitchRanges/clefs are COPIED FROM GRADE 2 UNCHANGED. This is a
// deliberate divergence from the grade-2 precedent (which listed its new /2
// meters here): nothing in this slice needs compound time (6/8/9/8/12/8)
// validated, so those axes stay out of the scope list entirely rather than
// being listed-but-unreachable. The compound-time slice adds them to BOTH
// this list and renderableTimeSignatures together.
const GRADE_3_SCOPE: GradeScope = {
  clefs: GRADE_2_SCOPE.clefs,
  noteValues: GRADE_2_SCOPE.noteValues,
  keysMajor: [...GRADE_2_SCOPE.keysMajor, ...KB.grade3Adds.keys_major],
  keysMinor: [...GRADE_2_SCOPE.keysMinor, ...KB.grade3Adds.keys_minor],
  minorForms: [...GRADE_2_SCOPE.minorForms, ...KB.grade3Adds.minor_forms],
  timeSignatures: GRADE_2_SCOPE.timeSignatures,
  rhythmDevices: GRADE_2_SCOPE.rhythmDevices,
  intervalRule: GRADE_2_SCOPE.intervalRule,
  pitchRanges: GRADE_2_SCOPE.pitchRanges,
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

const RENDERABLE_TIME_SIGNATURES: readonly string[] = ['2/4', '3/4', '4/4'];

// grade-2 /2 meters need minim-beat bar math; until the time-signatures
// slice, only /4 renders correctly — see plan D6. Returns the same /4 subset
// for every grade so meter/rhythm generators never silently emit a
// wrong-length bar.
export function renderableTimeSignatures(_grade: number): readonly string[] {
  return RENDERABLE_TIME_SIGNATURES;
}

export function pitchRange(clef: Clef, grade: number): { low: Pitch; high: Pitch } {
  return scopeForGrade(grade).pitchRanges[clef];
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
  const { low, high } = pitchRange(clef, grade);
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
