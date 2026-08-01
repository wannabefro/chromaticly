// note_value_equivalence (chromaticly-lgi): seeing which of two notes is longer
// and knowing how many of one fill the other are different skills. The two
// wrong counts are the one-step-short and one-step-far miscounts, so each names
// its own mistake rather than sharing a line.

import { generate } from './index';
import { UNITS } from './note-value-compare';
import { validate } from '../validator';

function make(seed = 0, grade = 4) {
  return generate('note_value_equivalence', { grade, seed, atoms: [] });
}

describe('note_value_equivalence', () => {
  test('the answer is the true ratio of the two note values', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      const [, shorter, longer] = /^How many (\w+)s last as long as one (\w+)\?$/.exec(inst.prompt) ?? [];
      const ratio = UNITS[longer as keyof typeof UNITS] / UNITS[shorter as keyof typeof UNITS];
      expect(inst.answer.canonical).toBe(String(ratio));
    }
  });

  test('the two wrong counts bracket the answer — one halving short, one too far', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      const n = Number(inst.answer.canonical);
      expect((inst.distractors as string[]).map(Number).sort((a, b) => a - b)).toEqual([n / 2, n * 2]);
    }
  });

  test('the question is asked as text — no notation to read the answer off', () => {
    const inst = make(1);
    expect(inst.stimulus.music).toBeNull();
    expect(typeof inst.stimulus.text).toBe('string');
  });

  test('each wrong count names its own direction, and the two differ', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = make(seed);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors as string[]) expect(typeof reasons[d]).toBe('string');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });

  test('the tag is the same one the compare shape credits', () => {
    expect(make(0).srs_tags).toEqual(['note_value_compare']);
  });

  test('seeds 0..99 validate at every grade a note-value lesson runs at', () => {
    for (const grade of [1, 4]) {
      for (let seed = 0; seed < 100; seed++) expect(validate(make(seed, grade))).toEqual({ ok: true, errors: [] });
    }
  });
});
