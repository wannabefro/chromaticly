// Grade 1 major_scale_steps generator (chromaticly-e3z.15). ABRSM Grade 1
// item 4 asks for "construction of the major scale including the position of
// tones and semitones", and the course taught neither: scale_construction is
// minor-only and does not exist before Grade 2.
//
// Three variants, because the requirement has three parts. 'pattern' asks for
// the sequence itself. 'where' asks which two degrees a semitone falls between.
// 'spot' renders the scale with one note a semitone wrong and asks which degree
// broke — the construction half, checked against a rendered stave rather than
// a recited rule.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Clef, Music, MusicEvent, Pitch } from '../../music/types';
import { majorStepsAtom, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { spellInKey, tonicLetter } from './key-spelling';
import { shiftAccidental } from './minor-keys';
import { naturalPitchStepsAbove, parseNaturalPitch } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** The major scale, as the step between each pair of adjacent degrees. */
const MAJOR_STEPS = ['T', 'T', 'S', 'T', 'T', 'T', 'S'] as const;

/** The two places a semitone falls, as 1-based lower degrees. */
const SEMITONE_STEPS = [3, 7];

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'] as const;

function pairLabel(lower: number): string {
  return `${ORDINALS[lower - 1]} and ${ORDINALS[lower]}`;
}

/** The tonics the lesson's `major_steps:<tonic>` atoms name. */
function tonicsFromAtoms(atoms: string[]): string[] {
  const tonics: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'major_steps' || parts.length !== 1) continue;
    if (!tonics.includes(parts[0])) tonics.push(parts[0]);
  }
  if (tonics.length === 0) {
    throw new Error('major_scale_steps: needs at least one major_steps:<tonic> atom');
  }
  return tonics;
}

/** One octave of the major scale, ascending, spelled under its key signature. */
function majorScalePitches(clef: Clef, grade: number, key: string): Pitch[] {
  const range = diatonicPitchesInComfortableRange(clef, grade);
  const start = range.find(
    (p) => parseNaturalPitch(p).letter === tonicLetter(key) && range.includes(naturalPitchStepsAbove(p, 7)),
  );
  if (!start) throw new Error(`major_scale_steps: no octave of ${key} fits in ${clef}`);
  return Array.from({ length: 8 }, (_, i) => spellInKey(naturalPitchStepsAbove(start, i), key));
}

function scaleMusic(clef: Clef, key: string, pitches: Pitch[]): Music {
  return {
    clef,
    key_sig: `${key}_major`,
    time_sig: null,
    voices: [{ events: pitches.map((pitch): MusicEvent => ({ type: 'note', pitch, dur: 'crotchet' })) }],
  };
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const scope = scopeForGrade(grade);
  const key = pick(rng, tonicsFromAtoms(atoms));
  const clef = pick(rng, [...scope.clefs]);
  const variant = pick(rng, ['pattern', 'where', 'spot'] as const);
  const pitches = majorScalePitches(clef, grade, key);

  const common = {
    id: makeInstanceId('major_scale_steps', grade, idSeed),
    template_id: 'major_scale_steps' as const,
    grade,
    strand: 'scales_keys' as const,
    interaction: { type: 'mcq' as const, config: {} },
    srs_tags: [majorStepsAtom(key)],
    kb_version: KB_VERSION,
  };

  if (variant === 'pattern') {
    const correct = MAJOR_STEPS.join(' ');
    const wrong = ['T S T T S T T', 'T T T S T T S'];
    return {
      ...common,
      prompt: 'Which pattern of tones (T) and semitones (S) builds a major scale?',
      stimulus: { music: scaleMusic(clef, key, pitches), text: null },
      answer: { canonical: correct, accepted_alternatives: [] },
      distractors: wrong,
      hints: ['Two of the seven steps are semitones. Find where they sit, and the rest are tones.'],
      feedback: {
        correct: 'Correct!',
        incorrect: `A major scale is ${correct} — semitones between the 3rd and 4th, and between the 7th and 8th.`,
        by_distractor: {
          [wrong[0]]: 'That puts a semitone second. In a major scale the first semitone comes after two tones.',
          [wrong[1]]: 'That puts three tones first. The first semitone comes between the 3rd and 4th notes.',
        },
      },
    };
  }

  if (variant === 'where') {
    const lower = pick(rng, SEMITONE_STEPS);
    const correct = pairLabel(lower);
    const wrong = [pairLabel(lower === 3 ? 4 : 6), pairLabel(lower === 3 ? 2 : 5)];
    return {
      ...common,
      prompt: `This is ${key} major. Which two notes have a semitone between them?`,
      stimulus: { music: scaleMusic(clef, key, pitches), text: null },
      answer: { canonical: correct, accepted_alternatives: [] },
      distractors: wrong,
      hints: ['Look for the two places on the keyboard with no black note between the white ones.'],
      feedback: {
        correct: 'Correct!',
        incorrect: `A major scale has its semitones between the 3rd and 4th notes and between the 7th and 8th.`,
        by_distractor: {
          [wrong[0]]: 'That step is a tone. The semitones are between the 3rd and 4th, and the 7th and 8th.',
          [wrong[1]]: 'That step is a tone too. Count up from the keynote: the first semitone is the 3rd to the 4th.',
        },
      },
    };
  }

  // 'spot': never the 1st or 8th, which would read as a different key.
  const brokenDegree = pick(rng, [2, 3, 4, 5, 6, 7]);
  const direction = pick(rng, [1, -1]);
  const corrupted = [...pitches];
  corrupted[brokenDegree - 1] = shiftAccidental(pitches[brokenDegree - 1], direction);
  const correct = ORDINALS[brokenDegree - 1];
  const wrong = [ORDINALS[brokenDegree - 2], ORDINALS[brokenDegree]];
  return {
    ...common,
    prompt: `One note of this ${key} major scale is wrong. Which degree is it?`,
    stimulus: { music: scaleMusic(clef, key, corrupted), text: null },
    answer: { canonical: correct, accepted_alternatives: [] },
    distractors: wrong,
    hints: [`Sing or play up from ${key}. The note that breaks the tone-tone-semitone shape is the wrong one.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `The ${correct} degree is the one that does not fit T T S T T T S.`,
      by_distractor: Object.fromEntries(
        wrong.map((w) => [w, `The ${w} degree is right for ${key} major. Check the ${correct} against the pattern.`]),
      ),
    },
  };
}

export const majorScaleSteps: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
