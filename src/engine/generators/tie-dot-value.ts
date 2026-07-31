// Grade 1 tie_dot_value generator (chromaticly-e3z.14). ABRSM Grade 1 item 1
// names "tied notes" and "single-dotted notes and rests" explicitly, and the
// course had no atom for either — note-values carried three generic atoms that
// name neither device.
//
// Both devices answer the same question in different notation: how long does
// this last? So both variants answer in crotchet beats, and the wrong answers
// are the two real mistakes — reading only the first note of a tie, and adding
// a whole value for the dot instead of half.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, MusicEvent, Pitch } from '../../music/types';
import { parseAtom } from '../atoms';
import { musicEventUnits } from '../music-event-units';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

export const TIE_ATOM = 'tie';
export const DOT_ATOM = 'single_dot';

/** Beats per undotted value, at a crotchet beat. */
const BEATS: Partial<Record<Duration, number>> = { semibreve: 4, minim: 2, crotchet: 1, quaver: 0.5 };

const NAMES: Partial<Record<Duration, string>> = {
  semibreve: 'semibreve',
  minim: 'minim',
  crotchet: 'crotchet',
  quaver: 'quaver',
};

/** "3", "1½" — a beat count a Grade 1 learner would write down. */
function beatText(beats: number): string {
  const whole = Math.floor(beats);
  const half = beats - whole >= 0.5;
  if (!half) return `${whole}`;
  return whole === 0 ? '½' : `${whole}½`;
}

function beatLabel(beats: number): string {
  return `${beatText(beats)} ${beats === 1 ? 'beat' : 'beats'}`;
}

function devicesFromAtoms(atoms: string[]): string[] {
  const devices = atoms.filter((atom) => {
    const { kind } = parseAtom(atom);
    return kind === TIE_ATOM || kind === DOT_ATOM;
  });
  if (devices.length === 0) {
    throw new Error(`tie_dot_value: needs a "${TIE_ATOM}" or "${DOT_ATOM}" atom`);
  }
  return devices;
}

function barOf(clef: string, events: MusicEvent[], timeSig: string): Music {
  return {
    clef: clef as Music['clef'],
    key_sig: null,
    time_sig: timeSig,
    voices: [{ events: [...events, { type: 'barline', style: 'double' }] }],
  };
}

/** Pads the bar. A device worth one and a half beats needs a quaver too. */
function padTo(events: MusicEvent[], beats: number, target: number, pitch: Pitch): MusicEvent[] {
  const remaining = target - beats;
  const crotchets = Math.floor(remaining);
  const filler: MusicEvent[] = Array.from({ length: crotchets }, () => ({
    type: 'note',
    pitch,
    dur: 'crotchet',
  }));
  if (remaining - crotchets >= 0.5) filler.push({ type: 'note', pitch, dur: 'quaver' });
  const bar = [...events, ...filler];
  const units = bar.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
  if (units !== target * 8) {
    throw new Error(`tie_dot_value: bar sums to ${units}, expected ${target * 8}`);
  }
  return bar;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const scope = scopeForGrade(grade);
  const device = pick(rng, devicesFromAtoms(atoms));
  const clef = pick(rng, [...scope.clefs]);
  const pitch = pick(rng, diatonicPitchesInComfortableRange(clef, grade));

  const common = {
    id: makeInstanceId('tie_dot_value', grade, idSeed),
    template_id: 'tie_dot_value' as const,
    grade,
    strand: 'rhythm' as const,
    interaction: { type: 'mcq' as const, config: {} },
    kb_version: KB_VERSION,
  };

  if (device === TIE_ATOM) {
    const first = pick(rng, ['minim', 'crotchet'] as const);
    const second = pick(rng, ['crotchet', 'quaver'] as const);
    const total = BEATS[first]! + BEATS[second]!;
    const events: MusicEvent[] = [
      { type: 'note', pitch, dur: first, tie: true },
      { type: 'note', pitch, dur: second },
    ];
    const correct = beatLabel(total);
    const wrong = [beatLabel(BEATS[first]!), beatLabel(BEATS[second]!)];
    return {
      ...common,
      prompt: 'These two notes are tied. How long does the sound last?',
      stimulus: { music: barOf(clef, padTo(events, total, 4, pitch), '4/4'), text: null },
      answer: { canonical: correct, accepted_alternatives: [] },
      distractors: wrong,
      hints: ['A tie joins two notes into one sound. Add the two values together.'],
      feedback: {
        correct: 'Correct!',
        incorrect: `A tie adds the values: a ${NAMES[first]} plus a ${NAMES[second]} is ${correct}.`,
        by_distractor: {
          [wrong[0]]: 'That is only the first note. A tie means the sound carries on into the second one.',
          [wrong[1]]: 'That is only the second note. The sound starts on the first and holds through both.',
        },
      },
      srs_tags: [TIE_ATOM],
    };
  }

  const base = pick(rng, ['minim', 'crotchet'] as const);
  const isRest = pick(rng, [true, false]);
  const plain = BEATS[base]!;
  const total = plain * 1.5;
  const head: MusicEvent = isRest
    ? { type: 'rest', dur: base, dots: 1 }
    : { type: 'note', pitch, dur: base, dots: 1 };
  const correct = beatLabel(total);
  const wrong = [beatLabel(plain), beatLabel(plain * 2)];
  const noun = isRest ? 'rest' : 'note';
  return {
    ...common,
    prompt: `How long does this dotted ${noun} last?`,
    stimulus: { music: barOf(clef, padTo([head], total, 4, pitch), '4/4'), text: null },
    answer: { canonical: correct, accepted_alternatives: [] },
    distractors: wrong,
    hints: ['A dot adds HALF the value again — half of the note it sits beside, not another whole one.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `A dotted ${NAMES[base]} ${noun} is ${beatLabel(plain)} plus half again, which is ${correct}.`,
      by_distractor: {
        [wrong[0]]: `That is the ${NAMES[base]} on its own. The dot adds half of it again.`,
        [wrong[1]]: 'The dot adds HALF the value again, not another whole one.',
      },
    },
    srs_tags: [DOT_ATOM],
  };
}

export const tieDotValue: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
