// Grade 1 interval_naming generator (curriculum/exercise-templates.json,
// template_id "interval_naming"). G1 rule (scope.ts scopeForGrade(1).intervalRule): the
// lower note is pinned to the tonic of a sampled major key, the upper note is a
// diatonic pitch above it (number-only naming, above tonic, <= an octave). Each
// pitch is spelled in the key (spellInKey) so the key signature carries its
// accidental — a natural tonic prints plain, a flat/sharp tonic (Bb, Eb) prints
// under its key signature rather than as a stray natural (commandment 1: scope
// is law).

import type { Clef } from '../../music/types';
import { KB_VERSION } from '../../content/knowledge-base';
import { intervalAtom } from '../atoms';
import { int, mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, pitchRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { spellInKey, tonicLetter } from './key-spelling';
import { naturalPitchStepsAbove, scientificPitchOrdinal } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Shared sampling core for both the mcq and stave_input variants: pin the
 *  lower note to the sampled key's tonic and draw a diatonic interval above
 *  it that stays within the clef's grade range (scope.intervalRule). Returns the
 *  tonic as a NATURAL-letter pitch (the interval math needs it); callers spell it
 *  in the key for display. */
function sampleInterval(
  rng: () => number,
  clef: Clef,
  key: string,
  grade: number,
): { lowerPitch: string; steps: number; intervalNumber: number } {
  const range = pitchRange(clef, grade);

  // Match the tonic's natural LETTER — the naturals-only enumeration never holds
  // an accidented pitch, so a flat key ('Bb') would never match its full name.
  const tonicOccurrences = diatonicPitchesInRange(clef, grade).filter((p) => p.startsWith(tonicLetter(key)));
  if (tonicOccurrences.length === 0) {
    throw new Error(`no in-range occurrence of tonic ${key} for clef ${clef}`);
  }
  const lowerPitch = tonicOccurrences[0];

  const highOrdinal = scientificPitchOrdinal(range.high);
  const maxSteps = Math.min(7, highOrdinal - scientificPitchOrdinal(lowerPitch));
  if (maxSteps < 1) {
    throw new Error(`no room above the tonic ${lowerPitch} for an interval within range`);
  }

  const steps = int(rng, 1, maxSteps);
  return { lowerPitch, steps, intervalNumber: steps + 1 };
}

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);
  const key = pick(rng, [...scope.keysMajor]);
  const { lowerPitch, steps, intervalNumber } = sampleInterval(rng, clef, key, grade);
  const upperPitch = spellInKey(naturalPitchStepsAbove(lowerPitch, steps), key);

  const distractors = [intervalNumber - 1, intervalNumber + 1].filter(
    (n) => n >= 1 && n <= 8 && n !== intervalNumber,
  );

  return {
    id: makeInstanceId('interval_naming', grade, idSeed),
    template_id: 'interval_naming',
    grade,
    strand: 'intervals',
    prompt: 'Name this interval (number only).',
    stimulus: {
      music: {
        clef,
        key_sig: `${key}_major`,
        time_sig: null,
        voices: [{ events: [{ type: 'chord', pitches: [spellInKey(lowerPitch, key), upperPitch], dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: intervalNumber, accepted_alternatives: [] },
    distractors,
    hints: ['Count the letter names from the lower note up to the higher note, counting both ends.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — recount inclusively from the lower note to the upper note, counting both ends.',
    },
    srs_tags: [intervalAtom(intervalNumber)],
    kb_version: KB_VERSION,
  };
}

export const intervalNaming: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed));

// --- Stave-input variant (U8/RD2): "write the note a [interval] higher than
// the given note" — the sole Grade 1 stave-input item; no general write-any-
// note (RD2). A separate template_id ("interval_naming_stave_input") rather
// than a mode flag on `intervalNaming`, mirroring term-meaning's mcq/flashcard
// split (AD2's reasoning): `intervalNaming` (mcq) stays byte-identical for
// every existing caller, and U9 points the intervals lesson at whichever id it
// wants. `answer.canonical` is the SEMANTIC target { pitch, dur } — a
// scientific pitch spelled in the sampled key + a G1 duration — never a
// rendered Music object (mirrors AD5's semantic-canonical rule; StaveInput's
// grading never deep-equals a Music object either).

/** "an 8th", but "a 5th" — the article follows how the ordinal is SPOKEN (eighth,
 *  eleventh, eighteenth begin with a vowel sound), not how it is spelt. */
function article(n: number): string {
  return [8, 11, 18].includes(n % 100) ? 'an' : 'a';
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function buildStaveInput(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);
  const key = pick(rng, [...scope.keysMajor]);
  const { lowerPitch, steps, intervalNumber } = sampleInterval(rng, clef, key, grade);
  const targetPitch = spellInKey(naturalPitchStepsAbove(lowerPitch, steps), key);
  const targetDur = pick(rng, [...scope.noteValues]);

  return {
    id: makeInstanceId('interval_naming_stave_input', grade, idSeed),
    template_id: 'interval_naming_stave_input',
    grade,
    strand: 'intervals',
    prompt: `Write the note ${article(intervalNumber)} ${ordinal(intervalNumber)} higher than the given note, as a ${targetDur}.`,
    stimulus: {
      music: {
        clef,
        key_sig: `${key}_major`,
        time_sig: null,
        voices: [{ events: [{ type: 'note', pitch: spellInKey(lowerPitch, key), dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'stave_input', config: {} },
    answer: { canonical: { pitch: targetPitch, dur: targetDur }, accepted_alternatives: [] },
    distractors: [],
    hints: [
      'Count the letter names from the given note up to the target note, counting both ends — then match the requested duration.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — recount the interval inclusively from the given note, and check you used the requested duration.',
    },
    srs_tags: [intervalAtom(intervalNumber)],
    kb_version: KB_VERSION,
  };
}

export const intervalNamingStaveInput: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildStaveInput(candidateSeed, opts.grade, opts.seed));
