// metre_from_class (chromaticly-lgi): the class is named and the metre chosen.
// The trap this shape has and metre_classification does not is a SECOND right
// answer — 2/4 and 2/2 are both simple duple — so the option set is the
// invariant under test.

import { generate } from './index';
import { classifyMetre } from '../metre';
import { validate } from '../validator';

const G3 = ['metre:2/4', 'metre:3/4', 'metre:4/4', 'metre:6/8', 'metre:9/8', 'metre:12/8'];
const G4 = ['metre:2/2', 'metre:3/2', 'metre:2/4', 'metre:3/4', 'metre:6/4', 'metre:9/4', 'metre:3/8', 'metre:6/8'];

function make(seed = 0, grade = 3, atoms = G3) {
  return generate('metre_from_class', { grade, seed, atoms });
}

function classOf(sig: string): string {
  const cls = classifyMetre(sig);
  return `${cls.division} ${cls.beats}`;
}

describe('metre_from_class', () => {
  test('no distractor shares the answer class, or the item would have two right answers', () => {
    for (const grade of [3, 4]) {
      for (let seed = 0; seed < 40; seed++) {
        const inst = make(seed, grade, grade === 3 ? G3 : G4);
        const answerClass = classOf(inst.answer.canonical as string);
        for (const d of inst.distractors as string[]) expect(classOf(d)).not.toBe(answerClass);
      }
    }
  });

  test('the prompt is closed — "which of these", because the class alone can name several metres', () => {
    expect(make().prompt).toMatch(/^Which of these is /);
  });

  test('the stimulus is the class name and carries no notation to read the answer off', () => {
    const inst = make(1);
    expect(inst.stimulus.music).toBeNull();
    expect(String(inst.stimulus.text).toLowerCase()).toBe(String(inst.prompt).replace('Which of these is ', '').replace('?', ''));
  });

  test('every wrong metre is told its own class, never a shared line', () => {
    const inst = make(2);
    const reasons = inst.feedback.by_distractor ?? {};
    for (const d of inst.distractors as string[]) expect(reasons[d]).toContain(d);
    expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
  });

  test('the tag names the metre drawn, so credit lands on that metre alone', () => {
    for (let seed = 0; seed < 10; seed++) {
      const inst = make(seed);
      expect(inst.srs_tags).toEqual([`metre:${inst.answer.canonical}`]);
    }
  });

  test('an atom set naming no metre fails loud', () => {
    expect(() => make(0, 3, ['grouping:6/8'])).toThrow();
  });

  test('seeds 0..99 validate at every grade a metre lesson runs at', () => {
    for (const [grade, atoms] of [[3, G3], [4, G4]] as const) {
      for (let seed = 0; seed < 100; seed++) {
        expect(validate(make(seed, grade, atoms))).toEqual({ ok: true, errors: [] });
      }
    }
  });
});
