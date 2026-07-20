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
import { DYNAMIC_GLOSS } from '../../music/dynamics';
import type { Duration, Dynamic, Music, MusicEvent, Pitch } from '../../music/types';
import { contextAtom, findBarAtom } from '../atoms';
import { isCompoundTimeSignature } from '../metre';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, renderableTimeSignatures } from '../scope';
import { scientificPitchOrdinal } from './pitch-math';
import type { ExerciseInstance } from '../schema';
import { makeInstanceId } from './retry';
import type { GenerateOptions } from './types';

const BARS = 4;
const MAX_ATTEMPTS = 64;

// Grade 1 dynamics (ABRSM): only p, mf, f are taught, so the answer is always one of
// these. mp joins the option set as a near distractor — the four meanings are distinct.
const G1_DYNAMICS: Dynamic[] = ['p', 'mf', 'f'];
const DYNAMIC_OPTIONS: Dynamic[] = ['p', 'mp', 'mf', 'f'];

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

/** Deferred (D6): grade-2 /2 meters need minim-beat bar math, so `grade`
 *  narrows the meter to the /4 subset at every grade until the
 *  time-signatures slice — see renderableTimeSignatures. D13 guard: grade 3
 *  opens compound signatures in renderableTimeSignatures (U2), so filter
 *  them out here too — compound support for this template is a deferred
 *  slice. */
function drawPassage(rng: () => number, grade: number): { notes: Note[]; timeSig: string; events: MusicEvent[] } {
  const timeSignatures = renderableTimeSignatures(grade).filter((t) => !isCompoundTimeSignature(t));
  const pool = diatonicPitchesInRange('treble', grade);
  const timeSig = pick(rng, [...timeSignatures]);
  const beatsPerBar = Number(timeSig.split('/')[0]);
  const notes: Note[] = [];
  const events: MusicEvent[] = [];

  for (let bar = 1; bar <= BARS; bar++) {
    for (const dur of fillBar(rng, beatsPerBar)) {
      const pitch = pick(rng, pool);
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

/** Insert a dynamic before the first note of `targetBar` — the marking the "term in
 *  context" sub-question asks about. Placed before a note (never a barline), so the ABC
 *  emitter's fail-loud guard is satisfied by construction. Exactly one dynamic per
 *  passage, so "the marking in bar N" is unambiguous. */
function injectDynamic(events: MusicEvent[], targetBar: number, mark: Dynamic): MusicEvent[] {
  const out: MusicEvent[] = [];
  let bar = 1;
  let injected = false;
  for (const ev of events) {
    if (!injected && bar === targetBar && ev.type === 'note') {
      out.push({ type: 'dynamic', mark });
      injected = true;
    }
    out.push(ev);
    if (ev.type === 'barline') bar += 1;
  }
  return out;
}

/** "What does the 𝆑 in bar N mean?" — the dynamic is read straight off the pinned score
 *  (design 8d, Q3). The answer is the marking's plain meaning; the distractors are the
 *  meanings of the other Grade-1 dynamics, so the learner must read the actual glyph. */
function termQuestion(
  base: { grade: number; seed: number; music: Music },
  mark: Dynamic,
  bar: number,
  n: number,
): ExerciseInstance {
  const gloss = DYNAMIC_GLOSS[mark];
  const distractors = DYNAMIC_OPTIONS.filter((m) => m !== mark).map((m) => DYNAMIC_GLOSS[m].meaning);

  return {
    id: makeInstanceId('music_in_context_term', base.grade, base.seed * 10 + n),
    template_id: 'music_in_context',
    grade: base.grade,
    strand: 'context',
    prompt: `What does the dynamic marking in bar ${bar} mean?`,
    stimulus: { music: base.music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: gloss.meaning, accepted_alternatives: [] },
    distractors,
    hints: [`Find the marking below the stave in bar ${bar} — it tells you how loud to play.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — ${gloss.italian} (${mark}) means “${gloss.meaning}”.`,
    },
    srs_tags: [contextAtom('dynamic_term')],
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
  // D13 guard: this claim/distractor option must never offer a compound
  // signature — the passage itself is always simple-only (drawPassage), so a
  // compound distractor here would be an option no rendered passage could
  // ever confirm. Compound support for this template is a deferred slice.
  const timeSignatures = renderableTimeSignatures(base.grade).filter((t) => !isCompoundTimeSignature(t));
  const claimed = claimIsTrue ? timeSig : pick(rng, timeSignatures.filter((t) => t !== timeSig));

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
    const { notes, timeSig, events } = drawPassage(rng, opts.grade);

    const ord = (n: Note) => scientificPitchOrdinal(n.pitch);
    const highestBar = uniqueBarBy(notes, ord);
    const lowestBar = uniqueBarBy(notes, (n) => -ord(n));
    const longestBar = uniqueBarBy(notes, (n) => beatsOf(n.dur));
    const highestNote = uniqueNoteBy(notes, ord);

    if (highestBar === null || lowestBar === null || longestBar === null || highestNote === null) continue;

    // Add one dynamic for the term-in-context sub-question. It is additive — a dynamic
    // event changes no note — so the pitch/metre/bar answers computed above stay valid.
    const termBar = 1 + Math.floor(rng() * BARS);
    const termMark = pick(rng, G1_DYNAMICS);
    const eventsWithDynamic = injectDynamic(events, termBar, termMark);

    const music: Music = { clef: 'treble', key_sig: null, time_sig: timeSig, voices: [{ events: eventsWithDynamic }] };
    const base = { grade: opts.grade, seed: opts.seed, music };

    // Sub-question order follows design 8d: find-the-bar, highest/lowest, term-in-context,
    // true/false, find-the-bar (second target).
    return {
      music,
      questions: [
        barQuestion(base, 'highest', highestBar, 1),
        highestNoteQuestion(base, highestNote, notes, 2),
        termQuestion(base, termMark, termBar, 3),
        timeSigQuestion(base, timeSig, rng, 4),
        barQuestion(base, 'longest', longestBar, 5),
      ],
    };
  }

  throw new Error(`music in context: no passage without a tie after ${MAX_ATTEMPTS} attempts (seed ${opts.seed})`);
}
