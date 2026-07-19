// Minor-key theory helpers (D5): relative-major/minor pairing and a
// FORM-PARAMETERIZED harmonic/melodic scale builder, both derived from the
// KB rather than a second hand-maintained table. Grade 2 exercises only
// harmonic minor (scope.ts:58 minorForms: ['harmonic']) — the scope, not
// this builder, is where that restriction lives; melodic-asc is exercised
// below purely to prove the builder is form-general (G3 forward-compat, D5).

import { KB } from '../../content/knowledge-base';
import { spellInKeySig, tonicLetter } from './key-spelling';

export type MinorScaleForm = 'harmonic_minor' | 'melodic_minor_asc' | 'melodic_minor_desc';

/** Aeolian (natural minor) T/S interval pattern — the key-signature-only
 *  letter walk every minor form's alterations are diffed against. Not KB
 *  data (the KB has no natural_minor entry): a fixed music-theory fact, the
 *  same role SHARP_ORDER/MAJOR_FIFTHS play in abc-emitter.ts. */
const NATURAL_MINOR_PATTERN = ['T', 'S', 'T', 'T', 'S', 'T', 'T'] as const;

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

function intervalSemitones(token: string): number {
  return token.split('+').reduce((sum, part) => {
    if (part === 'T') return sum + 2;
    if (part === 'S') return sum + 1;
    throw new Error(`Unknown interval token: ${part}`);
  }, 0);
}

/** Cumulative semitones from the tonic at each of the 8 scale degrees. */
function cumulativeSemitones(pattern: readonly string[]): number[] {
  const result = [0];
  let total = 0;
  for (const token of pattern) {
    total += intervalSemitones(token);
    result.push(total);
  }
  return result;
}

function walkLetters(startLetter: string, startOctave: number): { letter: string; octave: number }[] {
  const startIdx = LETTERS.indexOf(startLetter as (typeof LETTERS)[number]);
  if (startIdx === -1) throw new Error(`Invalid pitch letter: ${startLetter}`);
  const steps: { letter: string; octave: number }[] = [];
  let idx = startIdx;
  let octave = startOctave;
  for (let i = 0; i < 8; i++) {
    steps.push({ letter: LETTERS[idx], octave });
    if (LETTERS[idx] === 'B') octave += 1; // scientific pitch: octave turns over at C
    idx = (idx + 1) % LETTERS.length;
  }
  return steps;
}

const ACCIDENTAL_LEVEL: Record<string, number> = { '': 0, '#': 1, '##': 2, b: -1, bb: -2 };
const LEVEL_SYMBOL: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

/** Shift a spelled pitch's accidental by `delta` semitones, letter-then-
 *  accidental (never re-letters an enharmonic). Exported so scale_construction
 *  (U4) can build corrupted-note candidates from the same true-scale spelling
 *  logic rather than a second copy of the accidental-level arithmetic. */
export function shiftAccidental(pitch: string, delta: number): string {
  const m = /^([A-G])(##|#|bb|b)?(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`Invalid pitch: ${pitch}`);
  const [, letter, symbol, octave] = m;
  const level = ACCIDENTAL_LEVEL[symbol ?? ''] + delta;
  const newSymbol = LEVEL_SYMBOL[level];
  if (newSymbol === undefined) {
    throw new Error(`Cannot spell ${pitch} shifted by ${delta} semitone(s) without a triple accidental`);
  }
  return `${letter}${newSymbol}${octave}`;
}

/** Relative major of a minor tonic: the major key sharing its key signature
 *  (same fifths count), read out of KB.keySignatures rather than a second
 *  hardcoded relative-pair table (D5). */
export function relativeMajorOf(minorTonic: string): string {
  const fifths = KB.keySignatures.minors[minorTonic];
  if (fifths === undefined) throw new Error(`Unknown minor tonic: ${minorTonic}`);
  const match = Object.entries(KB.keySignatures.majors).find(([, count]) => count === fifths);
  if (!match) throw new Error(`No relative major found for minor tonic: ${minorTonic}`);
  return match[0];
}

/** Relative minor of a major tonic — the inverse of relativeMajorOf. */
export function relativeMinorOf(majorTonic: string): string {
  const fifths = KB.keySignatures.majors[majorTonic];
  if (fifths === undefined) throw new Error(`Unknown major tonic: ${majorTonic}`);
  const match = Object.entries(KB.keySignatures.minors).find(([, count]) => count === fifths);
  if (!match) throw new Error(`No relative minor found for major tonic: ${majorTonic}`);
  return match[0];
}

/** Build an 8-pitch minor scale in the given form, starting at startPitch.
 *  Key-signature letter-walk via spellInKeySig, then the form's degree
 *  alterations are DERIVED by diffing the form's KB.scalePatterns interval
 *  pattern against natural minor — never a hardcoded per-form content
 *  branch, so a new form (e.g. melodic_minor_desc at G3) is new KB data,
 *  not new code.
 *
 *  startPitch contract (D5): NATURAL-LETTER only ("F2", never "F#2") — the
 *  regex below enforces this. The tonic's own accidental is never carried in
 *  startPitch; it comes out through spellInKeySig instead, e.g. for F# minor
 *  startPitch "F2" spells as "F#2" because the F#-minor signature sharpens F.
 *  This is what makes the builder sharp-tonic-safe with zero body change:
 *  callers (including F#/C# minor) always pass the tonic's natural letter. */
export function minorScale(tonic: string, form: MinorScaleForm, startPitch: string): string[] {
  const m = /^([A-G])(-?\d+)$/.exec(startPitch);
  if (!m) throw new Error(`Invalid start pitch: ${startPitch}`);
  const [, startLetter, startOctaveStr] = m;

  const steps = walkLetters(startLetter, Number(startOctaveStr));
  const keySig = `${tonic}_minor`;

  const naturalCumulative = cumulativeSemitones(NATURAL_MINOR_PATTERN);
  const formCumulative = cumulativeSemitones(KB.scalePatterns[form]);

  return steps.map(({ letter, octave }, degree) => {
    const spelled = spellInKeySig(`${letter}${octave}`, keySig);
    const delta = formCumulative[degree] - naturalCumulative[degree];
    return delta === 0 ? spelled : shiftAccidental(spelled, delta);
  });
}

/** The raised 7th of a harmonic/melodic minor key, spelled letter-then-
 *  accidental (e.g. 'G#4' for A minor) — for distractor/feedback copy.
 *  Built from tonicLetter(tonic), not the raw tonic (D5): minorScale's
 *  startPitch is natural-letter-only, so passing a sharp tonic directly
 *  (e.g. 'F#4') would fail the regex — raisedSeventh('F#') === 'E#5' and
 *  raisedSeventh('C#') === 'B#4' via this fix. */
export function raisedSeventh(tonic: string): string {
  return minorScale(tonic, 'harmonic_minor', `${tonicLetter(tonic)}4`)[6];
}
