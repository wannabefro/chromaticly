import { renderHook, waitFor } from '@testing-library/react-native';

import type { Lesson } from '../content/lessons';
import { selectDue } from './srs';
import { ProgressStore, type SnapshotStorage } from './store';
import { applyAttempt, ensureRootUnlocked, recordAtomFlashcardGrade, useProgress } from './useProgress';

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
};
const lessonB: Lesson = { ...lessonA, id: 'b', atoms: ['z'], unlocks: null };

const correct = { correct: true, hintsUsed: 0 };

function masterAtom(store: ProgressStore, lesson: Lesson, atom: string, startTick: number): number {
  let now = startTick;
  for (let i = 0; i < 3; i++) applyAttempt(store, lesson, atom, correct, now++);
  return now;
}

describe('progression — ensureRootUnlocked', () => {
  test('unlocks the single entry lesson and nothing downstream', () => {
    const store = new ProgressStore();
    ensureRootUnlocked(store, [lessonA, lessonB]);
    expect(store.isUnlocked('a')).toBe(true);
    expect(store.isUnlocked('b')).toBe(false);
  });
});

describe('progression — a lesson completes only when all its atoms are mastered, then unlocks the next', () => {
  test('mastering every atom marks the lesson done and unlocks its target', () => {
    const store = new ProgressStore();
    ensureRootUnlocked(store, [lessonA, lessonB]);

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
    ensureRootUnlocked(store, [lessonA, lessonB]);
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
