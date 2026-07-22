import { hasExamPaper } from '../learn/exam';
import { accountNudgeStats, isLevelUnlocked } from '../learn/mastery-rollup';
import { ProgressStore } from '../learn/store';
import { LESSONS, LESSONS_BY_GRADE, lessonsForGrade, lessonById } from './lessons';
import { isStartableGrade, LEVELS } from './levels';

describe('levels — Level 1 derives dynamically from LESSONS_BY_GRADE[1] (AD7, not a frozen fixture)', () => {
  const level1 = LEVELS[0];

  // Sourced from the grade-1 doc alone (LESSONS_BY_GRADE[1]), not the merged
  // LESSONS export — otherwise a later-registered grade-2 doc would silently
  // inflate this level's unit list and exam threshold.
  test('Level 1 is unlocked (grade === 1, unconditionally, D5) and has one unit id per grade-1 lesson, in lesson order', () => {
    expect(level1.id).toBe('level-1');
    expect(level1.grade).toBe(1);
    expect(isLevelUnlocked(level1, new ProgressStore())).toBe(true);
    expect(level1.unitIds).toEqual(LESSONS_BY_GRADE[1].map((l) => l.id));
  });

  test('every Level 1 unit id resolves to a real lesson', () => {
    for (const unitId of level1.unitIds) {
      expect(lessonById(unitId)).toBeDefined();
    }
  });

  test('exam gate unlocks at 3 stars per unit (RD3: all units at 3 stars)', () => {
    expect(level1.examGate.unlockAtStars).toBe(level1.unitIds.length * 3);
  });
});

// U5: Level 2's shape derives from authored content, never a frozen literal
// (the same anti-drift rule levels.ts:1-3 states for Level 1).
describe('levels — Level 2 derives dynamically from LESSONS_BY_GRADE[2] (D5, U5)', () => {
  const level2 = LEVELS[1];

  test('Level 2 has one unit id per grade-2 lesson, in lesson order', () => {
    expect(level2.id).toBe('level-2');
    expect(level2.grade).toBe(2);
    expect(level2.unitIds).toEqual(LESSONS_BY_GRADE[2].map((l) => l.id));
  });

  test('exam gate unlocks at 3 stars per unit, same rule as Level 1', () => {
    expect(level2.examGate.unlockAtStars).toBe(level2.unitIds.length * 3);
  });

  // U6: unlock is a derivation over the store, not a field — locked on a fresh
  // store, unlocked the moment Level 1's exam is recorded cleared (D5).
  test('Level 2 is locked on a fresh store and unlocks once Level 1\'s exam is cleared', () => {
    const store = new ProgressStore();
    expect(isLevelUnlocked(level2, store)).toBe(false);
    store.recordExamCleared(1);
    expect(isLevelUnlocked(level2, store)).toBe(true);
  });
});

// U6: Level 3's shape derives from the authored grade-3 doc, never a literal
// (the same anti-drift rule as level1()/level2()).
describe('levels — Level 3 derives dynamically from LESSONS_BY_GRADE[3] (D9, U6)', () => {
  const level3 = LEVELS[2];

  test('Level 3 has one unit id per grade-3 lesson, in lesson order', () => {
    expect(level3.id).toBe('level-3');
    expect(level3.grade).toBe(3);
    expect(level3.unitIds).toEqual(LESSONS_BY_GRADE[3].map((l) => l.id));
  });

  test('exam gate unlocks at 3 stars per unit, same rule as Level 1/2 (27 stars for 9 grade-3 units)', () => {
    expect(level3.examGate.unlockAtStars).toBe(LESSONS_BY_GRADE[3].length * 3);
    expect(level3.unitIds).toHaveLength(9);
    expect(level3.examGate.unlockAtStars).toBe(27);
  });

  // The unlock gate is the PREVIOUS grade's exam (Grade 2's) — and no Grade 2
  // exam paper exists yet (hasExamPaper(2) is false), so the seed seam
  // (recordExamCleared) is the only current path to a cleared Level 3.
  test('Level 3 is locked on a fresh store and with only the grade-1 exam cleared; unlocks once the grade-2 exam is recorded cleared', () => {
    const fresh = new ProgressStore();
    expect(isLevelUnlocked(level3, fresh)).toBe(false);

    const grade1Cleared = new ProgressStore();
    grade1Cleared.recordExamCleared(1);
    expect(isLevelUnlocked(level3, grade1Cleared)).toBe(false);

    const grade2Cleared = new ProgressStore();
    grade2Cleared.recordExamCleared(2);
    expect(isLevelUnlocked(level3, grade2Cleared)).toBe(true);
  });

  // No stub Grade-3 (or Grade-2) exam paper exists — the exam gate must render
  // "no paper" exactly as Grade 2's does, keeping Level 3 locked for real
  // learners this slice (D9).
  test('hasExamPaper(3) is false — no stub Grade-3 exam paper', () => {
    expect(hasExamPaper(3)).toBe(false);
  });
});

describe('levels — Levels 4-5 are locked placeholders (R1, R4)', () => {
  const higherLevels = LEVELS.slice(3);

  test('there are exactly two locked levels, grades 4 through 5', () => {
    expect(higherLevels.map((l) => l.grade)).toEqual([4, 5]);
  });

  // D5: content-less levels stay locked even after their previous grade's exam clears
  // — a level can never "open" onto no units. Also names its OWN previous-grade
  // prerequisite (fixes the hardcoded "Level 1" bug).
  test('each stays locked even with every previous exam cleared, has no units, and names its OWN previous-grade prerequisite', () => {
    const store = new ProgressStore();
    for (let grade = 1; grade < 5; grade++) store.recordExamCleared(grade);
    for (const level of higherLevels) {
      expect(isLevelUnlocked(level, store)).toBe(false);
      expect(level.unitIds).toEqual([]);
      expect(level.prerequisite).toBe(`Clear the Level ${level.grade - 1} exam to unlock`);
    }
  });
});

describe('levels — isStartableGrade is a static content concept, decoupled from progression unlock (D14)', () => {
  test('only Grade 1 is startable, even with every exam cleared', () => {
    expect(isStartableGrade(1)).toBe(true);
    for (const grade of [2, 3, 4, 5]) expect(isStartableGrade(grade)).toBe(false);
  });
});

// D13 — registering grade-2 content must move ZERO grade-1-visible numbers
// until Level 2 is actually unlocked. This is the test that fails if anyone
// re-points a grade-1 surface (level1(), the Profile fact denominator, the
// account-nudge stats) at the merged LESSONS list instead of the grade-1
// scope. LESSONS here already includes the grade-2 doc (both are registered
// in src/content/lessons.ts) — the point is that including it changes nothing
// below.
describe('registering grade-2 content moves ZERO grade-1-visible numbers (D13 zero-movement invariant)', () => {
  const level1 = LEVELS[0];

  test('Level 1 unit count and exam-gate threshold stay at the grade-1 doc values (8 units / 24 stars)', () => {
    expect(level1.unitIds).toHaveLength(8);
    expect(level1.examGate.unlockAtStars).toBe(24);
    // Same numbers whether read from Level 1 or straight off the grade-1 doc.
    expect(level1.unitIds).toEqual(LESSONS_BY_GRADE[1].map((l) => l.id));
    expect(level1.examGate.unlockAtStars).toBe(LESSONS_BY_GRADE[1].length * 3);
  });

  test('accountNudgeStats over the merged LESSONS equals its value over grade-1 lessons alone, on a store with no exam cleared', () => {
    const store = new ProgressStore();
    const now = 0;
    const overMerged = accountNudgeStats(store, LESSONS, now);
    const overGrade1Only = accountNudgeStats(store, LESSONS_BY_GRADE[1], now);
    expect(overMerged).toEqual(overGrade1Only);
  });

  test('the Profile fact denominator source (lessonsForGrade(1).length) is 8', () => {
    expect(lessonsForGrade(1)).toHaveLength(8);
  });
});

// U6 (D9) — registering grade-3 content must move ZERO grade-1/2-visible
// numbers. This is the trip-wire for anyone re-pointing a grade-1 or grade-2
// surface at the merged LESSONS list instead of its own grade scope. LESSONS
// here already includes the grade-3 doc (registered in src/content/lessons.ts)
// — the point is that including it changes nothing below, on a store where
// the grade-2 exam has NOT been cleared (i.e. Level 3 stays locked).
describe('registering grade-3 content moves ZERO grade-1/2-visible numbers (D9/U6 zero-movement invariant)', () => {
  const level1 = LEVELS[0];
  const level2 = LEVELS[1];

  test('Level 1 shape (unit count, star gate, id list) is unchanged', () => {
    expect(level1.unitIds).toHaveLength(8);
    expect(level1.examGate.unlockAtStars).toBe(24);
    expect(level1.unitIds).toEqual(LESSONS_BY_GRADE[1].map((l) => l.id));
  });

  test('Level 2 shape (unit count, star gate, id list) is unchanged', () => {
    expect(level2.unitIds).toEqual(LESSONS_BY_GRADE[2].map((l) => l.id));
    expect(level2.examGate.unlockAtStars).toBe(LESSONS_BY_GRADE[2].length * 3);
  });

  test('accountNudgeStats over the merged LESSONS equals its value over grade-1+2 lessons alone, on a store with no grade-2 exam cleared', () => {
    const store = new ProgressStore();
    const now = 0;
    const overMerged = accountNudgeStats(store, LESSONS, now);
    const overGrade1And2Only = accountNudgeStats(
      store,
      [...LESSONS_BY_GRADE[1], ...LESSONS_BY_GRADE[2]],
      now,
    );
    expect(overMerged).toEqual(overGrade1And2Only);
  });
});
