// Grade 1 interval_naming generator (curriculum/exercise-templates.json,
// template_id "interval_naming"). G1 rule (scope.ts G1_INTERVAL_RULE): the
// lower note is pinned to the tonic of a sampled G1 major key, the upper note
// is a diatonic pitch above it (number-only naming, above tonic, <= an
// octave). The key signature carries the key's accidental, so both pitches
// stay natural-letter (commandment 1: scope is law).

import { KB_VERSION } from '../../content/knowledge-base';
import { intervalAtom } from '../atoms';
import { int, mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, G1_CLEFS, G1_KEYS_MAJOR, pitchRange } from '../scope';
import type { ExerciseInstance } from '../schema';
import { naturalPitchStepsAbove, scientificPitchOrdinal } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...G1_CLEFS]);
  const key = pick(rng, [...G1_KEYS_MAJOR]);
  const range = pitchRange(clef);

  const tonicOccurrences = diatonicPitchesInRange(clef).filter((p) => p.startsWith(key));
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
  const upperPitch = naturalPitchStepsAbove(lowerPitch, steps);
  const intervalNumber = steps + 1;

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
        voices: [{ events: [{ type: 'chord', pitches: [lowerPitch, upperPitch], dur: 'semibreve' }] }],
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
