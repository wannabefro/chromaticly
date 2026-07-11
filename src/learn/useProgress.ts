// Learn-path progression (U11): ties mastery + SRS + persistence to the lesson
// graph. `applyAttempt` is the pure reducer — record an attempt, update the
// atom's mastery/SRS, and when every atom in the lesson is mastered mark it
// complete and unlock its `unlocks` target. `useProgress` is the thin React hook
// that loads the store, runs the reducer, and persists after each attempt.

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Lesson } from '../content/lessons';
import type { AttemptResult } from '../ui/grading';
import { lessonComplete, recordAttempt } from './mastery';
import { reviewSrs } from './srs';
import { loadProgress, ProgressStore, saveProgress, type SnapshotStorage } from './store';

/** Ensure the entry lesson is always reachable, even on a fresh store. */
export function ensureRootUnlocked(store: ProgressStore, lessons: Lesson[]): void {
  const unlockedTargets = new Set(lessons.map((l) => l.unlocks).filter((id): id is string => id !== null));
  const root = lessons.find((l) => !unlockedTargets.has(l.id));
  if (root && !store.isUnlocked(root.id)) store.unlock(root.id);
}

/** Fold one graded attempt on `atom` (belonging to `lesson`) into the store, at
 *  logical time `now`. Mutates the store; returns whether the lesson just
 *  completed so callers can react (e.g. surface an unlock). */
export function applyAttempt(
  store: ProgressStore,
  lesson: Lesson,
  atom: string,
  attempt: Pick<AttemptResult, 'correct' | 'hintsUsed'>,
  now: number,
): { lessonJustCompleted: boolean } {
  const before = store.getAtom(atom);
  store.setAtom(atom, {
    mastery: recordAttempt(before.mastery, attempt),
    srs: reviewSrs(before.srs, attempt.correct, now),
  });

  const wasComplete = store.getLesson(lesson.id).completed;
  const nowComplete = lessonComplete(lesson.atoms, (a) => store.masteryOf(a));

  if (nowComplete && !wasComplete) {
    store.setLesson(lesson.id, { completed: true });
    if (lesson.unlocks) store.unlock(lesson.unlocks);
    return { lessonJustCompleted: true };
  }
  return { lessonJustCompleted: false };
}

export interface UseProgress {
  ready: boolean;
  store: ProgressStore | null;
  /** Record an attempt and persist; returns the applyAttempt outcome. */
  record: (lesson: Lesson, atom: string, attempt: AttemptResult, now: number) => Promise<{ lessonJustCompleted: boolean }>;
  isUnlocked: (lessonId: string) => boolean;
}

export function useProgress(storage: SnapshotStorage, lessons: Lesson[]): UseProgress {
  const [store, setStore] = useState<ProgressStore | null>(null);
  const [ready, setReady] = useState(false);
  // Bump to force consumers to re-read the (mutable) store after a write.
  const [, setRevision] = useState(0);

  useEffect(() => {
    let live = true;
    loadProgress(storage).then((loaded) => {
      if (!live) return;
      ensureRootUnlocked(loaded, lessons);
      setStore(loaded);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [storage, lessons]);

  const record = useCallback<UseProgress['record']>(
    async (lesson, atom, attempt, now) => {
      if (!store) return { lessonJustCompleted: false };
      const outcome = applyAttempt(store, lesson, atom, attempt, now);
      await saveProgress(store, storage);
      setRevision((r) => r + 1);
      return outcome;
    },
    [store, storage],
  );

  const isUnlocked = useCallback((lessonId: string) => store?.isUnlocked(lessonId) ?? false, [store]);

  return useMemo(() => ({ ready, store, record, isUnlocked }), [ready, store, record, isUnlocked]);
}
