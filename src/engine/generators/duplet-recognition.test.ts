import { validate } from '../validator';
import { musicEventUnits } from '../music-event-units';
import type { Music, NoteEvent } from '../../music/types';
import { barUnitsFor } from './bar-math';
import { generate } from './index';

const ATOMS = ['duplet:6/8', 'duplet:9/8', 'duplet:12/8'];
const SEEDS = Array.from({ length: 40 }, (_, i) => i);

function inst(seed: number) {
  return generate('duplet_recognition', { grade: 4, seed, atoms: ATOMS });
}

function musicOf(seed: number): Music {
  return inst(seed).stimulus.music as Music;
}

describe('duplet_recognition', () => {
  test('every instance validates clean', () => {
    for (const seed of SEEDS) expect(validate(inst(seed)).ok).toBe(true);
  });

  test('the stimulus carries exactly one 2-in-3 duplet, its first note marked as the group start', () => {
    for (const seed of SEEDS) {
      const music = musicOf(seed);
      const tupletNotes = music.voices
        .flatMap((v) => v.events)
        .filter((ev): ev is NoteEvent => ev.type === 'note' && ev.tuplet !== undefined);
      expect(tupletNotes).toHaveLength(2);
      expect(tupletNotes.every((n) => n.tuplet!.size === 2 && n.tuplet!.inTimeOf === 3)).toBe(true);
      expect(tupletNotes[0].tuplet!.start).toBe(true);
      expect(tupletNotes[1].tuplet!.start).toBeUndefined();
    }
  });

  test('the duplet fills its beat — the bar sums to a full compound bar (2-in-3 scaling applied)', () => {
    for (const seed of SEEDS) {
      const music = musicOf(seed);
      const total = music.voices.flatMap((v) => v.events).reduce((sum, ev) => sum + musicEventUnits(ev), 0);
      expect(total).toBe(barUnitsFor(music.time_sig!));
    }
  });

  test('the answer is always a legal duplet fact ("three" for the ratio, "one" for the beats-filled)', () => {
    const legal: Record<string, string[]> = { three: ['four', 'two'], one: ['three', 'two'] };
    for (const seed of SEEDS) {
      const i = inst(seed);
      const canonical = i.answer.canonical as string;
      expect(Object.keys(legal)).toContain(canonical);
      expect([...i.distractors].sort()).toEqual(legal[canonical]);
    }
  });

  test('only compound signatures are produced', () => {
    for (const seed of SEEDS) {
      expect(['6/8', '9/8', '12/8']).toContain(musicOf(seed).time_sig);
    }
  });
});
