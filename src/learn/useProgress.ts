// Learn-path progression (U11): ties mastery + SRS + persistence to the lesson
// graph. `applyAttempt` is the pure reducer — record an attempt, update the
// atom's mastery/SRS, and when every atom in the lesson is mastered mark it
// complete and unlock its `unlocks` target. `useProgress` is the thin React hook
// that loads the store, runs the reducer, and persists after each attempt.

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Lesson } from '../content/lessons';
import type { AttemptResult } from '../ui/grading';
import { lessonComplete, recordAttempt, recordFlashcardGrade } from './mastery';
import { reviewSrs, reviewSrsGraded, type SrsGrade } from './srs';
import { seedExamReady, seedProgressToUnit } from './seed';
import { loadProgress, ProgressStore, saveProgress, type Profile, type SnapshotStorage } from './store';

/** Ensure the entry lesson is always reachable, even on a fresh store. */
export function ensureRootUnlocked(store: ProgressStore, lessons: Lesson[]): void {
  const unlockedTargets = new Set(lessons.map((l) => l.unlocks).filter((id): id is string => id !== null));
  const root = lessons.find((l) => !unlockedTargets.has(l.id));
  if (root && !store.isUnlocked(root.id)) store.unlock(root.id);
}

/** Fold one graded attempt on `atom` into the store's mastery + SRS state at
 *  logical time `now`. Lesson-agnostic — Practice records atoms with no lesson. */
export function recordAtomAttempt(
  store: ProgressStore,
  atom: string,
  attempt: Pick<AttemptResult, 'correct' | 'hintsUsed'>,
  now: number,
): void {
  const before = store.getAtom(atom);
  store.setAtom(atom, {
    mastery: recordAttempt(before.mastery, attempt),
    srs: reviewSrs(before.srs, attempt.correct, now),
  });
}

/** Fold one self-graded flashcard review on `atom` into the store's mastery
 *  (AD4b mapping) + graded-SRS state at logical time `now`. The flashcard
 *  counterpart to `recordAtomAttempt` — no correct/incorrect verdict, just a
 *  grade. */
export function recordAtomFlashcardGrade(store: ProgressStore, atom: string, grade: SrsGrade, now: number): void {
  const before = store.getAtom(atom);
  store.setAtom(atom, {
    mastery: recordFlashcardGrade(before.mastery, grade),
    srs: reviewSrsGraded(before.srs, grade, now),
  });
}

/** Mark a lesson complete and unlock its target. Idempotent — returns true only
 *  on the transition, so callers can fire an unlock reaction exactly once. */
export function completeLesson(store: ProgressStore, lesson: Lesson): boolean {
  if (store.getLesson(lesson.id).completed) return false;
  store.setLesson(lesson.id, { completed: true });
  if (lesson.unlocks) store.unlock(lesson.unlocks);
  return true;
}

/** Fold one graded attempt on `atom` (belonging to `lesson`) into the store, at
 *  logical time `now`, auto-completing the lesson if every atom is now mastered.
 *  Mutates the store; returns whether the lesson just completed. */
export function applyAttempt(
  store: ProgressStore,
  lesson: Lesson,
  atom: string,
  attempt: Pick<AttemptResult, 'correct' | 'hintsUsed'>,
  now: number,
): { lessonJustCompleted: boolean } {
  recordAtomAttempt(store, atom, attempt, now);
  if (lessonComplete(lesson.atoms, (a) => store.masteryOf(a))) {
    return { lessonJustCompleted: completeLesson(store, lesson) };
  }
  return { lessonJustCompleted: false };
}

export interface UseProgress {
  ready: boolean;
  store: ProgressStore | null;
  /** Monotonic counter bumped after every mutation, so consumers re-read the
   *  (mutable) store. */
  revision: number;
  /** Record one attempt on an atom and persist. */
  recordAtom: (atom: string, attempt: AttemptResult, now: number) => Promise<void>;
  /** Record one self-graded flashcard review (Again/Hard/Good/Easy) on an atom
   *  and persist — the flashcard counterpart to `recordAtom` (AD4b). */
  recordFlashcardGrade: (atom: string, grade: SrsGrade, now: number) => Promise<void>;
  /** Mark a lesson complete + unlock its target and persist; true on transition. */
  complete: (lesson: Lesson) => Promise<boolean>;
  isUnlocked: (lessonId: string) => boolean;
  isLessonComplete: (lessonId: string) => boolean;
  /** Whether the lesson's did-you-know fact card (design 4b) has been collected. */
  isFactCollected: (lessonId: string) => boolean;
  /** Collect the lesson's fact card into the collection and persist (302.3.4). */
  collectFact: (lessonId: string) => Promise<void>;
  profile: Profile | null;
  isOnboarded: boolean;
  /** The selected grade once onboarded, else null. */
  grade: number | null;
  /** Persist the onboarding profile (selected grade + completion timestamp). Birth
   *  year is no longer captured here — it's deferred to account creation (U1/KTD1). */
  completeOnboarding: (grade: number, onboardedAt: string) => Promise<void>;
  /** DEV/E2E seam (302.5): fast-forward progress so `targetId` is unlocked and
   *  ready to play, then persist. Only ever called behind a __DEV__ deep link. */
  seedTo: (targetId: string) => Promise<void>;
}

export function useProgress(storage: SnapshotStorage, lessons: Lesson[]): UseProgress {
  const [store, setStore] = useState<ProgressStore | null>(null);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  // The onboarding profile is mirrored into real React state, not read from the
  // mutable store in render. React Compiler (on in the app bundle, off in jest)
  // infers a memo's deps from the callback body, so a store read memoizes on the
  // store's identity — which never changes under in-place mutation — and goes
  // stale. Genuine state is the only reliable change signal for the compiler.
  const [profile, setProfileState] = useState<Profile | null>(null);

  useEffect(() => {
    let live = true;
    loadProgress(storage).then((loaded) => {
      if (!live) return;
      ensureRootUnlocked(loaded, lessons);
      setStore(loaded);
      setProfileState(loaded.getProfile());
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [storage, lessons]);

  const recordAtom = useCallback<UseProgress['recordAtom']>(
    async (atom, attempt, now) => {
      if (!store) return;
      recordAtomAttempt(store, atom, attempt, now);
      await saveProgress(store, storage);
      setRevision((r) => r + 1);
    },
    [store, storage],
  );

  const recordFlashcardGradeCb = useCallback<UseProgress['recordFlashcardGrade']>(
    async (atom, grade, now) => {
      if (!store) return;
      recordAtomFlashcardGrade(store, atom, grade, now);
      await saveProgress(store, storage);
      setRevision((r) => r + 1);
    },
    [store, storage],
  );

  const complete = useCallback<UseProgress['complete']>(
    async (lesson) => {
      if (!store) return false;
      const transitioned = completeLesson(store, lesson);
      if (transitioned) {
        await saveProgress(store, storage);
        setRevision((r) => r + 1);
      }
      return transitioned;
    },
    [store, storage],
  );

  // These lookups read the mutable store, so under React Compiler they can serve a
  // stale result after a mutation (the store's identity never changes). They're
  // only consumed by the legacy learn-map, which remounts on navigation and so
  // re-reads fresh; the in-session slice paths never depend on their reactivity.
  // The onboarding/set flows use real state (`profile`) and local component state
  // instead — see completeOnboarding below and SetRunner.
  const isUnlocked = useCallback((lessonId: string) => store?.isUnlocked(lessonId) ?? false, [store, revision]);
  const isLessonComplete = useCallback((lessonId: string) => store?.getLesson(lessonId).completed ?? false, [store, revision]);
  const isFactCollected = useCallback((lessonId: string) => store?.isFactCollected(lessonId) ?? false, [store, revision]);

  const collectFact = useCallback<UseProgress['collectFact']>(
    async (lessonId) => {
      if (!store || store.isFactCollected(lessonId)) return;
      store.collectFact(lessonId);
      await saveProgress(store, storage);
      setRevision((r) => r + 1);
    },
    [store, storage],
  );

  const completeOnboarding = useCallback<UseProgress['completeOnboarding']>(
    async (grade, onboardedAt) => {
      if (!store) return;
      const next: Profile = { grade, onboardedAt };
      store.setProfile(next);
      await saveProgress(store, storage);
      setProfileState(next); // real state → RootRouter reactively sees isOnboarded flip
      setRevision((r) => r + 1);
    },
    [store, storage],
  );

  const seedTo = useCallback<UseProgress['seedTo']>(
    async (targetId) => {
      if (!store) return;
      const at = new Date().toISOString();
      if (targetId === 'exam') seedExamReady(store, lessons, at);
      else seedProgressToUnit(store, lessons, targetId, at);
      await saveProgress(store, storage);
      setProfileState(store.getProfile()); // real state → onboarded flips (KTD5)
      setRevision((r) => r + 1);
    },
    [store, storage, lessons],
  );

  const isOnboarded = profile !== null;
  const grade = profile?.grade ?? null;

  return useMemo(
    () => ({
      ready,
      store,
      revision,
      recordAtom,
      recordFlashcardGrade: recordFlashcardGradeCb,
      complete,
      isUnlocked,
      isLessonComplete,
      isFactCollected,
      collectFact,
      profile,
      isOnboarded,
      grade,
      completeOnboarding,
      seedTo,
    }),
    [
      ready,
      store,
      revision,
      recordAtom,
      recordFlashcardGradeCb,
      complete,
      isUnlocked,
      isLessonComplete,
      isFactCollected,
      collectFact,
      profile,
      isOnboarded,
      grade,
      completeOnboarding,
      seedTo,
    ],
  );
}
