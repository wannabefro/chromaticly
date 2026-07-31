// tie_dot_value (Grade 1, chromaticly-e3z.14). Both devices answer "how long
// does this last", so the invariants are arithmetic: a tie adds the two values,
// a dot adds half again, and the wrong answers are the two real mistakes.

import { generate } from './index';
import { musicToAbc } from '../../music/abc-emitter';
import type { Music, NoteEvent } from '../../music/types';
import { musicEventUnits } from '../music-event-units';
import { validate } from '../validator';
import { barUnitsFor } from './bar-math';

/** The generator's own beat wording: "2½ beats", not "2.5 beats". */
function beats(units: number): string {
  const b = units / 8;
  const whole = Math.floor(b);
  const text = b - whole >= 0.5 ? (whole === 0 ? '½' : `${whole}½`) : `${whole}`;
  return `${text} ${b === 1 ? 'beat' : 'beats'}`;
}

const ATOMS = ['tie', 'single_dot'];
const SEEDS = Array.from({ length: 40 }, (_, i) => i);

function instanceAt(seed: number, atoms: string[] = ATOMS) {
  return generate('tie_dot_value', { grade: 1, seed, atoms });
}

function musicOf(seed: number, atoms?: string[]): Music {
  return instanceAt(seed, atoms).stimulus.music as Music;
}

describe('tie_dot_value — the stimulus is a real bar', () => {
  test.each(SEEDS)('seed %i sums to a whole bar of its time signature', (seed) => {
    const music = musicOf(seed);
    const total = music.voices[0].events.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
    expect(total).toBe(barUnitsFor(music.time_sig!));
  });

  test('a tied pair is two notes of the SAME pitch, the first carrying the tie', () => {
    for (const seed of SEEDS) {
      const events = musicOf(seed, ['tie']).voices[0].events.filter((ev): ev is NoteEvent => ev.type === 'note');
      const tied = events.findIndex((ev) => ev.tie);
      expect(tied).toBe(0);
      expect(events[1].pitch).toBe(events[0].pitch);
      expect(events[1].tie).toBeUndefined();
    }
  });

  test('the ABC carries the tie as a trailing hyphen on the first note only', () => {
    for (const seed of SEEDS) {
      const abc = musicToAbc(musicOf(seed, ['tie']));
      expect(abc).toMatch(/[A-Ga-g],*'*\d+-/);
      expect(abc.match(/-/g)).toHaveLength(1);
    }
  });

  test('a dotted stimulus carries exactly one single-dotted event, note or rest', () => {
    for (const seed of SEEDS) {
      const dotted = musicOf(seed, ['single_dot']).voices[0].events.filter(
        (ev) => (ev.type === 'note' || ev.type === 'rest') && ev.dots === 1,
      );
      expect(dotted).toHaveLength(1);
    }
  });

  test('the dot variant draws both a dotted note and a dotted rest', () => {
    const kinds = new Set(
      SEEDS.map((s) => (instanceAt(s, ['single_dot']).prompt.includes('rest') ? 'rest' : 'note')),
    );
    expect([...kinds].sort()).toEqual(['note', 'rest']);
  });
});

describe('tie_dot_value — the arithmetic the answer claims', () => {
  test('a tie answers the SUM, and each single value is offered as a wrong answer', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed, ['tie']);
      const events = (inst.stimulus.music as Music).voices[0].events.filter(
        (ev): ev is NoteEvent => ev.type === 'note',
      );
      expect(inst.answer.canonical).toBe(beats(musicEventUnits(events[0]) + musicEventUnits(events[1])));
      expect(inst.distractors).toContain(beats(musicEventUnits(events[0])));
    }
  });

  // The misconception: a dot adds HALF, not another whole value.
  test('a dot answers one and a half times the plain value, never twice it', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed, ['single_dot']);
      const dotted = (inst.stimulus.music as Music).voices[0].events.find(
        (ev) => (ev.type === 'note' || ev.type === 'rest') && ev.dots === 1,
      )!;
      const units = musicEventUnits(dotted);
      expect(inst.answer.canonical).toBe(beats(units));
      expect(inst.distractors).toContain(beats((units / 3) * 2));
      expect(inst.distractors).toContain(beats((units / 3) * 4));
    }
  });

  test('every wrong answer is explained individually, never with one shared string', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors) expect(typeof reasons[d as string]).toBe('string');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });

  test('the tag names the device that was drawn, so credit lands on the right skill', () => {
    for (const seed of SEEDS) {
      expect(instanceAt(seed, ['tie']).srs_tags).toEqual(['tie']);
      expect(instanceAt(seed, ['single_dot']).srs_tags).toEqual(['single_dot']);
    }
  });
});

describe('tie_dot_value — boundaries', () => {
  test('an atom set naming neither device fails loud', () => {
    expect(() => instanceAt(0, ['rhythm_sum'])).toThrow();
  });

  test('seeds 0..99 all produce a validator-clean instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(validate(instanceAt(seed))).toEqual({ ok: true, errors: [] });
    }
  });
});
