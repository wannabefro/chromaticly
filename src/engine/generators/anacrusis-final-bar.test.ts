// anacrusis_final_bar (chromaticly-lgi): the closing bar is missing, so the
// learner applies "upbeat + last bar = one whole bar" rather than counting it.
// The rule itself is the invariant under test.

import { generate } from './index';
import { barUnitsFor } from './bar-math';
import { musicEventUnits } from '../music-event-units';
import type { Music, MusicEvent } from '../../music/types';
import { validate } from '../validator';

const ATOMS = ['anacrusis:2/4', 'anacrusis:3/4', 'anacrusis:4/4'];

function make(seed = 0, atoms = ATOMS) {
  return generate('anacrusis_final_bar', { grade: 3, seed, atoms });
}

function pickupUnits(music: Music): number {
  const events: MusicEvent[] = music.voices[0].events;
  const end = events.findIndex((ev) => ev.type === 'barline');
  return events.slice(0, end).reduce((sum, ev) => sum + musicEventUnits(ev), 0);
}

describe('anacrusis_final_bar', () => {
  test('the answer is exactly what a whole bar has left after the upbeat', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      const music = inst.stimulus.music as Music;
      const left = (barUnitsFor(music.time_sig as string) - pickupUnits(music)) / 8;
      expect(inst.answer.canonical).toBe(`${left} beat${left === 1 ? '' : 's'}`);
    }
  });

  test('the closing bar is absent — its length is the question, not something to count', () => {
    for (let seed = 0; seed < 20; seed++) {
      const music = make(seed).stimulus.music as Music;
      const events = music.voices[0].events;
      expect(events[events.length - 1].type).toBe('note');
      expect(pickupUnits(music)).toBeLessThan(barUnitsFor(music.time_sig as string));
    }
  });

  test('the signature is printed — the learner counts the upbeat against it', () => {
    for (let seed = 0; seed < 20; seed++) {
      const music = make(seed).stimulus.music as Music;
      expect(music.anacrusis).toBe(true);
      expect(music.time_sig_hidden).toBeFalsy();
    }
  });

  test('every option is distinct and each wrong one names its own mistake', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      const options = [inst.answer.canonical, ...inst.distractors];
      expect(new Set(options).size).toBe(options.length);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors as string[]) expect(typeof reasons[d]).toBe('string');
    }
  });

  test('the tag is the metre drawn, so credit lands on that anacrusis atom', () => {
    for (let seed = 0; seed < 20; seed++) expect(ATOMS).toContain(make(seed).srs_tags[0]);
  });

  test('a lesson naming no anacrusis atom fails loud', () => {
    expect(() => make(0, ['metre:3/4'])).toThrow();
  });

  test('seeds 0..99 validate', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(validate(make(seed))).toEqual({ ok: true, errors: [] });
    }
  });
});
