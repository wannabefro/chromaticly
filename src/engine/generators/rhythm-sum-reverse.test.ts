// rhythm_sum_reverse (chromaticly-lgi): rhythm_sum adds notes up to one note;
// this gives the note and asks for the sum. Only the reverse makes a learner
// reason about what a second dot is worth. No wrong sum may total the same, so
// the option totals are the invariant under test.

import { generate } from './index';
import { validate } from '../validator';

const DOUBLE_DOT = ['rhythm_sum:double_dot'];
const UNITS: Record<string, number> = {
  demisemiquaver: 1, semiquaver: 2, quaver: 4, crotchet: 8, minim: 16, semibreve: 32, breve: 64,
};

function totalOf(label: string): number {
  return label.split(' + ').reduce((sum, term) => {
    const [, dot, dur] = /^(double-dotted |dotted )?([a-z]+)$/.exec(term.trim())!;
    return sum + UNITS[dur] * (dot === 'double-dotted ' ? 1.75 : dot === 'dotted ' ? 1.5 : 1);
  }, 0);
}

function make(seed = 0, atoms = DOUBLE_DOT) {
  return generate('rhythm_sum_reverse', { grade: 4, seed, atoms });
}

describe('rhythm_sum_reverse', () => {
  test('the answer adds up to the note given, and no wrong sum does', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      const target = totalOf(inst.stimulus.text as string);
      expect(totalOf(inst.answer.canonical as string)).toBe(target);
      for (const d of inst.distractors as string[]) expect(totalOf(d)).not.toBe(target);
    }
  });

  test('the double-dot lesson only ever asks about a double-dotted note', () => {
    for (let seed = 0; seed < 40; seed++) {
      expect(make(seed).stimulus.text).toMatch(/^double-dotted /);
    }
  });

  test('the note is shown as a rhythm glyph, so the value is read not just named', () => {
    const music = make(1).stimulus.music as { rhythmStaff?: boolean };
    expect(music.rhythmStaff).toBe(true);
  });

  test('each wrong sum is told what it actually comes to, and the two differ', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = make(seed);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors as string[]) expect(reasons[d]).toMatch(/^That sum comes to /);
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });

  test('the tag follows the lesson: the double-dot atom, not the bare one', () => {
    expect(make(0).srs_tags).toEqual(['rhythm_sum:double_dot']);
    expect(make(0, ['rhythm_sum']).srs_tags).toEqual(['rhythm_sum']);
  });

  test('seeds 0..99 validate, scoped and bare', () => {
    for (const atoms of [DOUBLE_DOT, ['rhythm_sum']]) {
      for (let seed = 0; seed < 100; seed++) expect(validate(make(seed, atoms))).toEqual({ ok: true, errors: [] });
    }
  });
});
