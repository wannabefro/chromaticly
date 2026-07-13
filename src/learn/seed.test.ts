// 302.5: the seeding seam unlocks a target unit without completing it, so an E2E
// can jump straight to a deep interaction. Guards the invariant the Maestro
// coverage (302.6) relies on: target unlocked + playable, predecessors complete.

import { LESSONS } from '../content/lessons';
import { seedProgressToUnit } from './seed';
import { ProgressStore } from './store';

const AT = '2026-07-13T00:00:00.000Z';

describe('seedProgressToUnit — fast-forward to a target unit (302.5)', () => {
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

  test('seeding to the root unit unlocks it and completes nothing', () => {
    const store = new ProgressStore();
    const root = LESSONS.find((l) => !LESSONS.some((o) => o.unlocks === l.id))!;
    seedProgressToUnit(store, LESSONS, root.id, AT);

    expect(store.isUnlocked(root.id)).toBe(true);
    expect(store.getLesson(root.id).completed).toBe(false);
    expect(Object.values(store.toSnapshot().lessons).filter((l) => l.completed)).toHaveLength(0);
  });
});
