// time_signature_match (chromaticly-lgi): the signature is given and the bar
// is chosen. The trap this shape has and add_time_signature does not is a
// SECOND right answer — a bar of 6 quavers fits 3/4 and 6/8 alike — so the
// option bar lengths are the invariant under test.

import { generate } from './index';
import { barUnitsFor } from './bar-math';
import { musicEventUnits } from '../music-event-units';
import type { Music } from '../../music/types';
import { validate } from '../validator';

const G2 = ['add_time_signature:2/2', 'add_time_signature:3/2', 'add_time_signature:4/2', 'add_time_signature:3/8'];
const G3 = ['add_time_signature:6/8', 'add_time_signature:9/8', 'add_time_signature:12/8'];

function make(seed = 0, grade = 2, atoms = G2) {
  return generate('time_signature_match', { grade, seed, atoms });
}

function optionsOf(inst: ReturnType<typeof make>): Record<string, Music> {
  return (inst.interaction.config as { option_music: Record<string, Music> }).option_music;
}

function unitsOf(music: Music): number {
  return music.voices[0].events.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
}

describe('time_signature_match', () => {
  test('no wrong bar holds the answer bar length, or the item has two right answers', () => {
    for (const [grade, atoms] of [[2, G2], [3, G3]] as const) {
      for (let seed = 0; seed < 40; seed++) {
        const inst = make(seed, grade, atoms);
        const answerUnits = barUnitsFor(inst.answer.canonical as string);
        for (const d of inst.distractors as string[]) expect(barUnitsFor(d)).not.toBe(answerUnits);
      }
    }
  });

  test('every option bar totals exactly the signature that keys it', () => {
    for (const [grade, atoms] of [[2, G2], [3, G3]] as const) {
      for (let seed = 0; seed < 20; seed++) {
        for (const [sig, music] of Object.entries(optionsOf(make(seed, grade, atoms)))) {
          expect(unitsOf(music)).toBe(barUnitsFor(sig));
        }
      }
    }
  });

  test('no option prints its own time signature — that would give the answer away', () => {
    for (const music of Object.values(optionsOf(make(3, 3, G3)))) expect(music.time_sig_hidden).toBe(true);
  });

  test('the signature asked for is the stimulus text, and no notation is shown', () => {
    const inst = make(1);
    expect(inst.stimulus.music).toBeNull();
    expect(inst.stimulus.text).toBe(inst.answer.canonical);
    expect(inst.prompt).toBe(`Which of these bars is in ${inst.answer.canonical}?`);
  });

  test('each wrong bar is told its own total, never a shared line', () => {
    const inst = make(2, 3, G3);
    const reasons = inst.feedback.by_distractor ?? {};
    for (const d of inst.distractors as string[]) expect(reasons[d]).toContain(d);
    expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
  });

  test('a grade-1 signature keeps the bare atom, a later one gets its own', () => {
    expect(make(0, 1, []).srs_tags).toEqual(['add_time_signature']);
    for (let seed = 0; seed < 10; seed++) {
      expect(make(seed, 3, G3).srs_tags[0]).toMatch(/^add_time_signature:(6|9|12)\/8$/);
    }
  });

  test('seeds 0..99 validate at every grade a time-signature lesson runs at', () => {
    for (const [grade, atoms] of [[1, []], [2, G2], [3, G3]] as const) {
      for (let seed = 0; seed < 100; seed++) {
        expect(validate(make(seed, grade, [...atoms]))).toEqual({ ok: true, errors: [] });
      }
    }
  });
});
