// Learn-path progression (U11): ties mastery + SRS + persistence to the lesson
// graph. `applyAttempt` is the pure reducer — record an attempt, update the
// atom's mastery/SRS, and when every atom in the lesson is mastered mark it
// complete. `useProgress` is the thin React hook
// that loads the store, runs the reducer, and persists after each attempt.

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Lesson } from '../content/lessons';
import type { AttemptResult } from '../ui/grading';
import type { Band } from './exam';
import { lessonComplete, recordAttempt, recordFlashcardGrade } from './mastery';
import { reviewSrs, reviewSrsGraded, type SrsGrade } from './srs';
import { seedExamReady, seedProgressToUnit } from './seed';
import { defaultClock, type Clock } from './clock';
import { loadProgress, ProgressStore, saveProgress, type Profile, type SnapshotStorage } from './store';

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

/** Mark a lesson complete and count the play. Returns true only on the FIRST
 *  completion, so callers can fire a completion reaction exactly once.
 *
 *  The two halves behave differently on purpose. `completed` is a one-way latch;
 *  `plays` increments every time, including on a replay of a finished lesson,
 *  because it is the seed offset the next set is built from. An early return on
 *  `completed` — which is what this did before — is exactly what froze every
 *  lesson at the same eight questions.
 *
 *  Since G6 U3 it no longer writes an unlock: nothing is hard-locked (R2), and
 *  `lesson.unlocks` survives only as the authored ordering. */
export function completeLesson(store: ProgressStore, lesson: Lesson): boolean {
  const before = store.getLesson(lesson.id);
  store.setLesson(lesson.id, { completed: true, plays: (before.plays ?? 0) + 1 });
  return !before.completed;
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
  /** Mark a lesson complete and persist; true on transition. */
  complete: (lesson: Lesson) => Promise<boolean>;
  isLessonComplete: (lessonId: string) => boolean;
  /** Whether the lesson's did-you-know fact card (design 4b) has been collected. */
  isFactCollected: (lessonId: string) => boolean;
  /** Collect the lesson's fact card into the collection and persist (302.3.4). */
  collectFact: (lessonId: string) => Promise<void>;
  profile: Profile | null;
  isOnboarded: boolean;
  /** The selected grade once onboarded, else null. */
  grade: number | null;
  /** The account display name once set (design 6b), else null. */
  name: string | null;
  /** Whether the learner has a named account (design 6b). */
  isNamed: boolean;
  /** Whether the guest→account nudge (design 6c) has been shown+actioned — once-only. */
  nudgeSeen: boolean;
  /** How many lessons are completed — the "three lessons in" trigger (design 6c).
   *  A callback (revision-gated) so callers read a fresh count after a completion. */
  completedLessonCount: () => number;
  /** Upgrade the profile Guest→named with a display name and persist (design 6b). */
  createAccount: (name: string) => Promise<void>;
  /** Mark the account nudge shown+actioned and persist — once-only (design 6c). */
  markNudgeSeen: () => Promise<void>;
  /** Persist the onboarding profile (selected grade + completion timestamp). Birth
   *  year is no longer captured here — it's deferred to account creation (U1/KTD1). */
  completeOnboarding: (grade: number, onboardedAt: string) => Promise<void>;
  /** Switch the working grade (free grade access, fyu.3). Replaces the profile
   *  with a fresh object that keeps every other field (name, onboardedAt,
   *  birthYear) and only changes `grade`; persists and mirrors to real state so
   *  the grade pill, readiness, and level map react. No-op pre-onboarding. */
  setGrade: (grade: number) => Promise<void>;
  /** The shared learning clock (G6 U1) — whole days since the epoch. Screens read
   *  `clock.now()` for the SRS `now` argument instead of the per-screen tick
   *  counters they used to keep, so scheduling survives an app restart. */
  clock: Clock;
  /** DEV/E2E seam (302.5): fast-forward progress so `targetId` is reachable and
   *  ready to play, then persist. Only ever called behind a __DEV__ deep link.
   *
   *  `staleDays` back-dates the seeded reviews by that many days, which is the
   *  only way to reach a DECAYED lane on device (R5, chromaticly-cel): the seed
   *  otherwise stamps every atom as reviewed today, so nothing is ever stale and
   *  the slipped bar can never be seen. */
  seedTo: (targetId: string, staleDays?: number) => Promise<void>;
  /** Record a practice-exam result for `grade` (D7). A band ≥ pass clears the
   *  exam (`store.isExamCleared(grade)`); `'below'` records nothing. Idempotent
   *  by set semantics — a
   *  replayed or double-fired result is harmless. */
  recordExamResult: (grade: number, band: Band) => Promise<void>;
}

export function useProgress(storage: SnapshotStorage, lessons: Lesson[], clock: Clock = defaultClock): UseProgress {
  const [store, setStore] = useState<ProgressStore | null>(null);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  // The onboarding profile is mirrored into real React state, not read from the
  // mutable store in render. React Compiler (on in the app bundle, off in jest)
  // infers a memo's deps from the callback body, so a store read memoizes on the
  // store's identity — which never changes under in-place mutation — and goes
  // stale. Genuine state is the only reliable change signal for the compiler.
  const [profile, setProfileState] = useState<Profile | null>(null);
  // The nudge-seen flag lives outside the profile, so it gets its own mirror (same
  // React Compiler rationale as `profile` above). The name rides along on `profile`.
  const [nudgeSeen, setNudgeSeen] = useState(false);

  useEffect(() => {
    let live = true;
    loadProgress(storage, clock.now()).then((loaded) => {
      if (!live) return;
      setStore(loaded);
      setProfileState(loaded.getProfile());
      setNudgeSeen(loaded.isNudgeSeen());
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [storage, lessons, clock]);

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

  const createAccount = useCallback<UseProgress['createAccount']>(
    async (name) => {
      if (!store) return;
      store.setName(name);
      await saveProgress(store, storage);
      setProfileState(store.getProfile()); // real state → ProfileScreen shows the name
      setRevision((r) => r + 1);
    },
    [store, storage],
  );

  const markNudgeSeen = useCallback<UseProgress['markNudgeSeen']>(async () => {
    if (!store || store.isNudgeSeen()) return;
    store.markNudgeSeen();
    await saveProgress(store, storage);
    setNudgeSeen(true);
    setRevision((r) => r + 1);
  }, [store, storage]);

  // Read imperatively (after an awaited completion) or revision-gated — never memoized
  // stale, since the count reflects in-place lesson mutations the revision bump signals.
  const completedLessonCount = useCallback(() => store?.completedLessonCount() ?? 0, [store, revision]);

  const seedTo = useCallback<UseProgress['seedTo']>(
    async (targetId, staleDays = 0) => {
      if (!store) return;
      const at = new Date().toISOString();
      // The seed writes its reviews at `reviewedAt`, and the app then reads them at
      // `clock.now()`. Equal by default; `staleDays` apart when the flow wants decay.
      const reviewedAt = clock.now() - staleDays;
      if (targetId === 'exam') seedExamReady(store, lessons, at, reviewedAt);
      else seedProgressToUnit(store, lessons, targetId, at, reviewedAt);
      await saveProgress(store, storage);
      setProfileState(store.getProfile()); // real state → onboarded flips (KTD5)
      setRevision((r) => r + 1);
    },
    [store, storage, lessons, clock],
  );

  const recordExamResult = useCallback<UseProgress['recordExamResult']>(
    async (grade, band) => {
      if (!store || band === 'below') return;
      store.recordExamCleared(grade);
      await saveProgress(store, storage);
      setRevision((r) => r + 1);
    },
    [store, storage, lessons, clock],
  );

  const setGrade = useCallback<UseProgress['setGrade']>(
    async (nextGrade) => {
      if (!store) return;
      const current = store.getProfile();
      if (!current) return; // grade switch is a post-onboarding action
      // Fresh object preserving every other profile field (KTD5) — never an
      // in-place mutation of the mirrored `grade`, which would go stale on device.
      const next: Profile = { ...current, grade: nextGrade };
      store.setProfile(next);
      await saveProgress(store, storage);
      setProfileState(next);
      setRevision((r) => r + 1);
    },
    [store, storage],
  );

  const isOnboarded = profile !== null;
  const grade = profile?.grade ?? null;
  const name = profile?.name ?? null;
  const isNamed = name != null && name !== '';

  return useMemo(
    () => ({
      ready,
      store,
      revision,
      recordAtom,
      recordFlashcardGrade: recordFlashcardGradeCb,
      complete,
      isLessonComplete,
      isFactCollected,
      collectFact,
      profile,
      isOnboarded,
      grade,
      name,
      isNamed,
      nudgeSeen,
      clock,
      completedLessonCount,
      createAccount,
      markNudgeSeen,
      completeOnboarding,
      setGrade,
      seedTo,
      recordExamResult,
    }),
    [
      ready,
      store,
      revision,
      recordAtom,
      recordFlashcardGradeCb,
      complete,
      isLessonComplete,
      isFactCollected,
      collectFact,
      profile,
      isOnboarded,
      grade,
      name,
      isNamed,
      nudgeSeen,
      clock,
      completedLessonCount,
      createAccount,
      markNudgeSeen,
      completeOnboarding,
      setGrade,
      seedTo,
      recordExamResult,
    ],
  );
}
