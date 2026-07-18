import { LESSONS_BY_GRADE, lessonById } from './lessons';
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

describe('levels — Levels 2-5 are locked placeholders (R1, R4)', () => {
  const higherLevels = LEVELS.slice(1);

  test('there are exactly four locked levels, grades 2 through 5', () => {
    expect(higherLevels.map((l) => l.grade)).toEqual([2, 3, 4, 5]);
  });

  test('each is unlocked:false, has no units, and names a prerequisite', () => {
    for (const level of higherLevels) {
      expect(level.unlocked).toBe(false);
      expect(level.unitIds).toEqual([]);
      expect(level.prerequisite).toBe('Clear the Level 1 exam to unlock');
    }
  });
});
