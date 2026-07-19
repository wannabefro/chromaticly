// 302.5: the seeding seam unlocks a target unit without completing it, so an E2E
// can jump straight to a deep interaction. Guards the invariant the Maestro
// coverage (302.6) relies on: target unlocked + playable, predecessors complete.

import { LESSONS, lessonById } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { unitStates } from './mastery-rollup';
import { seedExamReady, seedProgressToUnit } from './seed';
import { ProgressStore } from './store';

const AT = '2026-07-13T00:00:00.000Z';

describe('seedProgressToUnit — fast-forward to a target unit (302.5)', () => {
  // This is the seam the E2E flows steer with, so a typo'd unit id has to fail here
  // and say so. Walking off the end of the chain instead would mark every lesson
  // complete and leave the flow to fail later on a confusingly wrong screen.
  test('an unknown unit id fails loud rather than completing the whole curriculum', () => {
    const store = new ProgressStore();
    expect(() => seedProgressToUnit(store, LESSONS, 'intervalz', AT)).toThrow(/unknown unit "intervalz"/);
    expect(Object.values(store.toSnapshot().lessons).filter((l) => l.completed)).toHaveLength(0);
  });

  test('onboards and unlocks the target (intervals) without completing it', () => {
    const store = new ProgressStore();
    seedProgressToUnit(store, LESSONS, 'intervals', AT);

    expect(store.isOnboarded()).toBe(true);
    expect(store.getGrade()).toBe(1);
    expect(store.isUnlocked('intervals')).toBe(true);
    expect(store.getLesson('intervals').completed).toBe(false); // ready to play, not done
  });

  test('every lesson before the target is marked complete; the target and beyond are not', () => {
    const store = new ProgressStore();
    seedProgressToUnit(store, LESSONS, 'key-signatures', AT);

    // Predecessors in the chain are complete.
    for (const id of ['treble-notes', 'bass-notes', 'accidentals', 'note-values']) {
      expect(store.getLesson(id).completed).toBe(true);
    }
    // The target and its successor are not complete.
    expect(store.getLesson('key-signatures').completed).toBe(false);
    expect(store.getLesson('intervals').completed).toBe(false);
  });

  test('seedExamReady masters every unit so the Level 1 exam gate unlocks', () => {
    const store = new ProgressStore();
    seedExamReady(store, LESSONS, AT);

    const level1 = LEVELS.find((l) => l.grade === 1)!; // Level 1 is unconditionally unlocked (D5)
    const rows = unitStates(level1.unitIds, store, (id) => lessonById(id)?.atoms ?? []);
    const earned = rows.reduce((sum, r) => sum + r.stars, 0);

    // The gate unlocks when earned stars reach the level's threshold.
    expect(earned).toBeGreaterThanOrEqual(level1.examGate.unlockAtStars);
    expect(store.isOnboarded()).toBe(true);
  });

  test('seeding to the root unit unlocks it and completes nothing', () => {
    const store = new ProgressStore();
    const root = LESSONS.find((l) => !LESSONS.some((o) => o.unlocks === l.id))!;
    seedProgressToUnit(store, LESSONS, root.id, AT);

    expect(store.isUnlocked(root.id)).toBe(true);
    expect(store.getLesson(root.id).completed).toBe(false);
    expect(Object.values(store.toSnapshot().lessons).filter((l) => l.completed)).toHaveLength(0);
  });
});
