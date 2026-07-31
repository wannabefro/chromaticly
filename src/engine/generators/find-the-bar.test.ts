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
    for (let seed = 0; seed < 40; seed++) {
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
