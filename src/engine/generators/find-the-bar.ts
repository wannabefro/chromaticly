// Music in Context — find-the-bar (302.4, design 4c, template "music_in_context").
// A short melodic passage; the learner reads (and hears) it and answers which bar
// holds the highest / lowest / longest note.
//
// The winning bar is chosen FIRST and the passage is then built around it, so the
// answer is true by construction rather than by generate-and-reject: the peak (or
// trough, or long note) is placed in the target bar and every other note is kept
// strictly inside it. That guarantees exactly one correct bar — a tie would make
// the question unanswerable, and the template's rule is that sub-question answers
// are verified programmatically, never hand-waved.

import { KB, KB_VERSION } from '../../content/knowledge-base';
import type { Duration, MusicEvent } from '../../music/types';
import { findBarAtom } from '../atoms';
import { isCompoundTimeSignature } from '../metre';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, renderableTimeSignatures } from '../scope';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

export type BarProperty = 'highest' | 'lowest' | 'longest';

export const BAR_PROPERTIES: readonly BarProperty[] = ['highest', 'lowest', 'longest'];

const PROPERTY_LABEL: Record<BarProperty, string> = {
  highest: 'highest note',
  lowest: 'lowest note',
  longest: 'longest note',
};

/** How the feedback describes the bars that did NOT win. One shared clause read
 *  wrong for two of the three properties ("the others all stay inside it" is only
 *  true of a peak); it went unnoticed because `lowest` was never actually asked. */
const PROPERTY_MISS: Record<BarProperty, string> = {
  highest: 'every other bar stays below it',
  lowest: 'every other bar stays above it',
  longest: 'every other bar holds it for less time',
};

const BARS = 4;

function beatsOf(dur: Duration): number {
  return KB.noteValues[dur].beats_in_crotchets;
}

/** Fill exactly `beats` crotchet beats using only note values no longer than
 *  `maxDur`, so a bar can be built without ever exceeding the winning note. */
function fillBar(rng: () => number, beats: number, maxBeats: number): Duration[] {
  const durs: Duration[] = [];
  let left = beats;
  while (left > 0) {
    const choices: Duration[] = [];
    if (left >= 2 && maxBeats >= 2) choices.push('minim');
    if (left >= 1 && maxBeats >= 1) choices.push('crotchet');
    if (left >= 0.5) choices.push('quaver');
    // Quavers pair up, so only take one when at least a half-beat remains.
    const dur = pick(rng, choices);
    durs.push(dur);
    left -= beatsOf(dur);
  }
  return durs;
}

function build(contentSeed: number, grade: number, idSeed: number, property: BarProperty): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  // Simple time only, so the beat is the crotchet and a bar holds `top` beats.
  // Deferred (D6): grade-2 /2 meters need minim-beat bar math, so this stays
  // the /4 subset at every grade until the time-signatures slice. D13 guard:
  // grade 3 opens compound signatures in renderableTimeSignatures (U2), so
  // filter them out — compound support for this template is a deferred slice.
  const timeSignatures = renderableTimeSignatures(grade).filter((t) => !isCompoundTimeSignature(t));
  const pool = diatonicPitchesInRange('treble', grade); // ascending
  const timeSig = pick(rng, [...timeSignatures]);
  const beatsPerBar = Number(timeSig.split('/')[0]);
  const targetBar = 1 + Math.floor(rng() * BARS);

  // Pitch window. For "highest" the peak sits near the top of the range and every
  // other note is drawn strictly below it; "lowest" is the mirror image. For
  // "longest" pitch doesn't decide the answer, so the whole pool is fair game.
  const peakIndex = pool.length - 1 - Math.floor(rng() * 3); // near the top
  const troughIndex = Math.floor(rng() * 3); // near the bottom

  const winnerPitch = property === 'highest' ? pool[peakIndex] : property === 'lowest' ? pool[troughIndex] : null;
  const otherPitches =
    property === 'highest'
      ? pool.slice(0, peakIndex) // strictly lower than the peak
      : property === 'lowest'
        ? pool.slice(troughIndex + 1) // strictly higher than the trough
        : pool;

  // For "longest", the target bar carries a minim and every other bar is capped at
  // a crotchet, so the long note is unique.
  const winnerDur: Duration = 'minim';
  const otherMaxBeats = property === 'longest' ? 1 : beatsPerBar;

  const events: MusicEvent[] = [];
  // What each bar's own best note is — the per-bar answer to the same question.
  const barBest: Record<number, string> = {};

  for (let bar = 1; bar <= BARS; bar++) {
    const isTarget = bar === targetBar;

    let durs: Duration[];
    if (property === 'longest' && isTarget) {
      durs = [winnerDur, ...fillBar(rng, beatsPerBar - beatsOf(winnerDur), 1)];
    } else {
      durs = fillBar(rng, beatsPerBar, isTarget ? beatsPerBar : otherMaxBeats);
    }

    // Where the winning pitch lands inside the target bar.
    const winnerSlot = Math.floor(rng() * durs.length);

    const barPitches: string[] = [];
    durs.forEach((dur, slot) => {
      const isWinner = isTarget && winnerPitch !== null && slot === winnerSlot;
      const pitch = isWinner ? winnerPitch : pick(rng, otherPitches);
      barPitches.push(pitch);
      events.push({ type: 'note', pitch, dur });
    });
    const byHeight = [...barPitches].sort((a, b) => pool.indexOf(a) - pool.indexOf(b));
    barBest[bar] =
      property === 'highest'
        ? byHeight[byHeight.length - 1]
        : property === 'lowest'
          ? byHeight[0]
          : [...durs].sort((a, b) => beatsOf(b) - beatsOf(a))[0];

    events.push({ type: 'barline', style: bar === BARS ? 'double' : 'single' });
  }

  const label = PROPERTY_LABEL[property];
  const distractors = Array.from({ length: BARS }, (_, i) => i + 1).filter((bar) => bar !== targetBar);

  return {
    id: makeInstanceId('music_in_context', grade, idSeed),
    template_id: 'music_in_context',
    grade,
    strand: 'context',
    prompt: `In which bar does the melody reach its ${label}?`,
    stimulus: { music: { clef: 'treble', key_sig: null, time_sig: timeSig, voices: [{ events }] }, text: null },
    interaction: { type: 'find_the_bar', config: { bars: BARS } },
    answer: { canonical: targetBar, accepted_alternatives: [] },
    distractors,
    hints: [`Take the bars one at a time — and use play to hear the passage.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — compare the bars one by one. Only one bar holds the ${label}; ${PROPERTY_MISS[property]}.`,
      by_distractor: Object.fromEntries(
        distractors.map((bar) => [
          String(bar),
          `Bar ${bar}'s ${label} is ${barBest[bar]}. Bar ${targetBar} holds ${barBest[targetBar]}.`,
        ]),
      ),
    },
    srs_tags: [findBarAtom(property, grade)],
    kb_version: KB_VERSION,
  };
}

/** `music_in_context` at Grade 1 is the find-the-bar task. The property is read
 *  from the lesson's atoms (find_bar:highest|lowest|longest) so a set varies
 *  across them rather than asking the same question eight times. */
export const findTheBar: Generator = (opts: GenerateOptions) => {
  const properties = opts.atoms
    .map((atom) => atom.split(':')[1])
    .filter((p): p is BarProperty => (BAR_PROPERTIES as readonly string[]).includes(p));
  const choices = properties.length > 0 ? properties : BAR_PROPERTIES;
  const property = choices[opts.seed % choices.length];

  return generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, property));
};
