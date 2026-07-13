// Theory-in-sound rhythms (302.3.5, design 4b). The by-ear card plays a short
// rhythm and asks the learner to tap the strong beats they hear, so its material
// must be a metrically valid excerpt — which the exercise generators deliberately
// are not (bar_validity emits invalid bars on purpose; add_time_signature emits a
// single bar that may be one long note). Teach rhythms are therefore authored in
// the lesson content and turned into Music here.
//
// Simple time only (Grade 1: 2/4, 3/4, 4/4): the beat is the crotchet, the
// numerator is the beats per bar, and the strong beat is the first of each bar.

import type { Duration, Music, MusicEvent } from '../music/types';
import { KB } from './knowledge-base';

/** An authored rhythm: a time signature and a flat run of note values that fills
 *  whole bars. Note values are written as they're spoken — "crotchet",
 *  "dotted minim". */
export interface TeachRhythm {
  timeSignature: string;
  notes: string[];
}

/** One metrical beat of the excerpt. `strong` marks the downbeat — the beat the
 *  by-ear card asks the learner to find. */
export interface BeatCell {
  bar: number;
  beat: number;
  strong: boolean;
}

/** Rhythm-only notation sits on a single stave line by convention. */
const RHYTHM_PITCH = 'B4';

/** The note values Grade 1 knows. The knowledge base is wider than the grade (it
 *  carries breve, demisemiquaver…), so accepting anything in `KB.noteValues` would
 *  let a teach rhythm play material the learner has never been taught. */
const GRADE1_DURATIONS: readonly Duration[] = ['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver'];

export function parseNoteValue(name: string): { dur: Duration; dots: 0 | 1 } {
  const dotted = name.startsWith('dotted ');
  const dur = (dotted ? name.slice('dotted '.length) : name) as Duration;
  if (!(dur in KB.noteValues)) throw new Error(`teach rhythm: unknown note value "${name}"`);
  if (!GRADE1_DURATIONS.includes(dur)) {
    throw new Error(`teach rhythm: "${name}" is outside the Grade 1 note values`);
  }
  return { dur, dots: dotted ? 1 : 0 };
}

function beatsOf(name: string): number {
  const { dur, dots } = parseNoteValue(name);
  const base = KB.noteValues[dur].beats_in_crotchets;
  return dots === 1 ? base * 1.5 : base;
}

/** Beats per bar. Simple time only — the numerator is the count of crotchet beats. */
export function beatsPerBar(timeSignature: string): number {
  const [top, bottom] = timeSignature.split('/');
  const beats = Number(top);
  if (bottom !== '4' || !Number.isInteger(beats) || beats < 2 || beats > 4) {
    throw new Error(`teach rhythm: "${timeSignature}" is not a Grade 1 simple time signature`);
  }
  return beats;
}

/** Total crotchet beats in the excerpt. */
export function rhythmBeats(rhythm: TeachRhythm): number {
  return rhythm.notes.reduce((total, name) => total + beatsOf(name), 0);
}

/** Fail loud on a rhythm that doesn't fill whole bars — a half-filled bar would
 *  play as nonsense and its beat grid would be a lie.
 *
 *  A correct total is not sufficient: a note may not straddle a barline either.
 *  Three minims in 3/4 total 6 beats (two bars' worth) yet the first bar would
 *  hold four beats, so `rhythmToMusic` would bar it wrong and the beat grid the
 *  learner taps would not match what they hear. */
export function assertRhythmFillsBars(rhythm: TeachRhythm): void {
  const perBar = beatsPerBar(rhythm.timeSignature);
  const total = rhythmBeats(rhythm);
  if (total === 0 || total % perBar !== 0) {
    throw new Error(
      `teach rhythm: ${total} beats does not fill whole bars of ${rhythm.timeSignature} (${perBar} per bar)`,
    );
  }

  let filled = 0;
  for (const name of rhythm.notes) {
    const start = filled;
    filled += beatsOf(name);
    if (Math.floor(start / perBar) !== Math.ceil(filled / perBar) - 1) {
      throw new Error(
        `teach rhythm: "${name}" straddles a barline of ${rhythm.timeSignature} (starts at beat ${start % perBar + 1})`,
      );
    }
  }
}

/** The metrical grid the learner taps: every beat of every bar, with the downbeat
 *  of each bar marked strong. */
export function beatGrid(rhythm: TeachRhythm): BeatCell[] {
  assertRhythmFillsBars(rhythm);
  const perBar = beatsPerBar(rhythm.timeSignature);
  const bars = rhythmBeats(rhythm) / perBar;
  const cells: BeatCell[] = [];
  for (let bar = 1; bar <= bars; bar++) {
    for (let beat = 1; beat <= perBar; beat++) {
      cells.push({ bar, beat, strong: beat === 1 });
    }
  }
  return cells;
}

/** Render the authored rhythm as Music (single pitch — it's rhythm, not pitch),
 *  inserting a barline every full bar so it plays and renders with the right metre. */
export function rhythmToMusic(rhythm: TeachRhythm): Music {
  assertRhythmFillsBars(rhythm);
  const perBar = beatsPerBar(rhythm.timeSignature);
  const events: MusicEvent[] = [];
  let filled = 0;

  for (const name of rhythm.notes) {
    const { dur, dots } = parseNoteValue(name);
    events.push({ type: 'note', pitch: RHYTHM_PITCH, dur, ...(dots === 1 ? { dots: 1 as const } : {}) });
    filled += beatsOf(name);
    if (filled % perBar === 0) events.push({ type: 'barline', style: 'single' });
  }

  return {
    clef: 'treble',
    key_sig: null,
    time_sig: rhythm.timeSignature,
    voices: [{ events }],
  };
}
