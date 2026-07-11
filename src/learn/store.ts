// Progress persistence (U11, KTD6). Per-atom mastery + SRS state and per-lesson
// completion/unlock, held in memory and serialized to a versioned snapshot. The
// platform storage (expo-sqlite / MMKV) is hidden behind the tiny async
// SnapshotStorage port, so all the store logic — versioning, migration,
// read-back-after-restart — is testable with an in-memory port and only the
// concrete adapter is device-specific.

import { initialMastery, type MasteryState } from './mastery';
import { initialSrs, type SrsState } from './srs';

export const STORE_VERSION = 1;

export interface AtomProgress {
  mastery: MasteryState;
  srs: SrsState;
}

export interface LessonProgress {
  completed: boolean;
}

export interface ProgressSnapshot {
  version: number;
  atoms: Record<string, AtomProgress>;
  lessons: Record<string, LessonProgress>;
  unlocked: string[];
}

/** Async persistence port — implemented by expo-sqlite/MMKV on device and by an
 *  in-memory fake in tests. The store never talks to a platform API directly. */
export interface SnapshotStorage {
  load(): Promise<string | null>;
  save(serialized: string): Promise<void>;
}

function emptySnapshot(): ProgressSnapshot {
  return { version: STORE_VERSION, atoms: {}, lessons: {}, unlocked: [] };
}

/** Bring any persisted snapshot up to the current shape. A version mismatch we
 *  can't migrate is discarded (start fresh) rather than trusted — fail safe. */
function migrate(snapshot: ProgressSnapshot): ProgressSnapshot {
  if (snapshot.version !== STORE_VERSION) return emptySnapshot();
  return { ...emptySnapshot(), ...snapshot };
}

export class ProgressStore {
  private atoms: Record<string, AtomProgress>;
  private lessons: Record<string, LessonProgress>;
  private unlocked: Set<string>;

  constructor(snapshot: ProgressSnapshot = emptySnapshot()) {
    const s = migrate(snapshot);
    this.atoms = { ...s.atoms };
    this.lessons = { ...s.lessons };
    this.unlocked = new Set(s.unlocked);
  }

  getAtom(atom: string): AtomProgress {
    return this.atoms[atom] ?? { mastery: initialMastery(), srs: initialSrs() };
  }

  setAtom(atom: string, progress: AtomProgress): void {
    this.atoms[atom] = progress;
  }

  atomEntries(): { atom: string; srs: SrsState }[] {
    return Object.entries(this.atoms).map(([atom, p]) => ({ atom, srs: p.srs }));
  }

  masteryOf(atom: string): MasteryState | undefined {
    return this.atoms[atom]?.mastery;
  }

  getLesson(id: string): LessonProgress {
    return this.lessons[id] ?? { completed: false };
  }

  setLesson(id: string, progress: LessonProgress): void {
    this.lessons[id] = progress;
  }

  isUnlocked(id: string): boolean {
    return this.unlocked.has(id);
  }

  unlock(id: string): void {
    this.unlocked.add(id);
  }

  toSnapshot(): ProgressSnapshot {
    return {
      version: STORE_VERSION,
      atoms: { ...this.atoms },
      lessons: { ...this.lessons },
      unlocked: [...this.unlocked],
    };
  }
}

export async function loadProgress(storage: SnapshotStorage): Promise<ProgressStore> {
  const raw = await storage.load();
  if (!raw) return new ProgressStore();
  try {
    return new ProgressStore(JSON.parse(raw) as ProgressSnapshot);
  } catch {
    return new ProgressStore(); // corrupt blob → start fresh rather than crash
  }
}

export async function saveProgress(store: ProgressStore, storage: SnapshotStorage): Promise<void> {
  await storage.save(JSON.stringify(store.toSnapshot()));
}
