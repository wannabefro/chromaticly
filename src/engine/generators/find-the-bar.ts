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
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange } from '../scope';
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

const BARS = 4;

/** Simple time only, so the beat is the crotchet and a bar holds `top` beats. */
const TIME_SIGNATURES: string[] = ['2/4', '3/4', '4/4'];

const POOL = diatonicPitchesInRange('treble'); // ascending

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
  const timeSig = pick(rng, TIME_SIGNATURES);
  const beatsPerBar = Number(timeSig.split('/')[0]);
  const targetBar = 1 + Math.floor(rng() * BARS);

  // Pitch window. For "highest" the peak sits near the top of the range and every
  // other note is drawn strictly below it; "lowest" is the mirror image. For
  // "longest" pitch doesn't decide the answer, so the whole pool is fair game.
  const peakIndex = POOL.length - 1 - Math.floor(rng() * 3); // near the top
  const troughIndex = Math.floor(rng() * 3); // near the bottom

  const winnerPitch = property === 'highest' ? POOL[peakIndex] : property === 'lowest' ? POOL[troughIndex] : null;
  const otherPitches =
    property === 'highest'
      ? POOL.slice(0, peakIndex) // strictly lower than the peak
      : property === 'lowest'
        ? POOL.slice(troughIndex + 1) // strictly higher than the trough
        : POOL;

  // For "longest", the target bar carries a minim and every other bar is capped at
  // a crotchet, so the long note is unique.
  const winnerDur: Duration = 'minim';
  const otherMaxBeats = property === 'longest' ? 1 : beatsPerBar;

  const events: MusicEvent[] = [];

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

    durs.forEach((dur, slot) => {
      const isWinner = isTarget && winnerPitch !== null && slot === winnerSlot;
      const pitch = isWinner ? winnerPitch : pick(rng, otherPitches);
      events.push({ type: 'note', pitch, dur });
    });

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
      incorrect: `Not quite — compare the bars one by one. Only one bar holds the ${label}; the others all stay inside it.`,
    },
    srs_tags: [findBarAtom(property)],
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
