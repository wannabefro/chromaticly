// scale_degree_id (Grades 1-3, chromaticly-e3z.3). The syllabus names two
// things in the same breath as key signatures, at every one of the first three
// grades, and the course taught neither. Grade 1, verbatim:
//
//   "Scales and key signatures of the major keys of C, G, D and F in both
//    clefs, with their tonic triads (root position), degrees (number only),
//    and intervals above the tonic (by number only)."
//
// Grades 2 and 3 repeat the phrase over their own wider key sets, so this is
// one generator parameterised by grade, not three.
//
// Two variants, one per requirement, selected by which atom the lesson names.
// They share a generator because the syllabus treats them as one topic: a
// tonic triad IS degrees 1, 3 and 5 stacked, and teaching them apart loses
// exactly the connection that makes the triad memorable.
//
// "Degrees (number only)" is deliberately not degree_name_id, which teaches the
// TECHNICAL names (tonic, supertonic, mediant) and is a separate Grade 4
// requirement. Answering "5th" and answering "dominant" are different facts,
// so they get different atoms.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Clef, Music } from '../../music/types';
import { degreeNumberAtom, parseAtom, TONIC_TRIAD_ATOM } from '../atoms';
import { mulberry32, pick } from '../rng';
import { scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { buildTriad } from './chord-recognition';
import { spellInKey, tonicLetter } from './key-spelling';
import { diatonicPitchesInComfortableRange } from '../scope';
import { naturalPitchStepsAbove, parseNaturalPitch } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Treble and bass only. The syllabus says "in both clefs" at Grade 1, and the
 *  C clefs do not exist until Grade 4. */
const DEGREE_CLEFS: readonly Clef[] = ['treble', 'bass'];

export const DEGREE_ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'] as const;

/** Degree numbers named by `degree:<n>` atoms, in atom order. */
function degreeNumbersFromAtoms(atoms: string[]): number[] {
  const numbers: number[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'degree' || parts.length !== 1) continue;
    const n = Number(parts[0]);
    if (Number.isInteger(n) && n >= 1 && n <= 7 && !numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

/** The two nearest degrees to `n` within 1..7, ties preferring the lower —
 *  a miscount is almost always by one, so a distractor two away teaches less. */
function nearestDegrees(n: number, count: number): number[] {
  return [1, 2, 3, 4, 5, 6, 7]
    .filter((m) => m !== n)
    .sort((a, b) => Math.abs(a - n) - Math.abs(b - n) || a - b)
    .slice(0, count);
}

function buildDegree(rng: () => number, grade: number, idSeed: number, numbers: number[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const clef = pick(rng, [...DEGREE_CLEFS]);
  const key = pick(rng, [...scope.keysMajor]);
  const degree = pick(rng, numbers);

  // Anchor on an in-range occurrence of the tonic letter, then step up. The
  // 7th needs six steps of headroom, so a tonic too near the top of the range
  // would put the note off the stave.
  const pitches = diatonicPitchesInComfortableRange(clef, grade);
  const tonicOccurrences = pitches.filter((p) => parseNaturalPitch(p).letter === tonicLetter(key));
  const usable = tonicOccurrences.filter((p) => pitches.includes(naturalPitchStepsAbove(p, 6)));
  if (usable.length === 0) {
    throw new Error(`scale_degree_id: no tonic occurrence of ${key} leaves room for a 7th in ${clef}`);
  }
  const tonic = usable[0];
  const natural = naturalPitchStepsAbove(tonic, degree - 1);
  const pitch = spellInKey(natural, key);

  const canonical = DEGREE_ORDINALS[degree - 1];
  const distractorNumbers = nearestDegrees(degree, 2);
  const music: Music = {
    clef,
    key_sig: `${key}_major`,
    time_sig: null,
    voices: [{ events: [{ type: 'note', pitch, dur: 'semibreve' }] }],
  };

  return {
    id: makeInstanceId('scale_degree_id', grade, idSeed),
    template_id: 'scale_degree_id',
    grade,
    strand: 'scales_keys',
    prompt: `Which degree of the ${key} major scale is this note?`,
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors: distractorNumbers.map((n) => DEGREE_ORDINALS[n - 1]),
    hints: [
      `Start from ${key}, the 1st degree, and count up the letter names to this note. The tonic itself counts as 1.`,
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: `Count up from ${key}, the 1st degree, one letter name at a time. This note is the ${canonical}.`,
      by_distractor: Object.fromEntries(
        distractorNumbers.map((n) => [
          DEGREE_ORDINALS[n - 1],
          n < degree
            ? `That is one short. Remember the tonic itself is the 1st degree, not zero — counting from ${key} gives the ${canonical}.`
            : `That is one too far. Count the letter names from ${key} inclusive and stop on this note: it is the ${canonical}.`,
        ]),
      ),
    },
    srs_tags: [degreeNumberAtom(degree)],
    kb_version: KB_VERSION,
  };
}

function buildTonicTriad(rng: () => number, grade: number, idSeed: number): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const clef = pick(rng, [...DEGREE_CLEFS]);
  const key = pick(rng, [...scope.keysMajor]);

  // The stimulus is the key NAME, and the options are the staves. That is the
  // way round design/components/core/AnswerOption.prompt.md describes ("for
  // notation answers, e.g. four key signatures, pass a mini NotationCard") —
  // and it is the way round that cannot be answered by matching the stimulus
  // against the options, because there is nothing on the stimulus to match.
  const staveFor = (numeral: string): Music => ({
    clef,
    key_sig: `${key}_major`,
    time_sig: null,
    voices: [{ events: [{ type: 'chord', pitches: buildTriad(clef, grade, key, numeral), dur: 'semibreve' }] }],
  });

  // The two wrong triads are the ones built on the neighbouring primary degrees
  // a learner reaches by miscounting, not arbitrary chords. Options are keyed by
  // numeral rather than a positional letter: the label is never displayed for a
  // notation option, so the key exists to address feedback.by_distractor and to
  // be readable in a test — a letter would carry no meaning in either.

  return {
    id: makeInstanceId('scale_degree_id', grade, idSeed),
    template_id: 'scale_degree_id',
    grade,
    strand: 'scales_keys',
    prompt: `Which of these is the tonic triad of ${key} major?`,
    stimulus: { music: null, text: `${key} major` },
    interaction: {
      type: 'mcq',
      config: { option_music: { I: staveFor('I'), IV: staveFor('IV'), V: staveFor('V') } },
    },
    answer: { canonical: 'I', accepted_alternatives: [] },
    distractors: ['IV', 'V'],
    hints: [
      `The tonic triad is built on the 1st degree. Find ${key} on the stave, then stack the 3rd and the 5th above it.`,
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: `The tonic triad starts on the 1st degree of the scale, so its lowest note is ${key}.`,
      by_distractor: {
        IV: `That triad is built on the 4th degree, not the 1st. The tonic triad's lowest note is ${key}.`,
        V: `That triad is built on the 5th degree, not the 1st. The tonic triad's lowest note is ${key}.`,
      },
    },
    srs_tags: [TONIC_TRIAD_ATOM],
    kb_version: KB_VERSION,
  };
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const numbers = degreeNumbersFromAtoms(atoms);
  if (numbers.length > 0) return buildDegree(rng, grade, idSeed, numbers);
  if (atoms.includes(TONIC_TRIAD_ATOM)) return buildTonicTriad(rng, grade, idSeed);
  throw new Error('scale_degree_id: needs at least one degree:<n> or tonic_triad atom');
}

export const scaleDegreeId: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
