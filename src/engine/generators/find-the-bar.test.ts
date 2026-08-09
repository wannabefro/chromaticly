// 302.4 find-the-bar. The template's rule is that a sub-question's answer must be
// verified against the generated score programmatically, never hand-waved — so
// these tests re-derive the answer from the notes themselves. A tie would make the
// question unanswerable, so uniqueness of the winning bar is the core invariant.

import { isCompoundTimeSignature } from '../metre';
import type { MusicEvent, NoteEvent } from '../../music/types';
import { validate } from '../validator';
import { BAR_PROPERTIES, findTheBar, type BarProperty } from './find-the-bar';

const PITCH_ORDER = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5'];
const BEATS: Record<string, number> = { semibreve: 4, minim: 2, crotchet: 1, quaver: 0.5, semiquaver: 0.25 };

/** Split a voice's events into bars of notes. */
function bars(events: MusicEvent[]): NoteEvent[][] {
  const out: NoteEvent[][] = [];
  let current: NoteEvent[] = [];
  for (const ev of events) {
    if (ev.type === 'barline') {
      out.push(current);
      current = [];
    } else if (ev.type === 'note') {
      current.push(ev);
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

function instanceFor(property: BarProperty, seed: number) {
  return findTheBar({ grade: 1, seed, atoms: [`find_bar:${property}`] });
}

describe('findTheBar — the winning bar is unique and is the one the answer names', () => {
  test.each(BAR_PROPERTIES)('the %s note sits in exactly one bar, and that bar is the canonical answer', (property) => {
    for (let seed = 0; seed < 120; seed++) {
      const instance = instanceFor(property, seed);
      const grouped = bars(instance.stimulus.music!.voices[0].events);

      // Score each bar by the property under test.
      const score = (notes: NoteEvent[]) => {
        if (property === 'longest') return Math.max(...notes.map((n) => BEATS[n.dur]));
        const indices = notes.map((n) => PITCH_ORDER.indexOf(n.pitch));
        return property === 'highest' ? Math.max(...indices) : -Math.min(...indices);
      };

      const scores = grouped.map(score);
      const best = Math.max(...scores);
      const winners = scores.filter((s) => s === best);

      expect(winners).toHaveLength(1); // no tie — the question must be answerable
      expect(scores.indexOf(best) + 1).toBe(instance.answer.canonical);
    }
  });
});

describe('findTheBar — the passage is well formed', () => {
  test('every bar fills its time signature exactly', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = instanceFor(BAR_PROPERTIES[seed % BAR_PROPERTIES.length], seed);
      const music = instance.stimulus.music!;
      const beatsPerBar = Number(music.time_sig!.split('/')[0]);
      for (const notes of bars(music.voices[0].events)) {
        const total = notes.reduce((sum, n) => sum + BEATS[n.dur], 0);
        expect(total).toBeCloseTo(beatsPerBar, 6);
      }
    }
  });

  test('the distractors are the other bars, so every bar is offerable', () => {
    const instance = instanceFor('highest', 4);
    const all = [instance.answer.canonical as number, ...(instance.distractors as number[])].sort();
    expect(all).toEqual([1, 2, 3, 4]);
  });

  test('the atom records which property was asked', () => {
    expect(instanceFor('lowest', 0).srs_tags).toEqual(['find_bar:lowest']);
  });

  test('D13 guard: grade-3 generation never emits a compound signature (compound support for this template is a deferred slice)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = findTheBar({ grade: 3, seed, atoms: [`find_bar:highest`] });
      const timeSig = instance.stimulus.music!.time_sig as string;
      expect(isCompoundTimeSignature(timeSig)).toBe(false);
    }
  });

  test('seeds 0..49 are all validator-clean and reproducible', () => {
    for (let seed = 0; seed < 50; seed++) {
      const instance = instanceFor('highest', seed);
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
      expect(findTheBar({ grade: 1, seed, atoms: ['find_bar:highest'] })).toEqual(instance);
    }
  });
});

// chromaticly-302.27. The generator builds its winner true-by-construction, so
// the suite proved nothing about the validator. These tamper the score.
describe('the validator hook recomputes the winning bar', () => {
  const ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const ordinal = (pitch: string) => Number(pitch.slice(-1)) * 7 + ORDER.indexOf(pitch[0]);

  test('a moved answer is rejected', () => {
    const inst = instanceFor('highest', 3);
    const moved = JSON.parse(JSON.stringify(inst));
    moved.answer.canonical = (inst.answer.canonical as number) === 1 ? 2 : 1;
    expect(validate(moved).errors.some((e) => e.includes('holds the highest note'))).toBe(true);
  });

  test('a tie is rejected — two winning bars make the question unanswerable', () => {
    const inst = instanceFor('highest', 3);
    const tied = JSON.parse(JSON.stringify(inst));
    const events = tied.stimulus.music.voices[0].events as MusicEvent[];
    const notes = events.filter((e) => e.type === 'note') as NoteEvent[];
    const top = notes.map((n) => n.pitch).sort((a, b) => ordinal(a) - ordinal(b)).pop()!;
    (events[events.findIndex((e) => e.type === 'note')] as NoteEvent).pitch = top;
    expect(validate(tied).errors.some((e) => e.includes('tie on the highest note'))).toBe(true);
  });

  test('a duplicated distractor is rejected', () => {
    const inst = instanceFor('longest', 5);
    const dupe = JSON.parse(JSON.stringify(inst));
    dupe.distractors = [...dupe.distractors, dupe.answer.canonical];
    expect(validate(dupe).errors.some((e) => e.includes('also appears among the distractors'))).toBe(true);
  });
});

// chromaticly-e3o. Every note used to be `pick(rng, pool)` over the whole treble
// range, which is not a melody: measured over 180 grade-2 passages the median
// adjacent interval was a perfect 4th, 23% of intervals were a 6th or wider, and
// the widest was 16 semitones. "Which bar reaches the highest note" was then a
// spot-the-outlier puzzle rather than a reading task.
//
// These pin the SHAPE, not the notes, so they survive a re-seed. A revert to
// uniform picking fails every one of them.
describe('findTheBar — the passage reads as a melody, not as random pitches', () => {
  const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const semitones = (p: string) => SEMITONE[p[0]] + 12 * Number(p.slice(-1));

  /** Every adjacent interval across many passages, in semitones. */
  function intervals(property: BarProperty): number[] {
    const out: number[] = [];
    for (let seed = 0; seed < 60; seed++) {
      const notes = instanceFor(property, seed).stimulus.music!.voices[0].events.filter(
        (e: MusicEvent): e is NoteEvent => e.type === 'note',
      );
      for (let i = 1; i < notes.length; i++) out.push(Math.abs(semitones(notes[i].pitch) - semitones(notes[i - 1].pitch)));
    }
    return out;
  }

  test.each(BAR_PROPERTIES)('%s: most motion is stepwise', (property) => {
    const iv = intervals(property);
    const stepwise = iv.filter((x) => x <= 2).length / iv.length;
    // Uniform picking scored 0.29 here. Real melodic writing is nearer 0.65.
    expect(stepwise).toBeGreaterThan(0.5);
  });

  // `longest` has no forced peak, so its line is free to be stepwise throughout.
  // `highest` and `lowest` must plant one note clear of every other and the
  // approach to it is a leap by construction, so they get a stated allowance
  // rather than one engineered away — a climax reached by leap is ordinary
  // writing. Uniform picking scored 0.23 on all three: one interval in four.
  test.each(BAR_PROPERTIES)('%s: wide leaps are rare', (property) => {
    const iv = intervals(property);
    const wide = iv.filter((x) => x >= 9).length / iv.length;
    expect(wide).toBeLessThan(property === 'longest' ? 0.05 : 0.11);
  });

  // The boundary itself, not a value near it: one interval this size means the
  // line left the stave and came back, which is what looked broken on device.
  test.each(BAR_PROPERTIES)('%s: no interval exceeds a fifteenth', (property) => {
    expect(Math.max(...intervals(property))).toBeLessThanOrEqual(24);
  });

  // The peak has to clear the line to keep the question answerable, but only
  // just — anchoring it at the top of the range is what made it an outlier.
  test('the highest note is close to the rest of the line, not two octaves clear', () => {
    for (let seed = 0; seed < 60; seed++) {
      const notes = instanceFor('highest', seed).stimulus.music!.voices[0].events.filter(
        (e: MusicEvent): e is NoteEvent => e.type === 'note',
      );
      const heights = notes.map((n: NoteEvent) => semitones(n.pitch)).sort((a: number, b: number) => b - a);
      expect(heights[0]).toBeGreaterThan(heights[1]); // still strictly highest
      expect(heights[0] - heights[1]).toBeLessThanOrEqual(7);
    }
  });
});
