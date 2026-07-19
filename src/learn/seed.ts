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

/** Unlock, complete, and 3★-master every lesson (and atom) in `gradeLessons` — the
 *  shared per-grade mastery body. Used both to ready a grade's exam gate
 *  (`seedExamReady`) and to fast-forward an already-cleared prerequisite grade en
 *  route to a later grade's target (`seedProgressToUnit`). */
function masterGrade(store: ProgressStore, gradeLessons: Lesson[]): void {
  for (const lesson of gradeLessons) {
    store.unlock(lesson.id);
    store.setLesson(lesson.id, { completed: true });
    if (lesson.unlocks) store.unlock(lesson.unlocks);
    for (const atom of lesson.atoms) {
      store.setAtom(atom, { mastery: { streak: 3, mastered: true }, srs: initialSrs() });
    }
  }
}

/** Onboard and fast-forward to `targetId`, generalized across grades: every grade
 *  below the target's mastered end-to-end (unlocked/completed/3★, exam recorded
 *  cleared — the state honest play reaches by clearing that grade's exam), then the
 *  target's own grade is walked from its chain root, marking each lesson before
 *  `targetId` complete — which unlocks the next in the linear chain — so `targetId`
 *  ends up unlocked but NOT completed, ready to enter. Storage-agnostic and
 *  self-contained (mutates the store directly, no useProgress dependency, to keep
 *  this leaf module cycle-free).
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
  const target = lessons.find((l) => l.id === targetId);
  if (!target) {
    throw new Error(`seed: unknown unit "${targetId}" (expected one of ${lessons.map((l) => l.id).join(', ')})`);
  }

  store.setProfile({ grade: 1, onboardedAt });

  for (let grade = 1; grade < target.grade; grade++) {
    masterGrade(store, lessons.filter((l) => l.grade === grade));
    store.recordExamCleared(grade);
  }

  const targetGradeLessons = lessons.filter((l) => l.grade === target.grade);
  let cursor = rootLesson(targetGradeLessons);
  if (cursor) store.unlock(cursor.id); // the root is always reachable
  while (cursor && cursor.id !== targetId) {
    store.setLesson(cursor.id, { completed: true });
    if (cursor.unlocks) store.unlock(cursor.unlocks);
    cursor = cursor.unlocks ? targetGradeLessons.find((l) => l.id === cursor!.unlocks) : undefined;
  }
}

/** Onboard (Grade 1) and master every GRADE-1 lesson + atom (3★ across the board) so
 *  the Level 1 exam gate unlocks — the seam to reach the practice exam (302.2) in an
 *  E2E without grinding every set to full mastery. Scoped to grade 1 regardless of
 *  what `lessons` contains: 'exam' means "the gate is open, the paper isn't taken
 *  yet", so it must not master grade-2 content or unlock/clear anything past the
 *  Level 1 gate — that would fabricate a cleared exam this seed never runs. */
export function seedExamReady(store: ProgressStore, lessons: Lesson[], onboardedAt: string): void {
  store.setProfile({ grade: 1, onboardedAt });
  masterGrade(store, lessons.filter((l) => l.grade === 1));
}
