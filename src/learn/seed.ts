// DEV / E2E test seam (302.5). Fast-forwards progress so a target unit is unlocked
// and ready to play, skipping the linear unlock grind — the prerequisite for
// on-device Maestro coverage of interactions deep in the chain (302.6). Pure and
// storage-agnostic; the DEV-only wiring that calls it lives in useProgress +
// RootRouter behind a __DEV__ deep link.

import type { Lesson } from '../content/lessons';
import { initialSrs } from './srs';
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
 *
 *  An unknown `targetId` throws. This is the determinism seam the E2E flows steer
 *  with, so a typo'd unit id in a `.maestro` flow must fail here and say so —
 *  walking the chain past the end would instead complete the entire curriculum and
 *  leave the flow to fail later on a confusingly wrong screen. */
export function seedProgressToUnit(
  store: ProgressStore,
  lessons: Lesson[],
  targetId: string,
  onboardedAt: string,
): void {
  if (!lessons.some((l) => l.id === targetId)) {
    throw new Error(`seed: unknown unit "${targetId}" (expected one of ${lessons.map((l) => l.id).join(', ')})`);
  }

  store.setProfile({ grade: 1, onboardedAt });

  let cursor = rootLesson(lessons);
  if (cursor) store.unlock(cursor.id); // the root is always reachable
  while (cursor && cursor.id !== targetId) {
    store.setLesson(cursor.id, { completed: true });
    if (cursor.unlocks) store.unlock(cursor.unlocks);
    cursor = cursor.unlocks ? lessons.find((l) => l.id === cursor!.unlocks) : undefined;
  }
}

/** Onboard (Grade 1) and master every lesson + atom (3★ across the board) so the
 *  exam gate unlocks — the seam to reach the practice exam (302.2) in an E2E
 *  without grinding every set to full mastery. */
export function seedExamReady(store: ProgressStore, lessons: Lesson[], onboardedAt: string): void {
  store.setProfile({ grade: 1, onboardedAt });
  for (const lesson of lessons) {
    store.unlock(lesson.id);
    store.setLesson(lesson.id, { completed: true });
    if (lesson.unlocks) store.unlock(lesson.unlocks);
    for (const atom of lesson.atoms) {
      store.setAtom(atom, { mastery: { streak: 3, mastered: true }, srs: initialSrs() });
    }
  }
}
