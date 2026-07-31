// tuplet_recognition (Grade 5, chromaticly-e3z.6) — "irregular divisions of
// simple time values". The invariants worth guarding are metric, not cosmetic:
// the group must fill exactly one beat whatever its size, and the "in the time
// of" answer must stay 4 — that is what makes it a division of the BEAT.

import { generate } from './index';
import { musicToAbc } from '../../music/abc-emitter';
import type { Music, MusicEvent } from '../../music/types';
import { musicEventUnits } from '../music-event-units';
import { barUnitsFor } from './bar-math';
import { TUPLET_SIZES } from './tuplet-recognition';

const ATOMS = ['tuplet:5', 'tuplet:6', 'tuplet:7'];
const SEEDS = Array.from({ length: 30 }, (_, i) => i);

function musicOf(seed: number, atoms: string[] = ATOMS): Music {
  return generate('tuplet_recognition', { grade: 5, seed, atoms }).stimulus.music as Music;
}

function tupletNotes(music: Music): MusicEvent[] {
  return music.voices[0].events.filter((ev) => ev.type === 'note' && ev.tuplet !== undefined);
}

describe('tuplet_recognition — the group fills exactly one beat', () => {
  test.each(SEEDS)('seed %i renders a bar that sums to its time signature', (seed) => {
    const music = musicOf(seed);
    const total = music.voices[0].events.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
    expect(total).toBe(barUnitsFor(music.time_sig!));
  });

  test.each(SEEDS)('seed %i puts every tuplet note in one group of the atom-named size', (seed) => {
    const notes = tupletNotes(musicOf(seed));
    expect(TUPLET_SIZES).toContain(notes.length);
    for (const ev of notes) {
      expect(ev.type === 'note' && ev.tuplet?.size).toBe(notes.length);
      // 4, always: the group replaces one beat of four semiquavers, whatever
      // the bracket number. A size-dependent inTimeOf would make it a division
      // of the note rather than of the beat.
      expect(ev.type === 'note' && ev.tuplet?.inTimeOf).toBe(4);
    }
  });

  test.each(SEEDS)('seed %i marks the start of the group exactly once', (seed) => {
    const starts = tupletNotes(musicOf(seed)).filter((ev) => ev.type === 'note' && ev.tuplet?.start);
    expect(starts).toHaveLength(1);
  });
});

describe('tuplet_recognition — what the exercise asks', () => {
  test('the ratio answer is always four, never the bracket number', () => {
    for (const seed of SEEDS) {
      const inst = generate('tuplet_recognition', { grade: 5, seed, atoms: ATOMS });
      if (!inst.prompt.includes('in the time of')) continue;
      expect(inst.answer.canonical).toBe('four');
      expect(inst.distractors).not.toContain('four');
    }
  });

  test('every wrong answer is explained individually, never with one shared string', () => {
    for (const seed of SEEDS) {
      const inst = generate('tuplet_recognition', { grade: 5, seed, atoms: ATOMS });
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors) expect(typeof reasons[d]).toBe('string');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });

  test('a single-size atom set only ever draws that size', () => {
    for (const size of TUPLET_SIZES) {
      for (const seed of [0, 1, 2, 3, 4]) {
        expect(tupletNotes(musicOf(seed, [`tuplet:${size}`]))).toHaveLength(size);
      }
    }
  });

  test('an atom set naming no tuplet size fails loud rather than drawing one', () => {
    expect(() => generate('tuplet_recognition', { grade: 5, seed: 0, atoms: ['metre:5/4'] })).toThrow();
  });
});

describe('tuplet_recognition — the rendered bracket', () => {
  test('the ABC carries the (size:4:size bracket the emitter needs', () => {
    for (const seed of SEEDS) {
      const music = musicOf(seed);
      const size = tupletNotes(music).length;
      expect(musicToAbc(music)).toContain(`(${size}:4:${size}`);
    }
  });

  // The bar is drawn in simple time on purpose: a compound beat already holds
  // three, so the 5-in-4 relationship would not be true there.
  test('the bar is always a simple /4 metre', () => {
    for (const seed of SEEDS) {
      expect(['2/4', '3/4', '4/4']).toContain(musicOf(seed).time_sig);
    }
  });
});
