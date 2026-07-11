import { recordAttempt } from './mastery';
import { reviewSrs } from './srs';
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
  test('profile round-trips through toSnapshot → new ProgressStore', () => {
    const store = new ProgressStore();
    expect(store.isOnboarded()).toBe(false);

    store.setProfile({ birthYear: 2015, onboardedAt: '2026-07-12T00:00:00.000Z' });
    expect(store.isOnboarded()).toBe(true);

    const reloaded = new ProgressStore(store.toSnapshot());
    expect(reloaded.getProfile()).toEqual({ birthYear: 2015, onboardedAt: '2026-07-12T00:00:00.000Z' });
    expect(reloaded.isOnboarded()).toBe(true);
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

    store.setProfile({ birthYear: 2012, onboardedAt: '2026-07-12T00:00:00.000Z' });
    const snapshot = store.toSnapshot();
    expect(snapshot.profile).toEqual({ birthYear: 2012, onboardedAt: '2026-07-12T00:00:00.000Z' });
    expect(snapshot.atoms['note_read:treble:C4'].mastery.streak).toBe(2);
    expect(snapshot.lessons['treble-notes'].completed).toBe(true);
    expect(snapshot.unlocked).toContain('bass-notes');
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
      profile: null,
    });
    expect(store.toSnapshot().atoms).toEqual({});
    expect(store.isUnlocked('everything')).toBe(false);
  });
});
