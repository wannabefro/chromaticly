// Grade 2 triplet_recognition generator (chromaticly-e3z.9). The syllabus names
// "triplets and triplet groups with rests" at Grade 2, and the course had no
// Grade 2 rhythm content at all.
//
// A triplet is three notes in the time of two of the same written value, filling
// one SIMPLE beat. The beat value follows the denominator: a minim in /2, a
// crotchet in /4, a quaver in /8 — so the same 3-in-2 rule is met in every
// metre the grade reads, not memorised as "three quavers".
//
// The rest form is a separate atom. Once a rest joins the group the notes stop
// being countable, and a learner who reads a plain triplet often cannot read
// that one — different skill, different atom (KTD9).

import { KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, MusicEvent, Pitch } from '../../music/types';
import { parseAtom, tripletAtom } from '../atoms';
import { musicEventUnits } from '../music-event-units';
import { isCompoundTimeSignature } from '../metre';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { barUnitsFor } from './bar-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Beat and triplet value, by denominator. The triplet divides the BEAT. */
const BY_DENOMINATOR: Record<number, { beat: Duration; note: Duration; units: number }> = {
  2: { beat: 'minim', note: 'crotchet', units: 16 },
  4: { beat: 'crotchet', note: 'quaver', units: 8 },
  8: { beat: 'quaver', note: 'semiquaver', units: 4 },
};

const NAMES: Record<Duration, string> = {
  breve: 'breve',
  semibreve: 'semibreve',
  minim: 'minim',
  crotchet: 'crotchet',
  quaver: 'quaver',
  semiquaver: 'semiquaver',
  demisemiquaver: 'demisemiquaver',
};

interface Draw {
  sig: string;
  withRest: boolean;
}

/** The atom-named signatures, split by whether the group carries a rest. */
function drawsFromAtoms(atoms: string[]): Draw[] {
  const draws: Draw[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if ((kind !== 'triplet' && kind !== 'triplet_rest') || parts.length !== 1) continue;
    const draw = { sig: parts[0], withRest: kind === 'triplet_rest' };
    if (!draws.some((d) => d.sig === draw.sig && d.withRest === draw.withRest)) draws.push(draw);
  }
  if (draws.length === 0) {
    throw new Error('triplet_recognition: needs at least one triplet:<sig> or triplet_rest:<sig> atom');
  }
  return draws;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const { sig, withRest } = pick(rng, drawsFromAtoms(atoms));
  if (isCompoundTimeSignature(sig)) {
    throw new Error(`triplet_recognition: "${sig}" is compound — a triplet divides a simple beat`);
  }
  const shape = BY_DENOMINATOR[Number(sig.split('/')[1])];
  if (!shape) throw new Error(`triplet_recognition: no triplet shape for "${sig}"`);
  const beats = barUnitsFor(sig) / shape.units;

  const clef = pick(rng, [...scope.clefs]);
  const range = diatonicPitchesInComfortableRange(clef, grade);
  const a: Pitch = pick(rng, range);
  const b: Pitch = pick(rng, range);
  const tripletBeat = pick(rng, Array.from({ length: beats }, (_, i) => i));
  // Never the first: a group that opens on a rest hides the bracket it belongs to.
  const restAt = withRest ? pick(rng, [1, 2]) : -1;

  const events: MusicEvent[] = [];
  for (let beat = 0; beat < beats; beat++) {
    if (beat !== tripletBeat) {
      events.push({ type: 'note', pitch: a, dur: shape.beat });
      continue;
    }
    for (let i = 0; i < 3; i++) {
      const tuplet = { size: 3, inTimeOf: 2, ...(i === 0 ? { start: true } : {}) };
      events.push(
        i === restAt
          ? { type: 'rest', dur: shape.note, tuplet }
          : { type: 'note', pitch: i === 0 ? a : b, dur: shape.note, tuplet },
      );
    }
  }

  // A third of a beat is not an exact binary fraction. Compare loosely.
  const total = events.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
  if (Math.abs(total - beats * shape.units) > 1e-9) {
    throw new Error(`triplet_recognition: bar sums to ${total}, expected ${beats * shape.units}`);
  }

  const music: Music = { clef, key_sig: null, time_sig: sig, voices: [{ events }] };
  const noteName = NAMES[shape.note];
  const beatName = NAMES[shape.beat];

  const variant = withRest ? pick(rng, ['sounding', 'places'] as const) : pick(rng, ['ratio', 'beat'] as const);

  if (variant === 'ratio') {
    return {
      id: makeInstanceId('triplet_recognition', grade, idSeed),
      template_id: 'triplet_recognition',
      grade,
      strand: 'rhythm',
      prompt: `The bracketed notes are a triplet. Three ${noteName}s are played in the time of how many?`,
      stimulus: { music, text: null },
      interaction: { type: 'mcq', config: {} },
      answer: { canonical: 'two', accepted_alternatives: [] },
      distractors: ['three', 'four'],
      hints: [`The group fills one ${beatName} beat, and a ${beatName} normally holds two ${noteName}s.`],
      feedback: {
        correct: 'Correct!',
        incorrect: `A triplet fills one beat. This beat is a ${beatName}, which normally holds two ${noteName}s.`,
        by_distractor: {
          three: 'Three is how many notes are in the bracket. The question asks what they REPLACE.',
          four: `Four ${noteName}s would fill two ${beatName} beats. The bracket sits inside one.`,
        },
      },
      srs_tags: [tripletAtom(sig, false)],
      kb_version: KB_VERSION,
    };
  }

  if (variant === 'beat') {
    return {
      id: makeInstanceId('triplet_recognition', grade, idSeed),
      template_id: 'triplet_recognition',
      grade,
      strand: 'rhythm',
      prompt: 'How many beats does the bracketed triplet fill?',
      stimulus: { music, text: null },
      interaction: { type: 'mcq', config: {} },
      answer: { canonical: 'one', accepted_alternatives: [] },
      distractors: ['two', 'three'],
      hints: ['Count the beats the other notes take, then see what is left for the bracket.'],
      feedback: {
        correct: 'Correct!',
        incorrect: `The three ${noteName}s share one ${beatName} beat between them.`,
        by_distractor: {
          two: `Two ${beatName} beats would hold six of these, not three.`,
          three: 'Three is the number of notes in the group, not the number of beats it fills.',
        },
      },
      srs_tags: [tripletAtom(sig, false)],
      kb_version: KB_VERSION,
    };
  }

  if (variant === 'places') {
    return {
      id: makeInstanceId('triplet_recognition', grade, idSeed),
      template_id: 'triplet_recognition',
      grade,
      strand: 'rhythm',
      prompt: 'A rest sits inside this triplet. How long does the whole bracketed group last?',
      stimulus: { music, text: null },
      interaction: { type: 'mcq', config: {} },
      answer: { canonical: `one ${beatName}`, accepted_alternatives: [] },
      distractors: [`two ${noteName}s`, `two ${beatName}s`],
      hints: ['A rest takes up time exactly as a note does. The group is still a triplet.'],
      feedback: {
        correct: 'Correct!',
        incorrect: `The rest fills its place in the group, so the triplet still lasts one ${beatName}.`,
        by_distractor: {
          [`two ${noteName}s`]: `That is what two of the three places last. The third one counts too, rest or not.`,
          [`two ${beatName}s`]: `A triplet fills one beat, not two. The rest does not add time, it fills a place.`,
        },
      },
      srs_tags: [tripletAtom(sig, true)],
      kb_version: KB_VERSION,
    };
  }

  return {
    id: makeInstanceId('triplet_recognition', grade, idSeed),
    template_id: 'triplet_recognition',
    grade,
    strand: 'rhythm',
    prompt: 'The bracket holds a triplet with a rest in it. How many notes sound?',
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: 'two', accepted_alternatives: [] },
    distractors: ['one', 'three'],
    hints: ['The bracket still covers three places. Count only the ones that are not rests.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `The triplet still fills one ${beatName} beat in three places, but one of them is a rest.`,
      by_distractor: {
        one: 'Only one place in the group is a rest. The other two are notes.',
        three: 'Three is how many places the bracket covers. One of them is silent.',
      },
    },
    srs_tags: [tripletAtom(sig, true)],
    kb_version: KB_VERSION,
  };
}

export const tripletRecognition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
