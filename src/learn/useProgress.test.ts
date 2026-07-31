import { renderHook, waitFor } from '@testing-library/react-native';

import type { Lesson } from '../content/lessons';
import { selectDue } from './srs';
import { ProgressStore, type SnapshotStorage } from './store';
import { applyAttempt, recordAtomFlashcardGrade, useProgress } from './useProgress';

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

describe('progression — a lesson completes only when all its atoms are mastered', () => {
  test('mastering every atom marks the lesson done', () => {
    const store = new ProgressStore();

    const now = masterAtom(store, lessonA, 'x', 0);
    // Only one of two atoms mastered → not complete.
    expect(store.getLesson('a').completed).toBe(false);

    masterAtom(store, lessonA, 'y', now);
    expect(store.getLesson('a').completed).toBe(true);
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

// R4 (G6 U3): eligibility is per-ATOM. The store only ever holds atoms the learner
// has attempted, so `atomEntries()` IS the eligibility set — there is no unlock
// predicate to consult, and an atom met inside a lesson that was never "reached"
// under the old linear chain is reviewed like any other.
describe('progression — Practice eligibility is per-atom (R4)', () => {
  test('selectDue serves every attempted atom, whatever lesson it came from, and nothing else', () => {
    const store = new ProgressStore();
    // Touch atoms from both lessons so they have SRS state and are due; 'b' would
    // have been locked before U3 — its atom is served all the same.
    applyAttempt(store, lessonA, 'x', { correct: false, hintsUsed: 0 }, 0);
    applyAttempt(store, lessonB, 'z', { correct: false, hintsUsed: 0 }, 0);

    const served = selectDue(store.atomEntries(), 0);

    expect(served).toContain('x');
    expect(served).toContain('z');
    expect(served).not.toContain('y'); // never attempted → never served
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

// D7: "cleared" means band ≥ pass — a failed paper must not record a clear.
describe('useProgress — recordExamResult (D7, U5)', () => {
  test.each(['pass', 'merit', 'distinction'] as const)(
    'a %s band records the exam as cleared, persisted',
    async (band) => {
      const storage = memoryStorage();
      const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
      await waitFor(() => expect(result.current.ready).toBe(true));

      await result.current.recordExamResult(1, band);

      const store = result.current.store as ProgressStore;
      expect(store.isExamCleared(1)).toBe(true);
      // Persisted, not just in-memory.
      const reloaded = new ProgressStore(JSON.parse(storage.blob as string));
      expect(reloaded.isExamCleared(1)).toBe(true);
    },
  );

  // Since G6 U3 the exam record has no reachability consequence at all (R2) —
  // what a below band must not do is fabricate a clear.
  test('a below band clears nothing — exam state stays uncleared', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.recordExamResult(1, 'below');

    expect((result.current.store as ProgressStore).isExamCleared(1)).toBe(false);
  });
});

// The decay seam (R5, chromaticly-cel). Without a back-date the seed stamps every
// atom as reviewed today, so a decayed lane is unreachable on device and the
// slipped bar can never be looked at. These two guard the *offset*, which is the
// whole mechanism — an ignored `staleDays` still produces a plausible screen.
describe('useProgress — seedTo back-dates its reviews by staleDays (R5, chromaticly-cel)', () => {
  test('a stale seed lands its reviews staleDays before the clock, so the atoms read as overdue', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const today = result.current.clock.now();

    // A grade-2 target masters every grade-1 lesson, which is what carries the SRS.
    await result.current.seedTo('g2a', 400);

    const store = result.current.store as ProgressStore;
    expect(store.getAtom('x').srs.lastReviewed).toBe(today - 400);
  });

  test('the default seed reviews today, so nothing decays', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const today = result.current.clock.now();

    await result.current.seedTo('g2a');

    expect((result.current.store as ProgressStore).getAtom('x').srs.lastReviewed).toBe(today);
  });
});

// `plays` rotates the seed window so a replayed lesson asks different questions
// (80a8905). It is bumped on every pass but was persisted only on the first, so
// the rotation survived in memory and reset on the next launch. The existing
// coverage pre-seeds `plays` into a snapshot rather than earning it, which is why
// the gap held: nothing asserted that a second play reaches storage.
describe('useProgress — a replayed lesson persists its plays bump (council F3)', () => {
  test('completing the same lesson twice writes plays = 2 to storage, not 1', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(await result.current.complete(lessonA)).toBe(true);
    // The replay: `complete` returns false because the lesson was already done,
    // which is exactly the branch that used to skip the save.
    expect(await result.current.complete(lessonA)).toBe(false);

    const reloaded = new ProgressStore(JSON.parse(storage.blob as string));
    expect(reloaded.getLesson('a').plays).toBe(2);
  });
});

// G6 U11's commit layer. KTD6 splits one job into three roles — placement.ts
// MEASURES (pure), stampDepth STAMPS, the commits PERSIST — and every test here
// exists because collapsing any two of them produces a plausible screen and a
// wrong store.
describe('useProgress — stamping and committing a placement (G6 U11)', () => {
  function fakeClock(day: number) {
    let d = day;
    return { now: () => d, set: (next: number) => { d = next; } };
  }

  test('stamping reserves an increasing seq per strand and writes nothing', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));

    const first = result.current.stampDepth(3);
    const second = result.current.stampDepth(1);

    expect(second.seq).toBeGreaterThan(first.seq);
    // A reservation is not a write. If it persisted, a placement abandoned halfway
    // would leave seeds behind that the learner never confirmed.
    expect(storage.blob).toBeNull();
  });

  test('committing writes every seed and the profile in ONE save', async () => {
    const storage = memoryStorage();
    let saves = 0;
    const counting = { ...storage, async save(s: string) { saves += 1; storage.blob = s; } };
    const { result } = renderHook(() => useProgress(counting, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));

    const staged = { pitch: result.current.stampDepth(3), rhythm: result.current.stampDepth(2) };
    await result.current.commitOnboarding(staged, '2026-07-31T00:00:00.000Z');

    // A per-strand save would leave a crash recoverable as "some lanes seeded,
    // others not", with no way to tell which.
    expect(saves).toBe(1);
    const reloaded = new ProgressStore(JSON.parse(storage.blob as string));
    expect(reloaded.seededDepthFor('pitch')?.depth).toBe(3);
    expect(reloaded.seededDepthFor('rhythm')?.depth).toBe(2);
    expect(reloaded.getProfile()?.onboardedAt).toBe('2026-07-31T00:00:00.000Z');
  });

  test('`day` is measurement time, not commit time', async () => {
    const storage = memoryStorage();
    const clock = fakeClock(10);
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2], clock));
    await waitFor(() => expect(result.current.ready).toBe(true));

    const staged = { pitch: result.current.stampDepth(4) };
    clock.set(40); // thirty days pass between measuring and landing on the last screen
    await result.current.commitOnboarding(staged, '2026-07-31T00:00:00.000Z');

    // Stamping at commit time would hand the seed thirty free days of freshness
    // against SEED_INTERVAL_DAYS — it would read as measured today when it wasn't.
    expect((result.current.store as ProgressStore).seededDepthFor('pitch')?.day).toBe(10);
  });

  test('an all-zero placement still commits grade 1, never 0', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.commitOnboarding({ pitch: result.current.stampDepth(0) }, '2026-07-31T00:00:00.000Z');

    // Read the store, not `result.current.profile`: the hook's mirrored state has
    // not re-rendered here, so a React-state read is undefined and any toBe()
    // against it would pass or fail for the wrong reason.
    expect((result.current.store as ProgressStore).getProfile()?.grade).toBe(1);
  });

  test('skipping placement commits no seeds at all, and the lanes stay underived', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.commitOnboarding({}, '2026-07-31T00:00:00.000Z');

    const store = result.current.store as ProgressStore;
    expect(store.allSeededDepths()).toEqual({});
    expect(store.getProfile()?.grade).toBe(1);
  });

  test('a re-test writes one seed and leaves the profile and other strands untouched', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await result.current.commitOnboarding(
      { pitch: result.current.stampDepth(3), rhythm: result.current.stampDepth(2) },
      '2026-07-31T00:00:00.000Z',
    );
    const store = result.current.store as ProgressStore;
    const profileBefore = JSON.stringify(store.getProfile());
    expect(profileBefore).not.toBe('null'); // or the comparison below proves nothing

    await result.current.commitRetest('pitch', result.current.stampDepth(5));

    expect(store.seededDepthFor('pitch')?.depth).toBe(5);
    expect(store.seededDepthFor('rhythm')?.depth).toBe(2);
    expect(JSON.stringify(store.getProfile())).toBe(profileBefore);
  });

  // KTD7, and the reason seq is reserved at measurement rather than at commit.
  test('an attempt made after the measurement out-ranks the seed, even committed later', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));

    const staged = { pitch: result.current.stampDepth(3) }; // measured first
    await result.current.recordAtom('x', { correct: true, hintsUsed: 0 } as never, 5); // then practised
    await result.current.commitOnboarding(staged, '2026-07-31T00:00:00.000Z'); // committed last

    const store = result.current.store as ProgressStore;
    // Allocating seq inside the commit passes every other test here and fails this
    // one: the older measurement would out-rank the newer attempt.
    expect(store.getAtom('x').srs.seq ?? 0).toBeGreaterThan(store.seededDepthFor('pitch')!.seq);
  });

  test('a re-test stamped after an attempt takes authority back from it', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useProgress(storage, [lessonA, lessonB, lessonG2]));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.recordAtom('x', { correct: true, hintsUsed: 0 } as never, 5);
    await result.current.commitRetest('pitch', result.current.stampDepth(4));

    const store = result.current.store as ProgressStore;
    expect(store.seededDepthFor('pitch')!.seq).toBeGreaterThan(store.getAtom('x').srs.seq ?? 0);
  });
});
