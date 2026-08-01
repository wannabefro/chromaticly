// Grade 1 note_value_compare generator (KTD2): the coached warm-up's "which
// note lasts longer" question — a trivially-easy 2-option MCQ over two
// distinct G1 durations, with a notation stimulus showing both notes on one
// stave so a beginner can compare them visually before ever naming them.
// Standalone atom (not part of any lesson's atoms/completion gate) — see the
// onboarding-rebuild plan's KTD2/Open Question 3.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Music } from '../../music/types';
import { noteValueCompareAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type G1Duration = 'semiquaver' | 'quaver' | 'crotchet' | 'minim' | 'semibreve' | 'demisemiquaver' | 'breve';

// Units = sixteenths of a crotchet (mirrors bar-validity's pre-rescale UNITS
// table) — every duration maps to a distinct positive value, so "strictly
// longer" is a plain comparison with no ties possible among the seven values.
// demisemiquaver (D9 hardening) and breve (Grade 4) keep this table's own
// scale rather than bar-math's rescaled one — this is a note-comparison
// table, not bar math. breve = 2 semibreves = 32 (this file's own scale, not
// bar-math.ts's demisemiquaver=1 scale, where breve = 64 — that table is
// deliberately independent, per the demisemiquaver comment above).
export const UNITS: Record<G1Duration, number> = {
  semiquaver: 1,
  quaver: 2,
  crotchet: 4,
  minim: 8,
  semibreve: 16,
  demisemiquaver: 0.5,
  breve: 32,
};

// Plain-language option voice (design step 4: "The open one (minim)" / "The
// filled one (crotchet)") — described by notehead fill + stem/flag count, the
// visible feature a beginner reads off the stave, not the note's technical
// name.
export const NOTE_VALUE_LABELS: Record<G1Duration, string> = {
  semibreve: 'The open one with no stem (semibreve)',
  minim: 'The open one (minim)',
  crotchet: 'The filled one (crotchet)',
  quaver: 'The filled one with a flag (quaver)',
  semiquaver: 'The filled one with two flags (semiquaver)',
  demisemiquaver: 'The filled one with three flags (demisemiquaver)',
  breve: 'The open one with a line either side (breve)',
};

// Plain beat lengths (crotchet = 1 beat) for the coached "why" — mirrors the
// design's "a minim lasts 2 beats; the crotchet lasts 1" explanation copy.
const BEAT_LABEL: Record<G1Duration, string> = {
  semibreve: '4 beats',
  minim: '2 beats',
  crotchet: '1 beat',
  quaver: 'half a beat',
  semiquaver: 'a quarter-beat',
  demisemiquaver: 'an eighth-beat',
  breve: '8 beats',
};

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const G1_DURATIONS = scope.noteValues as readonly G1Duration[];
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);
  const pitch = pick(rng, diatonicPitchesInRange(clef, grade));

  const first = pick(rng, [...G1_DURATIONS]);
  const second = pick(rng, G1_DURATIONS.filter((d) => d !== first));

  const longer = UNITS[first] > UNITS[second] ? first : second;
  const shorter = longer === first ? second : first;

  const music: Music = {
    clef,
    key_sig: null,
    time_sig: null,
    voices: [
      {
        events: [
          { type: 'note', pitch, dur: first },
          { type: 'note', pitch, dur: second },
        ],
      },
    ],
  };

  return {
    id: makeInstanceId('note_value_compare', grade, idSeed),
    template_id: 'note_value_compare',
    grade,
    strand: 'rhythm',
    prompt: 'Which note lasts longer?',
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: NOTE_VALUE_LABELS[longer], accepted_alternatives: [] },
    distractors: [NOTE_VALUE_LABELS[shorter]],
    hints: [],
    feedback: {
      correct: `A ${longer} lasts ${BEAT_LABEL[longer]}; a ${shorter} lasts ${BEAT_LABEL[shorter]} — so the ${longer} lasts longer.`,
      incorrect: 'Not quite — compare how long each note is held, not how it looks on the page.',
      by_distractor: {
        [NOTE_VALUE_LABELS[shorter]]: `A ${shorter} lasts ${BEAT_LABEL[shorter]}, but a ${longer} lasts ${BEAT_LABEL[longer]}.`,
      },
    },
    srs_tags: [noteValueCompareAtom()],
    kb_version: KB_VERSION,
  };
}

export const noteValueCompare: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed));

// --- Equivalence shape (chromaticly-lgi) -----------------------------------
// Seeing which of two notes is longer and knowing how many of one fill the
// other are different skills. A breve is where the second one starts to bite.

const PLURAL: Record<G1Duration, string> = {
  semibreve: 'semibreves',
  minim: 'minims',
  crotchet: 'crotchets',
  quaver: 'quavers',
  semiquaver: 'semiquavers',
  demisemiquaver: 'demisemiquavers',
  breve: 'breves',
};

function buildEquivalence(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const durations = scope.noteValues as readonly G1Duration[];
  const rng = mulberry32(contentSeed);

  const longer = pick(rng, [...durations]);
  const shorter = pick(rng, durations.filter((d) => UNITS[d] < UNITS[longer]));
  const count = UNITS[longer] / UNITS[shorter];
  if (!Number.isInteger(count) || count < 2) {
    throw new Error(`note_value_equivalence: ${shorter} does not divide ${longer} a whole number of times`);
  }

  const distractors = [count / 2, count * 2].filter((n) => Number.isInteger(n) && n >= 1 && n !== count);
  if (distractors.length < 2) {
    throw new Error(`note_value_equivalence: no two whole-number miscounts beside ${count}`);
  }

  const label = (n: number): string => `${n}`;
  return {
    id: makeInstanceId('note_value_equivalence', grade, idSeed),
    template_id: 'note_value_equivalence',
    grade,
    strand: 'rhythm',
    prompt: `How many ${PLURAL[shorter]} last as long as one ${longer}?`,
    stimulus: { music: null, text: `${longer} = ? ${PLURAL[shorter]}` },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: label(count), accepted_alternatives: [] },
    distractors: distractors.map(label),
    hints: [`Halve the ${longer} step by step down the note tree until you reach a ${shorter}, counting as you go.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `A ${longer} lasts ${BEAT_LABEL[longer]} and a ${shorter} lasts ${BEAT_LABEL[shorter]}, so ${count} ${PLURAL[shorter]} fill it.`,
      by_distractor: Object.fromEntries(
        distractors.map((n) => [
          label(n),
          n < count
            ? `That is one step short down the note tree. Halving again gives ${count} ${PLURAL[shorter]}.`
            : `That is one step too far down the note tree. Stop at ${count} ${PLURAL[shorter]}.`,
        ]),
      ),
    },
    srs_tags: [noteValueCompareAtom()],
    kb_version: KB_VERSION,
  };
}

export const noteValueEquivalence: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildEquivalence(candidateSeed, opts.grade, opts.seed));
