// Grade 4 duplet_recognition generator (fyu.7) — mirrors
// anacrusis-recognition.ts's structure. A duplet is two notes played in the
// time of three of the same value, and it lives in COMPOUND time (x/8 with a
// multiple-of-three numerator), where it fills one dotted-crotchet beat that
// would normally hold three quavers. The generator renders a compound-time bar
// with one beat replaced by a duplet (the two quavers carry a TupletMark, so
// the emitter draws the `(2` bracket and the bar still sums to a whole bar) and
// asks a recognition MCQ about the 2-in-3 relationship or the beat it fills.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Music, MusicEvent, Pitch } from '../../music/types';
import { dupletAtom, parseAtom } from '../atoms';
import { musicEventUnits } from '../music-event-units';
import { isCompoundTimeSignature } from '../metre';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { barUnitsFor } from './bar-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** The atom-named compound signatures (duplet:<sig>). */
function dupletSignaturesFromAtoms(atoms: string[]): string[] {
  const sigs: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'duplet' || parts.length !== 1) continue;
    const [sig] = parts;
    if (!sigs.includes(sig)) sigs.push(sig);
  }
  if (sigs.length === 0) {
    throw new Error('duplet_recognition: needs at least one duplet:<sig> atom');
  }
  return sigs;
}

/** A dotted-crotchet compound beat is 12 demisemiquaver-units (three quavers). */
const BEAT_UNITS = 12;

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const sig = pick(rng, dupletSignaturesFromAtoms(atoms));
  if (!isCompoundTimeSignature(sig)) {
    throw new Error(`duplet_recognition: "${sig}" is not a compound time signature`);
  }
  const beats = barUnitsFor(sig) / BEAT_UNITS;

  const clef = pick(rng, [...scope.clefs]);
  const range = diatonicPitchesInComfortableRange(clef, grade);
  const a: Pitch = pick(rng, range);
  const b: Pitch = pick(rng, range);
  const dupletBeat = pick(rng, Array.from({ length: beats }, (_, i) => i));

  const events: MusicEvent[] = [];
  for (let beat = 0; beat < beats; beat++) {
    if (beat === dupletBeat) {
      events.push({ type: 'note', pitch: a, dur: 'quaver', tuplet: { size: 2, inTimeOf: 3, start: true } });
      events.push({ type: 'note', pitch: b, dur: 'quaver', tuplet: { size: 2, inTimeOf: 3 } });
    } else {
      events.push({ type: 'note', pitch: a, dur: 'crotchet', dots: 1 });
    }
  }

  // A duplet fills its beat exactly — the plan's "duplet fits its beat" rule.
  // Assert it here so a construction slip fails at generation, not on device.
  const total = events.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
  if (total !== beats * BEAT_UNITS) {
    throw new Error(`duplet_recognition: bar sums to ${total}, expected ${beats * BEAT_UNITS}`);
  }

  const music: Music = { clef, key_sig: null, time_sig: sig, voices: [{ events }] };

  const variant = pick(rng, ['ratio', 'beat'] as const);
  const { prompt, canonical, distractors, whyWrong } =
    variant === 'ratio'
      ? {
          prompt: 'The bracketed notes are a duplet. Two notes are played in the time of how many?',
          canonical: 'three',
          distractors: ['two', 'four'],
          whyWrong: {
            two: 'Two is how many notes the duplet holds, not how many it replaces.',
            four: 'Four would divide the beat as simple time does. A compound beat divides into three.',
          },
        }
      : {
          prompt: 'How many beats does the bracketed duplet fill?',
          canonical: 'one',
          distractors: ['two', 'three'],
          whyWrong: {
            two: 'Two is how many notes the duplet holds, not how many beats it fills.',
            three: 'Three is what the beat normally divides into. The duplet still fills that one beat.',
          },
        };

  return {
    id: makeInstanceId('duplet_recognition', grade, idSeed),
    template_id: 'duplet_recognition',
    grade,
    strand: 'rhythm',
    prompt,
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors,
    hints: ['A duplet squeezes two equal notes into a beat that normally holds three of that value.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'A duplet plays two notes in the time of three, filling one compound beat.',
      by_distractor: whyWrong,
    },
    srs_tags: [dupletAtom(sig)],
    kb_version: KB_VERSION,
  };
}

export const dupletRecognition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
