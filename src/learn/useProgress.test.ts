import { renderHook, waitFor } from '@testing-library/react-native';

import type { Lesson } from '../content/lessons';
import { selectDue } from './srs';
import { ProgressStore, type SnapshotStorage } from './store';
import { applyAttempt, ensureLevelRootsUnlocked, recordAtomFlashcardGrade, useProgress } from './useProgress';

/** In-memory SnapshotStorage, mirroring store.test.ts's fake. */
function memoryStorage(): SnapshotStorage & { blob: string | null } {
  return {
    blob: null as string | null,
    async load() {
      return this.blob;
    },
    async save(serialized: string) {
      this.blob = serialized;
    },
  };
}

const lessonA: Lesson = {
  id: 'a',
  title: 'A',
  strand: 'pitch',
  atoms: ['x', 'y'],
  templates: ['note_naming'],
  unlocks: 'b',
  grade: 1,
};
const lessonB: Lesson = { ...lessonA, id: 'b', atoms: ['z'], unlocks: null };

// A single-lesson grade-2 chain, mirroring the real key-signatures-2 shape
// (one unit, unlocks: null) — enough to exercise the second grade's root.
const lessonG2: Lesson = { id: 'g2a', title: 'G2A', strand: 'scales_keys', atoms: ['g2:x'], templates: ['key_signature_id'], unlocks: null, grade: 2 };

const correct = { correct: true, hintsUsed: 0 };

function masterAtom(store: ProgressStore, lesson: Lesson, atom: string, startTick: number): number {
  let now = startTick;
  for (let i = 0; i < 3; i++) applyAttempt(store, lesson, atom, correct, now++);
  return now;
}

describe('progression — ensureLevelRootsUnlocked (D6, U5)', () => {
  test('unlocks the single entry lesson and nothing downstream', () => {
    const store = new ProgressStore();
    ensureLevelRootsUnlocked(store, [lessonA, lessonB]);
    expect(store.isUnlocked('a')).toBe(true);
    expect(store.isUnlocked('b')).toBe(false);
  });

  // fyu.2: free grade access unlocks EVERY grade's root by content presence —
  // the isExamCleared(grade-1) gate is gone, so the grade-2 chain root opens
  // on a fresh store right alongside grade-1's.
  test('on a fresh store every grade\'s root unlocks — no exam gate blocks the grade-2 chain', () => {
    const store = new ProgressStore();
    ensureLevelRootsUnlocked(store, [lessonA, lessonB, lessonG2]);
    expect(store.isUnlocked('a')).toBe(true);
    expect(store.isUnlocked('g2a')).toBe(true);
  });

  test('a restored snapshot missing the grade-2 root self-heals on the next run, independent of exam state', () => {
    const store = new ProgressStore();
    expect(store.isUnlocked('g2a')).toBe(false); // not yet re-derived, no exam recorded either

    ensureLevelRootsUnlocked(store, [lessonA, lessonB, lessonG2]);
    expect(store.isUnlocked('g2a')).toBe(true);
  });
});

describe('progression — a lesson completes only when all its atoms are mastered, then unlocks the next', () => {
  test('mastering every atom marks the lesson done and unlocks its target', () => {
    const store = new ProgressStore();
    ensureLevelRootsUnlocked(store, [lessonA, lessonB]);

    let now = masterAtom(store, lessonA, 'x', 0);
    // Only one of two atoms mastered → not complete, next still locked.
    expect(store.getLesson('a').completed).toBe(false);
    expect(store.isUnlocked('b')).toBe(false);

    masterAtom(store, lessonA, 'y', now);
    expect(store.getLesson('a').completed).toBe(true);
    expect(store.isUnlocked('b')).toBe(true);
  });

  test('the completion transition fires exactly once', () => {
    const store = new ProgressStore();
    masterAtom(store, lessonA, 'x', 0);
    const beforeLast = masterAtom(store, lessonA, 'y', 10);
    // 'a' is already complete now; a further attempt reports no new completion.
    const outcome = applyAttempt(store, lessonA, 'x', correct, beforeLast);
    expect(outcome.lessonJustCompleted).toBe(false);
  });
});

describe('progression — Practice eligibility respects lesson unlock state', () => {
  test('selectDue over unlocked-lesson atoms never serves an atom from a locked lesson', () => {
    const store = new ProgressStore();
    ensureLevelRootsUnlocked(store, [lessonA, lessonB]);
    // Touch atoms from both lessons so they have SRS state and are due.
    applyAttempt(store, lessonA, 'x', { correct: false, hintsUsed: 0 }, 0);
    applyAttempt(store, lessonB, 'z', { correct: false, hintsUsed: 0 }, 0);

    const unlockedAtoms = new Set(
      [lessonA, lessonB].filter((l) => store.isUnlocked(l.id)).flatMap((l) => l.atoms),
    );
    const served = selectDue(store.atomEntries(), 0, (atom) => unlockedAtoms.has(atom));

    expect(served).toContain('x'); // from unlocked lesson A
    expect(served).not.toContain('z'); // from still-locked lesson B
  });
});

describe('progression — recordAtomFlashcardGrade (U6/AD4b): the flashcard counterpart to recordAtomAttempt', () => {
  test('grading a term flashcard "good" three times masters the atom and schedules it via the graded SRS path', () => {
    const store = new ProgressStore();
    let now = 0;
    for (let i = 0; i < 3; i++) recordAtomFlashcardGrade(store, 'term:staccato', 'good', now++);

    expect(store.masteryOf('term:staccato')?.mastered).toBe(true);
    const srs = store.getAtom('term:staccato').srs;
    expect(srs.ease).toBeDefined();
    expect(srs.nextDue).toBeGreaterThan(now - 1); // rescheduled into the future, not left due-now
  });

  test('"again" never masters the atom and reschedules it due immediately', () => {
    const store = new ProgressStore();
    recordAtomFlashcardGrade(store, 'term:legato', 'again', 10);
    expect(store.masteryOf('term:legato')?.mastered).toBe(false);
    expect(store.getAtom('term:legato').srs.nextDue).toBe(10);
  });
});

describe('useProgress — onboarding (KTD4 profile persistence)', () => {
  test('isOnboarded is false until completeOnboarding, then persists across a reload', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB]));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isOnboarded).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(result.current.grade).toBeNull();

    await result.current.completeOnboarding(1, '2026-07-12T00:00:00.000Z');

    await waitFor(() => expect(result.current.isOnboarded).toBe(true));
    expect(result.current.profile).toEqual({ grade: 1, onboardedAt: '2026-07-12T00:00:00.000Z' });
    expect(result.current.grade).toBe(1);

    // Reload from the same underlying storage — profile must have been persisted, not just in-memory.
    const reloaded = new ProgressStore(JSON.parse(storage.blob as string));
    expect(reloaded.isOnboarded()).toBe(true);
    expect(reloaded.getProfile()).toEqual({ grade: 1, onboardedAt: '2026-07-12T00:00:00.000Z' });
  });
});

describe('useProgress — account name + nudge-seen (design 6b/6c, 302.9/302.13)', () => {
  async function onboarded(storage: SnapshotStorage) {
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB]));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await result.current.completeOnboarding(1, '2026-07-18T00:00:00.000Z');
    await waitFor(() => expect(result.current.isOnboarded).toBe(true));
    return result;
  }

  test('createAccount names the profile, persists, and flips isNamed (no stale read)', async () => {
    const storage = memoryStorage();
    const result = await onboarded(storage);
    expect(result.current.isNamed).toBe(false);
    expect(result.current.name).toBeNull();

    await result.current.createAccount('Maya');

    await waitFor(() => expect(result.current.isNamed).toBe(true));
    expect(result.current.name).toBe('Maya');
    // Persisted, not just in-memory — the awaited promise resolves after the blob is written.
    expect(new ProgressStore(JSON.parse(storage.blob as string)).getName()).toBe('Maya');
  });

  test('markNudgeSeen sets the once-only flag and persists', async () => {
    const storage = memoryStorage();
    const result = await onboarded(storage);
    expect(result.current.nudgeSeen).toBe(false);

    await result.current.markNudgeSeen();

    await waitFor(() => expect(result.current.nudgeSeen).toBe(true));
    expect(new ProgressStore(JSON.parse(storage.blob as string)).isNudgeSeen()).toBe(true);
  });

  test('completedLessonCount reads a fresh count off the (in-place-mutated) store', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB]));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.completedLessonCount()).toBe(0);

    const store = result.current.store as ProgressStore;
    masterAtom(store, lessonA, 'x', 0);
    masterAtom(store, lessonA, 'y', 10); // both atoms mastered → applyAttempt auto-completes lessonA
    expect(result.current.completedLessonCount()).toBe(1);
  });
});

// D7: "cleared" means band ≥ pass — a failed paper must not open Level 2.
describe('useProgress — recordExamResult (D7, U5)', () => {
  test.each(['pass', 'merit', 'distinction'] as const)(
    'a %s band clears the exam and unlocks the next grade\'s root, persisted',
    async (band) => {
      const storage = memoryStorage();
      const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
      await waitFor(() => expect(result.current.ready).toBe(true));

      await result.current.recordExamResult(1, band);

      const store = result.current.store as ProgressStore;
      expect(store.isExamCleared(1)).toBe(true);
      expect(store.isUnlocked('g2a')).toBe(true);
      // Persisted, not just in-memory.
      const reloaded = new ProgressStore(JSON.parse(storage.blob as string));
      expect(reloaded.isExamCleared(1)).toBe(true);
    },
  );

  // fyu.2: exam recording is now independent of content reachability — a
  // below-band result still clears nothing, but it no longer has any lock to
  // guard, since ensureLevelRootsUnlocked already opened 'g2a' by content
  // presence at load, before recordExamResult ever ran.
  test('a below band clears nothing — exam state stays uncleared, independent of the already-content-unlocked grade-2 root', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect((result.current.store as ProgressStore).isUnlocked('g2a')).toBe(true); // unlocked by content presence at load, pre-exam

    await result.current.recordExamResult(1, 'below');

    const store = result.current.store as ProgressStore;
    expect(store.isExamCleared(1)).toBe(false);
    expect(store.isUnlocked('g2a')).toBe(true); // unaffected either way — reachability never depended on the exam
  });
});
