// accidental_cancellation generator (chromaticly-7xv.2). Grade 4 item 2 reads
// "Double sharp and double flat signs, AND THEIR CANCELLATION", and only the
// signs were scored. The bar draws the letter doubled, a different letter, then
// the letter again carrying the cancelling sign; the learner names the last note.

import { KB_VERSION } from '../../content/knowledge-base';
import { parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { formatNoteName } from './note-naming';
import { pitchOrdinal, type Letter } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type Doubled = 'double_sharp' | 'double_flat';
type Cancelled = 'sharp' | 'flat' | null;

/** Each cancellation is its own atom: reading the natural does not teach the
 *  single sharp, which is the harder half. */
export interface Cancellation {
  from: Doubled;
  to: Cancelled;
}

export const CANCELLATIONS: readonly Cancellation[] = [
  { from: 'double_sharp', to: null },
  { from: 'double_sharp', to: 'sharp' },
  { from: 'double_flat', to: null },
  { from: 'double_flat', to: 'flat' },
];

const SIGN_WORD: Record<string, string> = {
  double_sharp: 'double sharp',
  double_flat: 'double flat',
  sharp: 'sharp',
  flat: 'flat',
  natural: 'natural',
};

/** e.g. {double_sharp, sharp} -> "accidental_cancel:double_sharp_to_sharp". */
export function cancellationAtom({ from, to }: Cancellation): string {
  return `accidental_cancel:${from}_to_${to ?? 'natural'}`;
}

export function parseCancellationAtom(atom: string): Cancellation | null {
  const { kind, parts } = parseAtom(atom);
  if (kind !== 'accidental_cancel' || parts.length !== 1) return null;
  return CANCELLATIONS.find((c) => cancellationAtom(c) === atom) ?? null;
}

// B##, E##, Cbb and Fbb spell notes this course never writes.
const LETTERS: Record<Doubled, readonly Letter[]> = {
  double_sharp: ['C', 'D', 'F', 'G', 'A'],
  double_flat: ['D', 'E', 'G', 'A', 'B'],
};

const SUFFIX: Record<string, string> = { double_sharp: '##', double_flat: 'bb', sharp: '#', flat: 'b' };

const LETTER_ORDER: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

function adjacentLetter(letter: Letter, direction: 1 | -1): Letter {
  return LETTER_ORDER[(LETTER_ORDER.indexOf(letter) + direction + 7) % 7];
}

function spell(letter: Letter, accidental: string | null, octave: number): string {
  return `${letter}${accidental ? SUFFIX[accidental] : ''}${octave}`;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const wanted = atoms.map(parseCancellationAtom).filter((c): c is Cancellation => c !== null);
  if (wanted.length === 0) throw new Error('accidental_cancellation: needs an accidental_cancel:* atom');

  // Round-robin. The set rotates templates every 8 items, so `% 4` alone would
  // reach two of four.
  const { from, to } = wanted[(idSeed + Math.floor(idSeed / 8)) % wanted.length];
  const clef = pick(rng, [...scopeForGrade(grade).clefs]);

  // One octave for both: an octave change would make it a different question.
  const inRange = diatonicPitchesInRange(clef, grade);
  const candidates = inRange.filter((p) => LETTERS[from].includes(p[0] as Letter));
  const chosen = pick(rng, candidates);
  const letter = chosen[0] as Letter;
  const octave = Number(chosen.slice(1));

  // A different letter, or it takes the accidental and carries nothing across.
  const near = inRange.filter(
    (p) => p[0] !== letter && Math.abs(pitchOrdinal(p[0] as Letter, Number(p.slice(1))) - pitchOrdinal(letter, octave)) <= 4,
  );
  const between = pick(rng, near.length > 0 ? near : inRange.filter((p) => p[0] !== letter));

  const canonical = formatNoteName(letter, to);
  // Keep the double, cancel by the wrong amount, or lose the letter.
  const single = from === 'double_sharp' ? 'sharp' : 'flat';
  const doubled = formatNoteName(letter, from);
  const halfway = to === null ? formatNoteName(letter, single) : letter;
  const misread = adjacentLetter(letter, pick(rng, [1, -1] as const));
  const distractors = [doubled, halfway, misread];
  const cancelWord = to === null ? 'natural' : to;

  return {
    id: makeInstanceId('accidental_cancellation', grade, idSeed),
    template_id: 'accidental_cancellation',
    grade,
    strand: 'pitch',
    prompt: 'Name the last note in this bar.',
    stimulus: {
      music: {
        clef,
        key_sig: null,
        time_sig: '3/4',
        voices: [
          {
            events: [
              { type: 'note', pitch: spell(letter, from, octave), dur: 'crotchet' },
              { type: 'note', pitch: between, dur: 'crotchet' },
              { type: 'note', pitch: spell(letter, to, octave), dur: 'crotchet' },
            ],
          },
        ],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors,
    hints: [
      `A ${SIGN_WORD[from]} holds for the rest of the bar. A later sign on the same note replaces it — it does not add to it.`,
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: `The ${SIGN_WORD[cancelWord]} cancels the ${SIGN_WORD[from]}, so the last note is ${canonical}.`,
      by_distractor: {
        [doubled]: `The ${SIGN_WORD[cancelWord]} replaces the ${SIGN_WORD[from]} — it does not stay in force once a new sign appears.`,
        [halfway]: `A ${SIGN_WORD[cancelWord]} means exactly ${canonical}, no more and no less.`,
        [misread]: `That is the next letter up or down. The sign changes the pitch, never the letter.`,
      },
    },
    srs_tags: [cancellationAtom({ from, to })],
    kb_version: KB_VERSION,
  };
}

export const accidentalCancellation: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
