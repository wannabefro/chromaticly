// triplet_recognition (Grade 2, chromaticly-e3z.9). The invariants are metric:
// the group fills exactly one beat whatever the metre, the ratio stays 3-in-2,
// and a rest inside the group still occupies one of its three places.

import { generate } from './index';
import { musicToAbc } from '../../music/abc-emitter';
import type { Music, NoteEvent, RestEvent } from '../../music/types';
import { musicEventUnits } from '../music-event-units';
import { barUnitsFor } from './bar-math';

const PLAIN = ['triplet:2/4', 'triplet:3/4', 'triplet:4/4', 'triplet:2/2', 'triplet:3/8'];
const WITH_REST = ['triplet_rest:3/4', 'triplet_rest:4/4'];
const SEEDS = Array.from({ length: 30 }, (_, i) => i);

function instanceAt(seed: number, atoms: string[] = [...PLAIN, ...WITH_REST]) {
  return generate('triplet_recognition', { grade: 2, seed, atoms });
}

function musicOf(seed: number, atoms?: string[]): Music {
  return instanceAt(seed, atoms).stimulus.music as Music;
}

type Grouped = NoteEvent | RestEvent;

function groupEvents(music: Music): Grouped[] {
  return music.voices[0].events.filter(
    (ev): ev is Grouped => (ev.type === 'note' || ev.type === 'rest') && ev.tuplet !== undefined,
  );
}

describe('triplet_recognition — the group fills exactly one beat', () => {
  test.each(SEEDS)('seed %i renders a bar that sums to its time signature', (seed) => {
    const music = musicOf(seed);
    const total = music.voices[0].events.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
    // A third of a beat is not an exact binary fraction, so compare loosely.
    expect(total).toBeCloseTo(barUnitsFor(music.time_sig!), 9);
  });

  test.each(SEEDS)('seed %i marks exactly three places, always 3-in-2', (seed) => {
    const group = groupEvents(musicOf(seed));
    expect(group).toHaveLength(3);
    for (const ev of group) {
      expect(ev.tuplet?.size).toBe(3);
      expect(ev.tuplet?.inTimeOf).toBe(2);
    }
  });

  test.each(SEEDS)('seed %i marks the start of the group exactly once, on its first place', (seed) => {
    const group = groupEvents(musicOf(seed));
    const starts = group.filter((ev) => ev.tuplet?.start);
    expect(starts).toHaveLength(1);
    expect(starts[0]).toBe(group[0]);
  });

  // Otherwise the rule is learned as "three quavers" and breaks in 2/2.
  test('the triplet is written in the value that halves the beat', () => {
    const expected: Record<string, string> = { '2/4': 'quaver', '3/4': 'quaver', '4/4': 'quaver', '2/2': 'crotchet', '3/8': 'semiquaver' };
    for (const sig of Object.keys(expected)) {
      const music = musicOf(0, [`triplet:${sig}`]);
      expect(music.time_sig).toBe(sig);
      for (const ev of groupEvents(music)) {
        expect(ev.dur).toBe(expected[sig]);
      }
    }
  });
});

describe('triplet_recognition — the rest form is its own skill', () => {
  test('a triplet_rest atom always puts exactly one rest inside the group', () => {
    for (const seed of SEEDS) {
      const group = groupEvents(musicOf(seed, WITH_REST));
      expect(group.filter((ev) => ev.type === 'rest')).toHaveLength(1);
    }
  });

  // A group opening on a rest hides the bracket it belongs to.
  test('the rest is never the first place in the group', () => {
    for (const seed of SEEDS) {
      expect(groupEvents(musicOf(seed, WITH_REST))[0].type).toBe('note');
    }
  });

  test('a plain triplet atom never draws a rest into the group', () => {
    for (const seed of SEEDS) {
      expect(groupEvents(musicOf(seed, PLAIN)).filter((ev) => ev.type === 'rest')).toHaveLength(0);
    }
  });

  test('the rest form tags triplet_rest and the plain form tags triplet', () => {
    for (const seed of SEEDS) {
      expect(instanceAt(seed, WITH_REST).srs_tags[0].startsWith('triplet_rest:')).toBe(true);
      expect(instanceAt(seed, PLAIN).srs_tags[0].startsWith('triplet:')).toBe(true);
    }
  });
});

describe('triplet_recognition — what the exercise asks', () => {
  test('the ratio answer is always two, never the bracket number', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed, PLAIN);
      if (!inst.prompt.includes('in the time of')) continue;
      expect(inst.answer.canonical).toBe('two');
      expect(inst.distractors).toContain('three');
    }
  });

  test('the sounding variant answers two — the rest place does not sound', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed, WITH_REST);
      if (!inst.prompt.includes('How many notes sound')) continue;
      expect(inst.answer.canonical).toBe('two');
    }
  });

  // A learner who thinks a rest costs no time gets the first right, this wrong.
  test('both rest-form variants appear, and the duration one answers one beat', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const inst = instanceAt(seed, WITH_REST);
      if (inst.prompt.includes('How long')) {
        seen.add('places');
        expect(inst.answer.canonical).toMatch(/^one (minim|crotchet|quaver)$/);
      } else {
        seen.add('sounding');
      }
    }
    expect([...seen].sort()).toEqual(['places', 'sounding']);
  });

  test('both plain variants appear, so neither question goes unasked', () => {
    const prompts = new Set(SEEDS.map((s) => (instanceAt(s, PLAIN).prompt.includes('How many beats') ? 'beat' : 'ratio')));
    expect([...prompts].sort()).toEqual(['beat', 'ratio']);
  });

  test('every wrong answer is explained individually, never with one shared string', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors) expect(typeof reasons[d as string]).toBe('string');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });
});

describe('triplet_recognition — boundaries', () => {
  test('an atom set naming no triplet fails loud rather than drawing one', () => {
    expect(() => instanceAt(0, ['metre:3/4'])).toThrow();
  });

  // A compound beat already holds three, so 3-in-2 is not true there.
  test('a compound signature throws — a triplet divides a SIMPLE beat', () => {
    expect(() => generate('triplet_recognition', { grade: 3, seed: 0, atoms: ['triplet:6/8'] })).toThrow();
  });

  test('the ABC carries the (3:2:3 bracket the emitter needs', () => {
    for (const seed of SEEDS) {
      expect(musicToAbc(musicOf(seed))).toContain('(3:2:3');
    }
  });
});
