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
  test('atom mastery/SRS and lesson completion written before restart are read back after', async () => {
    const storage = memoryStorage();

    const store = new ProgressStore();
    const a = store.getAtom('note_read:treble:C4');
    store.setAtom('note_read:treble:C4', {
      mastery: recordAttempt(a.mastery, { correct: true, hintsUsed: 0 }),
      srs: reviewSrs(a.srs, true, 0),
    });
    store.setLesson('treble-notes', { completed: true });
    await saveProgress(store, storage);

    const reloaded = await loadProgress(storage); // simulate app kill + reopen

    expect(reloaded.getAtom('note_read:treble:C4').mastery.streak).toBe(1);
    expect(reloaded.getAtom('note_read:treble:C4').srs.box).toBe(1);
    expect(reloaded.getLesson('treble-notes').completed).toBe(true);
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
    // atoms/lessons, and setting a profile afterwards must not disturb them.
    const oldShapeBlob = JSON.parse(
      JSON.stringify({
        version: STORE_VERSION,
        atoms: { 'note_read:treble:C4': { mastery: { streak: 2, mastered: false }, srs: { box: 1, lastReviewed: 0, nextDue: 2 } } },
        lessons: { 'treble-notes': { completed: true } },
        // no `profile` key — mirrors a real pre-U8 persisted blob.
      }),
    );

    const store = new ProgressStore(oldShapeBlob);
    expect(store.getProfile()).toBeNull();
    expect(store.getAtom('note_read:treble:C4').mastery.streak).toBe(2);
    expect(store.getLesson('treble-notes').completed).toBe(true);

    store.setProfile({ grade: 1, onboardedAt: '2026-07-12T00:00:00.000Z' });
    const snapshot = store.toSnapshot();
    expect(snapshot.profile).toEqual({ grade: 1, onboardedAt: '2026-07-12T00:00:00.000Z' });
    expect(snapshot.atoms['note_read:treble:C4'].mastery.streak).toBe(2);
    expect(snapshot.lessons['treble-notes'].completed).toBe(true);
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
        profile: { grade: 1, onboardedAt: '2026-01-01T00:00:00.000Z' },
      }),
    );
    const store = new ProgressStore(preCollectionBlob);
    expect(store.isFactCollected('treble-notes')).toBe(false);
  });
});

describe('store — U6 additive `ease` migration is non-destructive (AD4)', () => {
  test('an old snapshot with no `ease` on any SrsState loads intact — onboarding/profile/mastery all survive — and a default ease is filled', () => {
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
        profile: { birthYear: 2014, onboardedAt: '2026-01-01T00:00:00.000Z' },
      }),
    );

    const store = new ProgressStore(preU6Blob);

    // Nothing was discarded — the version matched, so no fresh-start reset. The
    // grade-less legacy profile is back-filled to Grade 1 (U1) but otherwise intact.
    expect(store.getProfile()).toEqual({ grade: 1, birthYear: 2014, onboardedAt: '2026-01-01T00:00:00.000Z' });
    expect(store.getLesson('treble-notes').completed).toBe(true);
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
      collectedFacts: [],
      profile: null,
    });
    expect(store.toSnapshot().atoms).toEqual({});
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

// ─────────────────────────────────────────────────────────────────────────────
// v1 → v2 migration (G6 U1)
//
// Why this block exists: v1 measured SRS time in per-session ticks seeded at 0.
// Reading those as epoch days would leave every atom ~20,000 days overdue, which
// lane-depth decay turns into "all your skills reset". Nothing else in the suite
// touches a v1 fixture, so these are the only tests standing between a real
// learner's progress and silent destruction.
// ─────────────────────────────────────────────────────────────────────────────

/** A v1 blob, hand-built rather than produced by the current code — the point is
 *  to pin the *old* shape, so it must not move when the current shape does. */
function v1Snapshot(atoms: Record<string, { box: number; lastReviewed: number; nextDue: number; ease?: number; mastered?: boolean }>) {
  return JSON.stringify({
    version: 1,
    atoms: Object.fromEntries(
      Object.entries(atoms).map(([id, a]) => [
        id,
        {
          mastery: { streak: 3, mastered: a.mastered ?? true },
          srs: { box: a.box, lastReviewed: a.lastReviewed, nextDue: a.nextDue, ...(a.ease === undefined ? {} : { ease: a.ease }) },
        },
      ]),
    ),
    lessons: { 'treble-notes': { completed: true } },
    collectedFacts: ['treble-notes'],
    profile: { grade: 2, onboardedAt: '2026-01-01T00:00:00.000Z', name: 'Maya' },
    accountNudgeSeen: true,
    clearedExams: [1],
  });
}

const MIGRATION_DAY = 20_600;

describe('store v1→v2 migration — ticks become days without losing progress', () => {
  test('re-bases the schedule to the migration day and keeps box/ease/mastery', async () => {
    const storage = memoryStorage();
    storage.blob = v1Snapshot({ 'note_read:treble:C4': { box: 3, lastReviewed: 0, nextDue: 4, ease: 2.5 } });

    const store = await loadProgress(storage, MIGRATION_DAY);

    const atom = store.getAtom('note_read:treble:C4');
    expect(atom.srs.box).toBe(3);
    expect(atom.srs.ease).toBe(2.5);
    expect(atom.mastery.mastered).toBe(true);
    expect(atom.srs.lastReviewed).toBe(MIGRATION_DAY);
    expect(atom.srs.nextDue).toBe(MIGRATION_DAY + 4);
    expect(atom.srs.seq).toBe(0);
  });

  test('preserves the graded interval rather than the box-table one', async () => {
    // An "Easy" flashcard's interval is ease-scaled and independent of
    // BOX_INTERVALS — 11 is not any entry in [0,1,2,4,8]. Rebasing off the box
    // table would shorten it to 4 and make the card stale early.
    const storage = memoryStorage();
    storage.blob = v1Snapshot({ 'term:allegro': { box: 3, lastReviewed: 2, nextDue: 13, ease: 2.9 } });

    const store = await loadProgress(storage, MIGRATION_DAY);

    expect(store.getAtom('term:allegro').srs.nextDue).toBe(MIGRATION_DAY + 11);
  });

  test('an immediately-due atom stays immediately due, not postponed a day', async () => {
    // BOX_INTERVALS[0] === 0 and isDue is `now >= nextDue`, so a box-0 (or
    // last-graded-Again) atom is MEANT to be due now. A max(1, …) floor on the
    // rebase would push every failed atom in every existing store to tomorrow.
    const storage = memoryStorage();
    storage.blob = v1Snapshot({ 'rest:semibreve': { box: 0, lastReviewed: 7, nextDue: 7 } });

    const store = await loadProgress(storage, MIGRATION_DAY);

    expect(store.getAtom('rest:semibreve').srs.nextDue).toBe(MIGRATION_DAY);
  });

  test('carries every other field across — nothing is quietly dropped', async () => {
    const storage = memoryStorage();
    storage.blob = v1Snapshot({ 'note_read:treble:C4': { box: 1, lastReviewed: 0, nextDue: 1 } });

    const store = await loadProgress(storage, MIGRATION_DAY);

    expect(store.getLesson('treble-notes').completed).toBe(true);
    expect(store.isFactCollected('treble-notes')).toBe(true);
    expect(store.getProfile()?.grade).toBe(2);
    expect(store.getProfile()?.name).toBe('Maya');
    expect(store.isExamCleared(1)).toBe(true);
  });

  test('persists the migration, so a second load does not re-base again', async () => {
    // Without the write-back, each launch re-bases the same v1 blob onto a later
    // "today" and every due date walks forward forever — invisible to a single
    // load, and it reads to the learner as "nothing is ever due".
    const storage = memoryStorage();
    storage.blob = v1Snapshot({ 'note_read:treble:C4': { box: 2, lastReviewed: 0, nextDue: 2 } });

    await loadProgress(storage, MIGRATION_DAY);
    expect(JSON.parse(storage.blob!).version).toBe(STORE_VERSION);

    const later = await loadProgress(storage, MIGRATION_DAY + 10);
    expect(later.getAtom('note_read:treble:C4').srs.nextDue).toBe(MIGRATION_DAY + 2);
  });

  test('a v2 snapshot is not migrated again, and re-saving is idempotent', async () => {
    // Load-then-save must be a fixed point at v2. (The first save can legitimately
    // differ from the first blob: the additive `ease` back-fill fills a default
    // the binary review path never writes. What must not drift is the second.)
    const storage = memoryStorage();
    const first = new ProgressStore();
    first.setAtom('note_read:treble:C4', { mastery: recordAttempt({ streak: 0, mastered: false }, { correct: true, hintsUsed: 0 }), srs: reviewSrs({ box: 0, lastReviewed: 5, nextDue: 5, ease: DEFAULT_EASE }, true, 5) });
    await saveProgress(first, storage);

    const once = await loadProgress(storage, MIGRATION_DAY);
    expect(once.migrated).toBe(false);
    await saveProgress(once, storage);
    const settled = storage.blob;

    const twice = await loadProgress(storage, MIGRATION_DAY + 50);
    await saveProgress(twice, storage);

    expect(storage.blob).toEqual(settled);
  });

  // G6 U3 retired the `unlocked` array along with the gate that read it. A store
  // written before that unit is still v2 — the shape did not break, a dead field
  // simply stopped being carried — so it must load with everything else intact
  // rather than being discarded, and must not drag the dead field back out on save.
  test('a v2 snapshot still carrying the retired `unlocked` array loads without loss, and drops it on save', async () => {
    const storage = memoryStorage();
    const pre = new ProgressStore();
    pre.setLesson('treble-notes', { completed: true });
    pre.setProfile({ grade: 2, onboardedAt: '2026-01-01T00:00:00.000Z' });
    pre.collectFact('treble-notes');
    storage.blob = JSON.stringify({ ...pre.toSnapshot(), unlocked: ['treble-notes', 'bass-notes'] });

    const store = await loadProgress(storage, MIGRATION_DAY);

    expect(store.getLesson('treble-notes').completed).toBe(true);
    expect(store.isFactCollected('treble-notes')).toBe(true);
    expect(store.getProfile()?.grade).toBe(2);

    await saveProgress(store, storage);
    expect(JSON.parse(storage.blob!)).not.toHaveProperty('unlocked');
  });
});

describe('store writeSeq — the ordering primitive (G6 U1, KTD1/KTD7)', () => {
  test('two attempts on the same day get strictly increasing seq', async () => {
    // Whole days cannot order a placement seed against an attempt made the same
    // day. This counter is what the per-skill re-test compares.
    const store = new ProgressStore();
    store.setAtom('a', { mastery: { streak: 1, mastered: false }, srs: { box: 0, lastReviewed: 20_600, nextDue: 20_600 } });
    store.setAtom('b', { mastery: { streak: 1, mastered: false }, srs: { box: 0, lastReviewed: 20_600, nextDue: 20_600 } });

    const seqA = store.getAtom('a').srs.seq!;
    const seqB = store.getAtom('b').srs.seq!;
    expect(seqB).toBeGreaterThan(seqA);
  });

  test('reserveSeq advances the counter without writing an atom', () => {
    const store = new ProgressStore();
    store.setAtom('a', { mastery: { streak: 1, mastered: false }, srs: { box: 0, lastReviewed: 0, nextDue: 0 } });
    const afterAttempt = store.currentSeq();

    const reserved = store.reserveSeq();

    expect(reserved).toBeGreaterThan(afterAttempt);
    expect(Object.keys(store.toSnapshot().atoms)).toEqual(['a']);
  });

  test('writeSeq survives a save/load round-trip', async () => {
    const storage = memoryStorage();
    const store = new ProgressStore();
    store.reserveSeq();
    store.reserveSeq();
    await saveProgress(store, storage);

    const reloaded = await loadProgress(storage, MIGRATION_DAY);

    expect(reloaded.currentSeq()).toBe(2);
  });

  test('a v2 snapshot written before seededDepths existed loads with an empty map', async () => {
    // U1 declares the field at v2 so a snapshot persisted between U1 and U2 is
    // not "a v2 missing a v2 field" needing its own version bump.
    const storage = memoryStorage();
    storage.blob = JSON.stringify({ version: 2, atoms: {}, lessons: {}, unlocked: [], collectedFacts: [], profile: null, writeSeq: 3 });

    const store = await loadProgress(storage, MIGRATION_DAY);

    expect(store.allSeededDepths()).toEqual({});
    expect(store.currentSeq()).toBe(3);
  });
});
