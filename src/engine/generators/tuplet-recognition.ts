// Grade 5 tuplet_recognition generator (chromaticly-e3z.6) — "irregular
// divisions of simple time values", the second half of the syllabus's Grade 5
// item 1. Mirrors duplet-recognition.ts, inverted: a duplet squeezes 2 into a
// COMPOUND beat that holds 3, while these squeeze 5, 6 or 7 into a SIMPLE beat
// that holds 4.
//
// The bracket number is the whole skill, so the exercise renders a simple-time
// bar with one beat divided irregularly and asks what the bracket means. The
// stimulus is drawn from the four-semiquaver beat rather than a two-quaver one:
// the "in the time of" answer is 4 for a quintuplet, sextuplet and septuplet
// alike, which is what makes the group a division of the BEAT rather than of
// the note the learner happens to see.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Music, MusicEvent, Pitch } from '../../music/types';
import { parseAtom, tupletAtom } from '../atoms';
import { musicEventUnits } from '../music-event-units';
import { isCompoundTimeSignature, isIrregularTimeSignature } from '../metre';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { barUnitsFor } from './bar-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** The tuplet sizes the atoms name (tuplet:<size>). */
function tupletSizesFromAtoms(atoms: string[]): number[] {
  const sizes: number[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'tuplet' || parts.length !== 1) continue;
    const size = Number(parts[0]);
    if (TUPLET_SIZES.includes(size) && !sizes.includes(size)) sizes.push(size);
  }
  if (sizes.length === 0) {
    throw new Error('tuplet_recognition: needs at least one tuplet:<size> atom');
  }
  return sizes;
}

/** Quintuplet, sextuplet, septuplet — the irregular divisions of a simple beat.
 *  The triplet is not here: it is a Grade 2 device and divides the beat into 3
 *  against 2, not against 4. */
export const TUPLET_SIZES: readonly number[] = [5, 6, 7];

const TUPLET_NAMES: Record<number, string> = { 5: 'quintuplet', 6: 'sextuplet', 7: 'septuplet' };

/** A crotchet beat is 8 demisemiquaver-units, i.e. four semiquavers. */
const BEAT_UNITS = 8;
const NOTES_PER_BEAT = 4;

/** The simple /4 metres this exercise draws its bar from — a crotchet beat that
 *  normally holds four semiquavers is what the tuplet displaces. */
function simpleQuarterMetres(timeSignatures: readonly string[]): string[] {
  return timeSignatures.filter(
    (sig) => sig.endsWith('/4') && !isCompoundTimeSignature(sig) && !isIrregularTimeSignature(sig),
  );
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const size = pick(rng, tupletSizesFromAtoms(atoms));
  const sig = pick(rng, simpleQuarterMetres(scope.timeSignatures));
  const beats = barUnitsFor(sig) / BEAT_UNITS;

  const clef = pick(rng, [...scope.clefs]);
  const range = diatonicPitchesInComfortableRange(clef, grade);
  // The tuplet runs stepwise rather than alternating two drawn pitches. Seven
  // notes zigzagging over two octaves are hard to read as one group, and the
  // group is the thing being counted.
  const start = pick(
    rng,
    Array.from({ length: Math.max(1, range.length - size) }, (_, i) => i),
  );
  const run: Pitch[] = Array.from({ length: size }, (_, i) => range[(start + i) % range.length]);
  const a: Pitch = range[start];
  const tupletBeat = pick(
    rng,
    Array.from({ length: beats }, (_, i) => i),
  );

  const events: MusicEvent[] = [];
  for (let beat = 0; beat < beats; beat++) {
    if (beat === tupletBeat) {
      for (let i = 0; i < size; i++) {
        events.push({
          type: 'note',
          pitch: run[i],
          dur: 'semiquaver',
          tuplet: { size, inTimeOf: NOTES_PER_BEAT, ...(i === 0 ? { start: true } : {}) },
        });
      }
    } else {
      events.push({ type: 'note', pitch: a, dur: 'crotchet' });
    }
  }

  // The tuplet fills its beat exactly, whatever its size — that is what makes it
  // a division of the beat. Assert here so a construction slip fails at
  // generation rather than as a short bar on device.
  const total = events.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
  if (total !== beats * BEAT_UNITS) {
    throw new Error(`tuplet_recognition: bar sums to ${total}, expected ${beats * BEAT_UNITS}`);
  }

  const music: Music = { clef, key_sig: null, time_sig: sig, voices: [{ events }] };
  const name = TUPLET_NAMES[size];

  const variant = pick(rng, ['ratio', 'name'] as const);
  if (variant === 'ratio') {
    const wrong = `${size === 5 ? 'six' : 'five'}`;
    return {
      id: makeInstanceId('tuplet_recognition', grade, idSeed),
      template_id: 'tuplet_recognition',
      grade,
      strand: 'rhythm',
      prompt: `The bracketed notes are a ${name}. ${size} notes are played in the time of how many?`,
      stimulus: { music, text: null },
      interaction: { type: 'mcq', config: {} },
      answer: { canonical: 'four', accepted_alternatives: [] },
      // The two real errors: reading the bracket number as the answer, and
      // borrowing the triplet's 3-in-2 relationship.
      distractors: [`${size}` === '6' ? 'three' : wrong, 'two'],
      hints: [
        'The bracket says how many notes are squeezed in. What they replace is a full beat — count the notes of that value one beat normally holds.',
      ],
      feedback: {
        correct: 'Correct!',
        incorrect: `A ${name} fills one beat. That beat normally holds four semiquavers, so ${size} are played in the time of four.`,
        by_distractor: {
          [`${size}` === '6' ? 'three' : wrong]:
            'That is how many notes are in the bracket, or near it. The question asks what they REPLACE — one beat of four semiquavers.',
          two: 'Two in the time of three is the duplet, and three in the time of two is the triplet. This group replaces a whole beat of four.',
        },
      },
      srs_tags: [tupletAtom(size)],
      kb_version: KB_VERSION,
    };
  }

  const others = TUPLET_SIZES.filter((s) => s !== size).map((s) => TUPLET_NAMES[s]);
  return {
    id: makeInstanceId('tuplet_recognition', grade, idSeed),
    template_id: 'tuplet_recognition',
    grade,
    strand: 'rhythm',
    prompt: 'What is the bracketed group called?',
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: name, accepted_alternatives: [] },
    distractors: others,
    hints: ['Count the notes inside the bracket. The name comes from that number, not from the beat it fills.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `Count the notes under the bracket: there are ${size}, which makes it a ${name}.`,
      by_distractor: Object.fromEntries(
        others.map((other) => [
          other,
          `A ${other} has a different number of notes. Count what is under the bracket — there are ${size}.`,
        ]),
      ),
    },
    srs_tags: [tupletAtom(size)],
    kb_version: KB_VERSION,
  };
}

export const tupletRecognition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
