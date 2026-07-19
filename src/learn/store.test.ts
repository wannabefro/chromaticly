import { recordAttempt } from './mastery';
import { DEFAULT_EASE, reviewSrs } from './srs';
import { loadProgress, ProgressStore, saveProgress, STORE_VERSION, type SnapshotStorage } from './store';

/** In-memory SnapshotStorage. A "restart" is loadProgress() against the same
 *  instance — the blob survives, the store object does not. */
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

describe('store — state survives a restart (why: KTD6 local persistence)', () => {
  test('atom mastery/SRS and lesson unlock written before restart are read back after', async () => {
    const storage = memoryStorage();

    const store = new ProgressStore();
    const a = store.getAtom('note_read:treble:C4');
    store.setAtom('note_read:treble:C4', {
      mastery: recordAttempt(a.mastery, { correct: true, hintsUsed: 0 }),
      srs: reviewSrs(a.srs, true, 0),
    });
    store.setLesson('treble-notes', { completed: true });
    store.unlock('bass-notes');
    await saveProgress(store, storage);

    const reloaded = await loadProgress(storage); // simulate app kill + reopen

    expect(reloaded.getAtom('note_read:treble:C4').mastery.streak).toBe(1);
    expect(reloaded.getAtom('note_read:treble:C4').srs.box).toBe(1);
    expect(reloaded.getLesson('treble-notes').completed).toBe(true);
    expect(reloaded.isUnlocked('bass-notes')).toBe(true);
  });

  test('an unseen atom reads back as fresh, not undefined', async () => {
    const reloaded = await loadProgress(memoryStorage());
    const p = reloaded.getAtom('never-seen');
    expect(p.mastery).toEqual({ streak: 0, mastered: false });
    expect(p.srs.box).toBe(0);
  });
});

describe('store — profile (KTD4 onboarding persistence)', () => {
  test('profile round-trips through toSnapshot → new ProgressStore, preserving grade', () => {
    const store = new ProgressStore();
    expect(store.isOnboarded()).toBe(false);

    store.setProfile({ grade: 1, onboardedAt: '2026-07-12T00:00:00.000Z' });
    expect(store.isOnboarded()).toBe(true);
    expect(store.getGrade()).toBe(1);

    const reloaded = new ProgressStore(store.toSnapshot());
    expect(reloaded.getProfile()).toEqual({ grade: 1, onboardedAt: '2026-07-12T00:00:00.000Z' });
    expect(reloaded.isOnboarded()).toBe(true);
  });

  test('a stored grade is never silently rewritten on round-trip (even a grade the UI cannot pick)', () => {
    // Persistence must be grade-agnostic: a profile carrying grade 2 survives intact
    // even though the onboarding UI only lets a user select Grade 1.
    const store = new ProgressStore();
    store.setProfile({ grade: 2, birthYear: 2000, onboardedAt: '2026-07-12T00:00:00.000Z' });
    const reloaded = new ProgressStore(store.toSnapshot());
    expect(reloaded.getProfile()).toEqual({ grade: 2, birthYear: 2000, onboardedAt: '2026-07-12T00:00:00.000Z' });
    expect(reloaded.getGrade()).toBe(2);
  });

  test('a legacy birth-year-only profile (no grade) is back-filled to Grade 1, preserving birthYear (U1)', () => {
    // Mirrors a real profile persisted in the age-gate era: { birthYear, onboardedAt }
    // with no `grade`. migrate() must back-fill grade=1 in place, not discard it.
    const legacyBlob = JSON.parse(
      JSON.stringify({
        version: STORE_VERSION,
        atoms: {},
        lessons: {},
        unlocked: [],
        profile: { birthYear: 2000, onboardedAt: '2026-01-01T00:00:00.000Z' },
      }),
    );
    const store = new ProgressStore(legacyBlob);
    expect(store.getProfile()).toEqual({ grade: 1, birthYear: 2000, onboardedAt: '2026-01-01T00:00:00.000Z' });
    expect(store.getGrade()).toBe(1);
    expect(store.isOnboarded()).toBe(true);
  });

  test('adding profile to an old v1 blob with no profile key never wipes existing progress (A1)', () => {
    // Simulates a snapshot persisted before `profile` existed on ProgressSnapshot —
    // the shallow-merge migrate() must load this as profile=null without dropping
    // atoms/lessons/unlocked, and setting a profile afterwards must not disturb them.
    const oldShapeBlob = JSON.parse(
      JSON.stringify({
        version: STORE_VERSION,
        atoms: { 'note_read:treble:C4': { mastery: { streak: 2, mastered: false }, srs: { box: 1, lastReviewed: 0, nextDue: 2 } } },
        lessons: { 'treble-notes': { completed: true } },
        unlocked: ['treble-notes', 'bass-notes'],
        // no `profile` key — mirrors a real pre-U8 persisted blob.
      }),
    );

    const store = new ProgressStore(oldShapeBlob);
    expect(store.getProfile()).toBeNull();
    expect(store.getAtom('note_read:treble:C4').mastery.streak).toBe(2);
    expect(store.getLesson('treble-notes').completed).toBe(true);
    expect(store.isUnlocked('bass-notes')).toBe(true);

    store.setProfile({ grade: 1, onboardedAt: '2026-07-12T00:00:00.000Z' });
    const snapshot = store.toSnapshot();
    expect(snapshot.profile).toEqual({ grade: 1, onboardedAt: '2026-07-12T00:00:00.000Z' });
    expect(snapshot.atoms['note_read:treble:C4'].mastery.streak).toBe(2);
    expect(snapshot.lessons['treble-notes'].completed).toBe(true);
    expect(snapshot.unlocked).toContain('bass-notes');
  });
});

describe('store — fact-card collection (302.3.4)', () => {
  test('a collected fact survives a restart and collecting is idempotent', () => {
    const store = new ProgressStore();
    expect(store.isFactCollected('treble-notes')).toBe(false);

    store.collectFact('treble-notes');
    store.collectFact('treble-notes'); // idempotent — the Set dedupes
    expect(store.isFactCollected('treble-notes')).toBe(true);

    const reloaded = new ProgressStore(JSON.parse(JSON.stringify(store.toSnapshot())));
    expect(reloaded.isFactCollected('treble-notes')).toBe(true);
    expect(reloaded.isFactCollected('bass-notes')).toBe(false);
    expect(reloaded.toSnapshot().collectedFacts).toEqual(['treble-notes']);
  });

  test('an old snapshot with no collectedFacts loads with an empty collection (additive, AD4)', () => {
    const preCollectionBlob = JSON.parse(
      JSON.stringify({
        version: STORE_VERSION,
        atoms: {},
        lessons: {},
        unlocked: ['treble-notes'],
        profile: { grade: 1, onboardedAt: '2026-01-01T00:00:00.000Z' },
      }),
    );
    const store = new ProgressStore(preCollectionBlob);
    expect(store.isFactCollected('treble-notes')).toBe(false);
    expect(store.isUnlocked('treble-notes')).toBe(true); // nothing else discarded
  });
});

describe('store — U6 additive `ease` migration is non-destructive (AD4)', () => {
  test('an old snapshot with no `ease` on any SrsState loads intact — onboarding/profile/unlocks/mastery all survive — and a default ease is filled', () => {
    // Mirrors a real pre-U6 persisted blob: same STORE_VERSION, srs objects
    // shaped without the (then-nonexistent) `ease` field.
    const preU6Blob = JSON.parse(
      JSON.stringify({
        version: STORE_VERSION,
        atoms: {
          'note_read:treble:C4': { mastery: { streak: 2, mastered: false }, srs: { box: 1, lastReviewed: 0, nextDue: 2 } },
          'term:staccato': { mastery: { streak: 3, mastered: true }, srs: { box: 3, lastReviewed: 5, nextDue: 13 } },
        },
        lessons: { 'treble-notes': { completed: true } },
        unlocked: ['treble-notes', 'bass-notes'],
        profile: { birthYear: 2014, onboardedAt: '2026-01-01T00:00:00.000Z' },
      }),
    );

    const store = new ProgressStore(preU6Blob);

    // Nothing was discarded — the version matched, so no fresh-start reset. The
    // grade-less legacy profile is back-filled to Grade 1 (U1) but otherwise intact.
    expect(store.getProfile()).toEqual({ grade: 1, birthYear: 2014, onboardedAt: '2026-01-01T00:00:00.000Z' });
    expect(store.getLesson('treble-notes').completed).toBe(true);
    expect(store.isUnlocked('treble-notes')).toBe(true);
    expect(store.isUnlocked('bass-notes')).toBe(true);
    expect(store.getAtom('note_read:treble:C4').mastery).toEqual({ streak: 2, mastered: false });
    expect(store.getAtom('term:staccato').mastery).toEqual({ streak: 3, mastered: true });

    // The ease-less SrsState round-trips with a default filled in, not dropped.
    const treble = store.getAtom('note_read:treble:C4').srs;
    expect(treble.box).toBe(1);
    expect(treble.nextDue).toBe(2);
    expect(treble.ease).toBe(DEFAULT_EASE);

    const term = store.getAtom('term:staccato').srs;
    expect(term.box).toBe(3);
    expect(term.ease).toBe(DEFAULT_EASE);
  });

  test('a snapshot that already has `ease` keeps its own value rather than being overwritten with the default', () => {
    const blob = JSON.parse(
      JSON.stringify({
        version: STORE_VERSION,
        atoms: { 'term:legato': { mastery: { streak: 1, mastered: false }, srs: { box: 2, lastReviewed: 0, nextDue: 4, ease: 3.1 } } },
        lessons: {},
        unlocked: [],
        profile: null,
      }),
    );
    const store = new ProgressStore(blob);
    expect(store.getAtom('term:legato').srs.ease).toBe(3.1);
  });
});

describe('store — resilience', () => {
  test('a corrupt persisted blob starts fresh rather than throwing', async () => {
    const storage = memoryStorage();
    await storage.save('{not valid json');
    const store = await loadProgress(storage);
    expect(store.toSnapshot().atoms).toEqual({});
  });

  test('a snapshot from an incompatible version is discarded, not trusted', () => {
    const store = new ProgressStore({
      version: STORE_VERSION + 1,
      atoms: { stale: { mastery: { streak: 9, mastered: true }, srs: { box: 4, lastReviewed: 0, nextDue: 8 } } },
      lessons: {},
      unlocked: ['everything'],
      collectedFacts: [],
      profile: null,
    });
    expect(store.toSnapshot().atoms).toEqual({});
    expect(store.isUnlocked('everything')).toBe(false);
  });
});

describe('store — account name + nudge-seen (design 6b/6c, 302.9/302.13)', () => {
  test('completedLessonCount counts only completed lessons', () => {
    const store = new ProgressStore();
    expect(store.completedLessonCount()).toBe(0);
    store.setLesson('a', { completed: true });
    store.setLesson('b', { completed: false });
    store.setLesson('c', { completed: true });
    expect(store.completedLessonCount()).toBe(2);
  });

  test('a name upgrades an onboarded profile and survives a restart', async () => {
    const storage = memoryStorage();
    const store = new ProgressStore();
    store.setProfile({ grade: 1, onboardedAt: 'now' });
    store.setName('Maya');
    expect(store.getName()).toBe('Maya');
    expect(store.isNamed()).toBe(true);
    await saveProgress(store, storage);

    const reloaded = await loadProgress(storage);
    expect(reloaded.getName()).toBe('Maya');
    expect(reloaded.isNamed()).toBe(true);
  });

  test('setName is a no-op when there is no profile (a name upgrades, never creates)', () => {
    const store = new ProgressStore();
    store.setName('Ghost');
    expect(store.getProfile()).toBeNull();
    expect(store.isNamed()).toBe(false);
  });

  test('markNudgeSeen is a once-only flag that survives a restart', async () => {
    const storage = memoryStorage();
    const store = new ProgressStore();
    expect(store.isNudgeSeen()).toBe(false);
    store.markNudgeSeen();
    expect(store.isNudgeSeen()).toBe(true);
    await saveProgress(store, storage);
    expect((await loadProgress(storage)).isNudgeSeen()).toBe(true);
  });

  // Why: the new fields are additive-optional — an old snapshot must load valid,
  // not be discarded (fail-safe migration, AD4).
  test('a pre-account snapshot back-fills nudge-seen false and preserves the rest', () => {
    const store = new ProgressStore({
      version: STORE_VERSION,
      atoms: {},
      lessons: { l1: { completed: true } },
      unlocked: ['l1'],
      collectedFacts: [],
      profile: { grade: 1, onboardedAt: 'then' },
      // no name, no accountNudgeSeen
    });
    expect(store.isNudgeSeen()).toBe(false);
    expect(store.getName()).toBeUndefined();
    expect(store.completedLessonCount()).toBe(1);
    expect(store.getGrade()).toBe(1);
  });

  // Why: a returning learner already ≥3 lessons in must NOT have nudge-seen back-filled true —
  // they are exactly who the nudge targets, on their next completion (plan Q4).
  test('an already-invested snapshot (≥3 done, no flag) loads nudge-unseen', () => {
    const store = new ProgressStore({
      version: STORE_VERSION,
      atoms: {},
      lessons: { a: { completed: true }, b: { completed: true }, c: { completed: true } },
      unlocked: [],
      collectedFacts: [],
      profile: { grade: 1, onboardedAt: 't' },
    });
    expect(store.completedLessonCount()).toBe(3);
    expect(store.isNudgeSeen()).toBe(false);
  });

  // Why: a legacy age-gate-era profile still carrying birthYear must load cleanly; this
  // slice neither reads nor clears it.
  test('a legacy snapshot with birthYear loads with birthYear preserved and no name', () => {
    const store = new ProgressStore({
      version: STORE_VERSION,
      atoms: {},
      lessons: {},
      unlocked: [],
      collectedFacts: [],
      profile: { grade: 1, birthYear: 2000, onboardedAt: 't' },
    });
    expect(store.getProfile()?.birthYear).toBe(2000);
    expect(store.isNamed()).toBe(false);
  });
});

describe('store — exam-clear persistence (D4, 003 U4)', () => {
  // Why: "Clear the Level N exam to unlock" is a persistent fact, not session
  // state — the Level N+1 unlock must survive an app restart.
  test('an exam clear survives toSnapshot() → new ProgressStore from that snapshot', () => {
    const store = new ProgressStore();
    expect(store.isExamCleared(1)).toBe(false);

    store.recordExamCleared(1);
    expect(store.isExamCleared(1)).toBe(true);

    const reloaded = new ProgressStore(JSON.parse(JSON.stringify(store.toSnapshot())));
    expect(reloaded.isExamCleared(1)).toBe(true);
    expect(reloaded.isExamCleared(2)).toBe(false);
  });

  // Why: additive-optional migration must not discard a live learner's progress
  // just because `clearedExams` didn't exist yet when the snapshot was written
  // (the accountNudgeSeen/collectedFacts precedent, AD4).
  test('a pre-existing snapshot without clearedExams loads with nothing cleared and no data loss', () => {
    const preClearedExamsBlob = JSON.parse(
      JSON.stringify({
        version: STORE_VERSION,
        atoms: { 'note_read:treble:C4': { mastery: { streak: 2, mastered: false }, srs: { box: 1, lastReviewed: 0, nextDue: 2 } } },
        lessons: { 'treble-notes': { completed: true } },
        unlocked: ['treble-notes', 'bass-notes'],
        collectedFacts: ['treble-notes'],
        profile: { grade: 1, onboardedAt: 't' },
        // no clearedExams key — mirrors a real pre-U4 persisted blob.
      }),
    );
    const store = new ProgressStore(preClearedExamsBlob);

    expect(store.isExamCleared(1)).toBe(false);
    expect(store.toSnapshot().clearedExams).toEqual([]);
    // nothing else discarded
    expect(store.getAtom('note_read:treble:C4').mastery.streak).toBe(2);
    expect(store.getLesson('treble-notes').completed).toBe(true);
    expect(store.isUnlocked('bass-notes')).toBe(true);
    expect(store.isFactCollected('treble-notes')).toBe(true);
    expect(store.getGrade()).toBe(1);
  });

  // Why: idempotence — a re-taken or replayed exam must not corrupt or duplicate
  // the record (D7's "safe on a replayed exam" relies on this).
  test('recording the same grade cleared twice keeps one entry', () => {
    const store = new ProgressStore();
    store.recordExamCleared(1);
    store.recordExamCleared(1);
    expect(store.toSnapshot().clearedExams).toEqual([1]);
  });
});
