import { accountNudgeStats } from '../learn/mastery-rollup';
import { ProgressStore } from '../learn/store';
import { LESSONS, LESSONS_BY_GRADE, lessonsForGrade, lessonById } from './lessons';
import { LEVELS } from './levels';

describe('levels — Level 1 derives dynamically from LESSONS_BY_GRADE[1] (AD7, not a frozen fixture)', () => {
  const level1 = LEVELS[0];

  // Sourced from the grade-1 doc alone (LESSONS_BY_GRADE[1]), not the merged
  // LESSONS export — otherwise a later-registered grade-2 doc would silently
  // inflate this level's unit list and exam threshold.
  test('Level 1 is unlocked and has one unit id per grade-1 lesson, in lesson order', () => {
    expect(level1.id).toBe('level-1');
    expect(level1.grade).toBe(1);
    expect(level1.unlocked).toBe(true);
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
// (the same anti-drift rule levels.ts:1-3 states for Level 1). Screens still
// read the static `unlocked` field this unit (stays false — U6 wires the
// dynamic isLevelUnlocked derivation into the UI).
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

  test('the static unlocked field stays false this unit (U5 mid-stack; U6 removes it)', () => {
    expect(level2.unlocked).toBe(false);
  });
});

describe('levels — Levels 3-5 are locked placeholders (R1, R4)', () => {
  const higherLevels = LEVELS.slice(2);

  test('there are exactly three locked levels, grades 3 through 5', () => {
    expect(higherLevels.map((l) => l.grade)).toEqual([3, 4, 5]);
  });

  test('each is unlocked:false, has no units, and names its OWN previous-grade prerequisite (D5 fixes the hardcoded "Level 1" bug)', () => {
    for (const level of higherLevels) {
      expect(level.unlocked).toBe(false);
      expect(level.unitIds).toEqual([]);
      expect(level.prerequisite).toBe(`Clear the Level ${level.grade - 1} exam to unlock`);
    }
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
