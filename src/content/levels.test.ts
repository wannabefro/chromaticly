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

  // fyu.2: unlock is a derivation over the store, not a field — but under free
  // grade access it no longer gates on the previous grade's exam, only on
  // content presence, so Level 2 is reachable on a fresh store.
  test('Level 2 is reachable on a fresh store — content presence is the only gate, no exam required', () => {
    const store = new ProgressStore();
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

  // chromaticly-gni grew grade 3 from 9 to 10 units; chromaticly-e3z.1 added
  // major-keys-3 for the syllabus's "all keys to four sharps and flats", making 11.
  test('exam gate unlocks at 3 stars per unit, same rule as Level 1/2 (48 stars for 16 grade-3 units)', () => {
    expect(level3.examGate.unlockAtStars).toBe(LESSONS_BY_GRADE[3].length * 3);
    expect(level3.unitIds).toHaveLength(16);
    expect(level3.examGate.unlockAtStars).toBe(48);
  });

  // fyu.2: reachability is content presence only — Level 3 is reachable on a
  // fresh store, and exam state (cleared or not, any grade) doesn't move it.
  test('Level 3 is reachable on a fresh store — content presence is the only gate, independent of any exam state', () => {
    const fresh = new ProgressStore();
    expect(isLevelUnlocked(level3, fresh)).toBe(true);

    const grade1Cleared = new ProgressStore();
    grade1Cleared.recordExamCleared(1);
    expect(isLevelUnlocked(level3, grade1Cleared)).toBe(true);

    const grade2Cleared = new ProgressStore();
    grade2Cleared.recordExamCleared(2);
    expect(isLevelUnlocked(level3, grade2Cleared)).toBe(true);
  });

  // No stub Grade-3 (or Grade-2) exam paper exists — exam recording is a
  // separate concern from content reachability, and this trip-wire guards that
  // no stub paper silently appears for a grade that shouldn't have one yet.
  test('hasExamPaper(3) is false — no stub Grade-3 exam paper', () => {
    expect(hasExamPaper(3)).toBe(false);
  });
});

// fyu.13: Level 4 is now real — same anti-drift derivation as Level 1-3.
describe('levels — Level 4 derives dynamically from LESSONS_BY_GRADE[4] (fyu.13)', () => {
  const level4 = LEVELS[3];

  test('Level 4 has one unit id per grade-4 lesson, in lesson order', () => {
    expect(level4.id).toBe('level-4');
    expect(level4.grade).toBe(4);
    expect(level4.unitIds).toEqual(LESSONS_BY_GRADE[4].map((l) => l.id));
  });

  test('exam gate unlocks at 3 stars per unit, same rule as Level 1-3', () => {
    expect(level4.examGate.unlockAtStars).toBe(LESSONS_BY_GRADE[4].length * 3);
  });

  test('Level 4 is reachable on a fresh store — content presence is the only gate (free access)', () => {
    expect(isLevelUnlocked(level4, new ProgressStore())).toBe(true);
  });
});

// chromaticly-ehp: Level 5 derives dynamically from LESSONS_BY_GRADE[5], same
// anti-drift rule as level1()-level4() — no content-less levels remain.
describe('levels — Level 5 derives dynamically from LESSONS_BY_GRADE[5] (chromaticly-ehp)', () => {
  const level5 = LEVELS[4];

  test('Level 5 has one unit id per grade-5 lesson, in lesson order', () => {
    expect(level5.id).toBe('level-5');
    expect(level5.grade).toBe(5);
    expect(level5.unitIds).toEqual(LESSONS_BY_GRADE[5].map((l) => l.id));
  });

  test('exam gate unlocks at 3 stars per unit, same rule as Level 1-4', () => {
    expect(level5.examGate.unlockAtStars).toBe(LESSONS_BY_GRADE[5].length * 3);
  });

  test('Level 5 is reachable on a fresh store — content presence is the only gate (free access)', () => {
    expect(isLevelUnlocked(level5, new ProgressStore())).toBe(true);
  });

  // No stub Grade-5 exam paper exists — content reachability and exam-paper
  // availability are separate concerns; the gate stays sealed regardless.
  test('hasExamPaper(5) is false — no stub Grade-5 exam paper', () => {
    expect(hasExamPaper(5)).toBe(false);
  });
});

describe('levels — no content-less levels remain; every grade 1-5 has real content (R1, R4, chromaticly-ehp)', () => {
  test('all five levels carry at least one unit — there is no "coming soon" placeholder left', () => {
    expect(LEVELS.map((l) => l.grade)).toEqual([1, 2, 3, 4, 5]);
    expect(LEVELS.filter((l) => l.unitIds.length === 0)).toEqual([]);
  });
});

// fyu.2/chromaticly-ehp: grade is a self-service choice now — any grade with
// content is startable, no exam gate and no store needed (onboarding runs
// pre-profile). Grade 5 shipping content means every grade 1-5 is startable.
describe('levels — isStartableGrade is a static content concept, decoupled from progression unlock (D14)', () => {
  test('every grade with content (1-5) is startable — no content-less grade remains', () => {
    for (const grade of [1, 2, 3, 4, 5]) expect(isStartableGrade(grade)).toBe(true);
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

  // Grade-LOCAL growth is expected here. The invariant guards leakage.
  test('Level 1 unit count and exam-gate threshold match the grade-1 doc values (14 units / 42 stars)', () => {
    expect(level1.unitIds).toHaveLength(14);
    expect(level1.examGate.unlockAtStars).toBe(42);
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

  test('the Profile fact denominator source is lessonsForGrade(1), not the merged list', () => {
    expect(lessonsForGrade(1)).toHaveLength(14);
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

  test('Level 1 shape (unit count, star gate, id list) is unchanged by grade-3 registration', () => {
    expect(level1.unitIds).toHaveLength(14);
    expect(level1.examGate.unlockAtStars).toBe(42);
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
