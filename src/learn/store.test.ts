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
    });
    expect(store.toSnapshot().atoms).toEqual({});
    expect(store.isUnlocked('everything')).toBe(false);
  });
});
