// interval_compound_reduce (chromaticly-lgi): naming a compound interval and
// reducing one are separate Grade 5 skills. The trap is that the right answer
// is NOT the interval as written, so the written label is always an option.

import { generate } from './index';
import { validate } from '../validator';

const G5 = ['interval_compound:9', 'interval_compound:10', 'interval_compound:11', 'interval_compound:12'];

function make(seed = 0, atoms = G5) {
  return generate('interval_compound_reduce', { grade: 5, seed, atoms });
}

describe('interval_compound_reduce', () => {
  test('the answer is within an octave and the written compound label is offered against it', () => {
    for (let seed = 0; seed < 30; seed++) {
      const inst = make(seed);
      expect(String(inst.answer.canonical)).toMatch(/ (2nd|3rd|4th|5th|6th|7th)$/);
      const written = (inst.distractors as string[]).filter((d) => /\b(9th|10th|11th|12th|13th|14th)$/.test(d));
      expect(written).toHaveLength(1);
    }
  });

  test('the quality survives the reduction — only the number changes', () => {
    for (let seed = 0; seed < 30; seed++) {
      const inst = make(seed);
      const quality = String(inst.answer.canonical).split(' ')[0];
      const compound = (inst.distractors as string[]).find((d) => /\b1?\d(th|nd|rd)$/.test(d) && Number(d.match(/\d+/)![0]) > 8)!;
      expect(compound.split(' ')[0]).toBe(quality);
    }
  });

  test('each wrong option is told which mistake it is, and the two differ', () => {
    for (let seed = 0; seed < 10; seed++) {
      const inst = make(seed);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors as string[]) expect(typeof reasons[d]).toBe('string');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });

  test('the tag names the compound number drawn, so credit lands on that atom', () => {
    for (let seed = 0; seed < 20; seed++) expect(G5).toContain(make(seed).srs_tags[0]);
  });

  test('a lesson naming no compound atom fails loud', () => {
    expect(() => make(0, ['interval_any:3'])).toThrow();
  });

  test('seeds 0..99 validate', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(validate(make(seed))).toEqual({ ok: true, errors: [] });
    }
  });
});
