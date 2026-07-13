// DEV / E2E test seam (302.5). Fast-forwards progress so a target unit is unlocked
// and ready to play, skipping the linear unlock grind — the prerequisite for
// on-device Maestro coverage of interactions deep in the chain (302.6). Pure and
// storage-agnostic; the DEV-only wiring that calls it lives in useProgress +
// RootRouter behind a __DEV__ deep link.

import type { Lesson } from '../content/lessons';
import type { ProgressStore } from './store';

/** The chain root: the one lesson no other lesson unlocks. */
function rootLesson(lessons: Lesson[]): Lesson | undefined {
  const unlocked = new Set(lessons.map((l) => l.unlocks).filter((id): id is string => id !== null));
  return lessons.find((l) => !unlocked.has(l.id));
}

/** Onboard (Grade 1) and mark every lesson before `targetId` complete — which
 *  unlocks the next in the linear chain — so `targetId` ends up unlocked but NOT
 *  completed, ready to enter. Storage-agnostic and self-contained (mutates the
 *  store directly, no useProgress dependency, to keep this leaf module cycle-free).
 *  An unknown `targetId` leaves the chain fully completed rather than throwing. */
export function seedProgressToUnit(
  store: ProgressStore,
  lessons: Lesson[],
  targetId: string,
  onboardedAt: string,
): void {
  store.setProfile({ grade: 1, onboardedAt });

  let cursor = rootLesson(lessons);
  if (cursor) store.unlock(cursor.id); // the root is always reachable
  while (cursor && cursor.id !== targetId) {
    store.setLesson(cursor.id, { completed: true });
    if (cursor.unlocks) store.unlock(cursor.unlocks);
    cursor = cursor.unlocks ? lessons.find((l) => l.id === cursor!.unlocks) : undefined;
  }
}
