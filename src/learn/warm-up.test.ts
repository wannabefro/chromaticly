// The warm-up definition (chromaticly-6xk). These assertions are about FAIRNESS,
// not about which constant is stored: each one runs the definition through the
// real generator and checks the item a learner would actually be handed.

import { generate } from '../engine/generators';
import { LESSONS } from '../content/lessons';
import { warmUpFor } from './warm-up';

const EVERY_GRADE = [0, 1, 2, 3, 4, 5];

describe('warmUpFor — every level gets an item its learner can actually read', () => {
  test.each(EVERY_GRADE)('grade %i generates all three questions without throwing', (grade) => {
    const w = warmUpFor(grade);
    for (const seed of w.seeds) {
      expect(generate(w.template, { grade: w.grade, seed, atoms: [w.atom] })).toBeTruthy();
    }
  });

  // The mastery guarantee (KTD3b) needs three attempts on ONE atom. A definition
  // whose generator credited something else would silently break it.
  test.each(EVERY_GRADE)('grade %i credits exactly its own atom, on every seed', (grade) => {
    const w = warmUpFor(grade);
    for (const seed of w.seeds) {
      expect(generate(w.template, { grade: w.grade, seed, atoms: [w.atom] }).srs_tags).toEqual([w.atom]);
    }
  });

  // The defect this exists for. Notation is exactly what a First steps learner has
  // not been taught yet, and retry-until-correct makes an unreadable question a
  // wall rather than a lesson.
  test('the First steps warm-up draws no notation', () => {
    const w = warmUpFor(0);
    for (const seed of w.seeds) {
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

// chromaticly-atz. Retry-until-correct guarantees mastery of the warm-up atom, so
// whichever LESSON owns that atom is credited before the learner has done
// anything. `note_value_compare` is grade-1 scope but is the sole atom of
// rhythm-breve-4, a GRADE 4 lesson — so every new learner arrived with a grade-4
// lesson 3-starred. Scope and ownership are different questions.
describe('warmUpFor — the warm-up may only credit a lesson at the learner\'s own level', () => {
  test.each(EVERY_GRADE)('grade %i drills an atom owned by a lesson at that same grade', (grade) => {
    const owner = LESSONS.find((l) => l.atoms.includes(warmUpFor(grade).atom))!;
    expect(owner.grade).toBe(grade === 0 ? 0 : 1);
  });

  // A single-atom lesson is the shape that made the old defect severe: mastering
  // the one atom completed the whole lesson. Several atoms means the warm-up
  // nudges the lesson rather than finishing it.
  test.each(EVERY_GRADE)('grade %i cannot complete its owner lesson outright', (grade) => {
    const owner = LESSONS.find((l) => l.atoms.includes(warmUpFor(grade).atom))!;
    expect(owner.atoms.length).toBeGreaterThan(1);
  });
});

// The seeds are authored, so what they draw is a decision and gets a test.
describe('warmUpFor — the three seeds are chosen, not inherited', () => {
  test.each(EVERY_GRADE)('grade %i asks three questions, no more and no fewer', (grade) => {
    expect(warmUpFor(grade).seeds).toHaveLength(3);
  });

  // Seeds 0,1,2 all draw BASS clef, so the first three staves the app ever showed
  // used a clef the learner meets in lesson 3, not lesson 1. The question is
  // purely rhythmic, which is why the clef must not be the odd thing about it.
  test('every notated warm-up card is in the clef its level teaches first', () => {
    const w = warmUpFor(1);
    for (const seed of w.seeds) {
      const music = generate(w.template, { grade: w.grade, seed, atoms: [w.atom] }).stimulus.music as { clef: string };
      expect(music.clef).toBe('treble');
    }
  });

  // Retry-until-correct already re-presents an item. Three identical answers on
  // top of that is a pattern a learner can ride without reading the question.
  test('the grade-1 warm-up does not give the same answer three times', () => {
    const w = warmUpFor(1);
    const answers = w.seeds.map((seed) => String(generate(w.template, { grade: w.grade, seed, atoms: [w.atom] }).answer.canonical));
    expect(new Set(answers).size).toBe(3);
  });
});
