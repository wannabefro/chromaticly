// The warm-up definition (chromaticly-6xk). These assertions are about FAIRNESS,
// not about which constant is stored: each one runs the definition through the
// real generator and checks the item a learner would actually be handed.

import { generate } from '../engine/generators';
import { LESSONS } from '../content/lessons';
import { warmUpFor } from './warm-up';

const EVERY_GRADE = [0, 1, 2, 3, 4, 5];
const SEEDS = [0, 1, 2];

describe('warmUpFor — every level gets an item its learner can actually read', () => {
  test.each(EVERY_GRADE)('grade %i generates all three questions without throwing', (grade) => {
    const w = warmUpFor(grade);
    for (const seed of SEEDS) {
      expect(generate(w.template, { grade: w.grade, seed, atoms: [w.atom] })).toBeTruthy();
    }
  });

  // The mastery guarantee (KTD3b) needs three attempts on ONE atom. A definition
  // whose generator credited something else would silently break it.
  test.each(EVERY_GRADE)('grade %i credits exactly its own atom, on every seed', (grade) => {
    const w = warmUpFor(grade);
    for (const seed of SEEDS) {
      expect(generate(w.template, { grade: w.grade, seed, atoms: [w.atom] }).srs_tags).toEqual([w.atom]);
    }
  });

  // The defect this exists for. Notation is exactly what a First steps learner has
  // not been taught yet, and retry-until-correct makes an unreadable question a
  // wall rather than a lesson.
  test('the First steps warm-up draws no notation', () => {
    const w = warmUpFor(0);
    for (const seed of SEEDS) {
      expect(generate(w.template, { grade: w.grade, seed, atoms: [w.atom] }).stimulus.music).toBeNull();
    }
  });

  test('the grades keep the notated one — this changed nothing for them', () => {
    for (const grade of [1, 2, 3, 4, 5]) {
      expect(warmUpFor(grade)).toEqual(warmUpFor(1));
      expect(generate(warmUpFor(grade).template, { grade: 1, seed: 0, atoms: [warmUpFor(1).atom] }).stimulus.music).toBeTruthy();
    }
  });

  // An on-ramp must never be the thing that fails. Reaching it out of order gives
  // the default rather than a crash.
  test.each([null, undefined, 9])('an unknown grade (%s) falls back rather than throwing', (grade) => {
    expect(warmUpFor(grade as number | null)).toEqual(warmUpFor(1));
  });
});

describe('warmUpFor — the strand it claims is the strand it teaches', () => {
  // The strand drives the screen accent AND the "your first <strand> point" copy
  // on the next screen. A definition that named the wrong one would put an accent
  // on a screen that is not its own — the one-accent rule, stated wrongly.
  test.each(EVERY_GRADE)('grade %i names the strand of the lesson that owns its atom', (grade) => {
    const w = warmUpFor(grade);
    const owner = LESSONS.find((l) => l.atoms.includes(w.atom));
    if (!owner) return; // no lesson owns it — nothing to disagree with
    expect(w.strand).toBe(owner.strand);
  });

  test.each(EVERY_GRADE)('grade %i names itself for the plan screen', (grade) => {
    expect(warmUpFor(grade).title).toMatch(/warm-up$/);
  });
});

// chromaticly-nm4, recorded here so the fix is a one-line change with a test
// already waiting for it. `note_value_compare` is the SOLE atom of rhythm-breve-4,
// a GRADE 4 lesson, so retry-until-correct hands every new grade-1..5 learner a
// fully 3-starred grade-4 lesson before they have done anything.
describe('warmUpFor — the known defect, pinned so the fix is provable', () => {
  test('First steps drills an atom from its OWN level', () => {
    const owner = LESSONS.find((l) => l.atoms.includes(warmUpFor(0).atom))!;
    expect(owner.grade).toBe(0);
  });

  test('the grades still drill an atom from a grade-4 lesson — chromaticly-nm4, not yet fixed', () => {
    const owner = LESSONS.find((l) => l.atoms.includes(warmUpFor(1).atom))!;
    expect(owner.grade).toBe(4);
    expect(owner.atoms).toHaveLength(1); // one atom, so the warm-up 3-stars the whole lesson
  });
});
