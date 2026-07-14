// Music in Context — the passage runner's content (design 8d).
//
// 4c/8d specify ONE passage per item with several sub-questions asked over it: the
// score stays pinned and only the question area swaps. That inverts the usual
// generator contract — instead of a question that carries its own stimulus, here a
// stimulus carries several questions — so this module builds the passage first and
// then derives every sub-question FROM it. Each sub-question is a perfectly ordinary
// ExerciseInstance sharing the same `stimulus.music`, which is what lets the existing
// interaction registry, option assembly and grading serve them unchanged.
//
// The single-question `music_in_context` generator (find-the-bar) builds its passage
// AROUND one winning bar, so its answer is true by construction. That trick does not
// extend to several questions at once — a passage would have to be simultaneously
// constructed around its highest note, its longest note and its metre. So this one
// builds a passage and then CHECKS it: if the highest note, the lowest note or the
// longest note is not unique, the passage is rejected and the next seed is tried. A
// tie would make a sub-question unanswerable, which is the one thing that must never
// reach a learner.

import { KB, KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, MusicEvent, Pitch } from '../../music/types';
import { contextAtom, findBarAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange } from '../scope';
import { scientificPitchOrdinal } from './pitch-math';
import type { ExerciseInstance } from '../schema';
import { makeInstanceId } from './retry';
import type { GenerateOptions } from './types';

const BARS = 4;
const TIME_SIGNATURES: string[] = ['2/4', '3/4', '4/4'];
const POOL = diatonicPitchesInRange('treble');
const MAX_ATTEMPTS = 64;

export interface ContextPassage {
  music: Music;
  /** The sub-questions asked over this passage, in order. Each is worth one mark. */
  questions: ExerciseInstance[];
}

interface Note {
  pitch: Pitch;
  dur: Duration;
  bar: number;
}

const beatsOf = (dur: Duration): number => KB.noteValues[dur].beats_in_crotchets;

function fillBar(rng: () => number, beats: number): Duration[] {
  const durs: Duration[] = [];
  let left = beats;
  while (left > 0) {
    const choices: Duration[] = [];
    if (left >= 2) choices.push('minim');
    if (left >= 1) choices.push('crotchet');
    if (left >= 0.5) choices.push('quaver');
    const dur = pick(rng, choices);
    durs.push(dur);
    left -= beatsOf(dur);
  }
  return durs;
}

/** The one bar holding the note that is uniquely `pick`-est, or null on a tie. */
function uniqueBarBy(notes: Note[], score: (n: Note) => number): number | null {
  const best = Math.max(...notes.map(score));
  const winners = notes.filter((n) => score(n) === best);
  return winners.length === 1 ? winners[0].bar : null;
}

function uniqueNoteBy(notes: Note[], score: (n: Note) => number): Note | null {
  const best = Math.max(...notes.map(score));
  const winners = notes.filter((n) => score(n) === best);
  return winners.length === 1 ? winners[0] : null;
}

function drawPassage(rng: () => number): { notes: Note[]; timeSig: string; events: MusicEvent[] } {
  const timeSig = pick(rng, TIME_SIGNATURES);
  const beatsPerBar = Number(timeSig.split('/')[0]);
  const notes: Note[] = [];
  const events: MusicEvent[] = [];

  for (let bar = 1; bar <= BARS; bar++) {
    for (const dur of fillBar(rng, beatsPerBar)) {
      const pitch = pick(rng, POOL);
      notes.push({ pitch, dur, bar });
      events.push({ type: 'note', pitch, dur });
    }
    events.push({ type: 'barline', style: bar === BARS ? 'double' : 'single' });
  }

  return { notes, timeSig, events };
}

function barQuestion(
  base: { grade: number; seed: number; music: Music },
  property: 'highest' | 'lowest' | 'longest',
  targetBar: number,
  n: number,
): ExerciseInstance {
  const label = property === 'longest' ? 'longest note' : `${property} note`;
  return {
    id: makeInstanceId(`music_in_context_${property}`, base.grade, base.seed * 10 + n),
    template_id: 'music_in_context',
    grade: base.grade,
    strand: 'context',
    prompt: `In which bar does the melody reach its ${label}?`,
    stimulus: { music: base.music, text: null },
    interaction: { type: 'find_the_bar', config: { bars: BARS } },
    answer: { canonical: targetBar, accepted_alternatives: [] },
    distractors: Array.from({ length: BARS }, (_, i) => i + 1).filter((bar) => bar !== targetBar),
    hints: ['Take the bars one at a time — and use play to hear the passage.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — compare the bars one by one. Only one bar holds the ${label}; the others all stay inside it.`,
    },
    srs_tags: [findBarAtom(property)],
    kb_version: KB_VERSION,
  };
}

/** "Which is the highest note in the passage?" — the same passage, read for pitch
 *  rather than for position. */
function highestNoteQuestion(
  base: { grade: number; seed: number; music: Music },
  highest: Note,
  notes: Note[],
  n: number,
): ExerciseInstance {
  const others = [...new Set(notes.map((x) => x.pitch))].filter((p) => p !== highest.pitch);
  const distractors = others
    .sort((a, b) => scientificPitchOrdinal(b) - scientificPitchOrdinal(a)) // nearest below first
    .slice(0, 3);

  return {
    id: makeInstanceId('music_in_context_highest_note', base.grade, base.seed * 10 + n),
    template_id: 'music_in_context',
    grade: base.grade,
    strand: 'context',
    prompt: 'Which is the highest note in the passage?',
    stimulus: { music: base.music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: highest.pitch, accepted_alternatives: [] },
    distractors,
    hints: ['Find the note that sits highest on the stave — then name it.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — the highest note is the one sitting highest on the stave, whichever bar it is in.',
    },
    srs_tags: [contextAtom('highest_note')],
    kb_version: KB_VERSION,
  };
}

/** A true/false statement about the passage's metre, asked as a two-option pick (the
 *  `true_false` interaction is the per-bar tick/cross control, not a single claim). */
function timeSigQuestion(
  base: { grade: number; seed: number; music: Music },
  timeSig: string,
  rng: () => number,
  n: number,
): ExerciseInstance {
  const claimIsTrue = rng() < 0.5;
  const claimed = claimIsTrue ? timeSig : pick(rng, TIME_SIGNATURES.filter((t) => t !== timeSig));

  return {
    id: makeInstanceId('music_in_context_time_sig', base.grade, base.seed * 10 + n),
    template_id: 'music_in_context',
    grade: base.grade,
    strand: 'context',
    prompt: `True or false: this passage is in ${claimed}.`,
    stimulus: { music: base.music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: claimIsTrue ? 'True' : 'False', accepted_alternatives: [] },
    distractors: [claimIsTrue ? 'False' : 'True'],
    hints: ['Look at the time signature at the start — and count the beats in a bar.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — count the beats in one bar. This passage is in ${timeSig}.`,
    },
    srs_tags: [contextAtom('time_sig')],
    kb_version: KB_VERSION,
  };
}

/** Build one passage and the sub-questions asked over it. Retries the seed until the
 *  passage has a unique highest note, lowest note and longest note — a tie would make
 *  a sub-question unanswerable. */
export function buildContextPassage(opts: GenerateOptions): ContextPassage {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(opts.seed * 1000 + attempt);
    const { notes, timeSig, events } = drawPassage(rng);

    const ord = (n: Note) => scientificPitchOrdinal(n.pitch);
    const highestBar = uniqueBarBy(notes, ord);
    const lowestBar = uniqueBarBy(notes, (n) => -ord(n));
    const longestBar = uniqueBarBy(notes, (n) => beatsOf(n.dur));
    const highestNote = uniqueNoteBy(notes, ord);

    if (highestBar === null || lowestBar === null || longestBar === null || highestNote === null) continue;

    const music: Music = { clef: 'treble', key_sig: null, time_sig: timeSig, voices: [{ events }] };
    const base = { grade: opts.grade, seed: opts.seed, music };

    return {
      music,
      questions: [
        barQuestion(base, 'highest', highestBar, 1),
        highestNoteQuestion(base, highestNote, notes, 2),
        timeSigQuestion(base, timeSig, rng, 3),
        barQuestion(base, 'longest', longestBar, 4),
      ],
    };
  }

  throw new Error(`music in context: no passage without a tie after ${MAX_ATTEMPTS} attempts (seed ${opts.seed})`);
}
