// Progress persistence (U11, KTD6). Per-atom mastery + SRS state and per-lesson
// completion/unlock, held in memory and serialized to a versioned snapshot. The
// platform storage (expo-sqlite / MMKV) is hidden behind the tiny async
// SnapshotStorage port, so all the store logic — versioning, migration,
// read-back-after-restart — is testable with an in-memory port and only the
// concrete adapter is device-specific.

import { initialMastery, type MasteryState } from './mastery';
import { DEFAULT_EASE, initialSrs, type SrsState } from './srs';

export const STORE_VERSION = 1;

export interface AtomProgress {
  mastery: MasteryState;
  srs: SrsState;
}

export interface LessonProgress {
  completed: boolean;
}

export interface Profile {
  /** The grade the learner selected during onboarding (U1). Required; old profiles
   *  written before grade existed are back-filled to 1 in migrate(). */
  grade: number;
  /** Deferred to account creation (screen 6b) — optional and absent on the primary
   *  onboarding path, which no longer runs the age gate. */
  birthYear?: number;
  onboardedAt: string;
}

export interface ProgressSnapshot {
  version: number;
  atoms: Record<string, AtomProgress>;
  lessons: Record<string, LessonProgress>;
  unlocked: string[];
  /** Lesson ids whose "did you know?" fact card (design 4b) the learner has
   *  collected — the fact-card collection. Additive/optional (302.3.4). */
  collectedFacts: string[];
  profile: Profile | null;
}

/** Async persistence port — implemented by expo-sqlite/MMKV on device and by an
 *  in-memory fake in tests. The store never talks to a platform API directly. */
export interface SnapshotStorage {
  load(): Promise<string | null>;
  save(serialized: string): Promise<void>;
}

function emptySnapshot(): ProgressSnapshot {
  return { version: STORE_VERSION, atoms: {}, lessons: {}, unlocked: [], collectedFacts: [], profile: null };
}

/** `SrsState.ease` (U6) is additive and optional, so a snapshot written before
 *  it existed is already structurally valid at the current STORE_VERSION —
 *  fill the default in place rather than treating the missing field as a
 *  reason to discard anything. */
function withDefaultEase(progress: AtomProgress): AtomProgress {
  if (progress.srs.ease !== undefined) return progress;
  return { ...progress, srs: { ...progress.srs, ease: DEFAULT_EASE } };
}

/** `Profile.grade` (U1) is additive: a profile persisted before grade existed (the
 *  birth-year-only age-gate era) is structurally valid at the current
 *  STORE_VERSION — back-fill `grade: 1` (the only built grade) in place rather than
 *  discarding it (same additive-optional strategy as `withDefaultEase`, AD4). */
function withDefaultGrade(profile: Profile | null): Profile | null {
  if (!profile || profile.grade !== undefined) return profile;
  return { ...profile, grade: 1 };
}

/** Bring any persisted snapshot up to the current shape. A version mismatch we
 *  can't migrate is discarded (start fresh) rather than trusted — fail safe.
 *  Only a genuinely breaking shape change justifies that; additive optional
 *  fields (like `ease`) are back-filled in place instead (AD4). */
function migrate(snapshot: ProgressSnapshot): ProgressSnapshot {
  if (snapshot.version !== STORE_VERSION) return emptySnapshot();
  const merged = { ...emptySnapshot(), ...snapshot };
  const atoms = Object.fromEntries(Object.entries(merged.atoms).map(([id, progress]) => [id, withDefaultEase(progress)]));
  return { ...merged, atoms, profile: withDefaultGrade(merged.profile) };
}

export class ProgressStore {
  private atoms: Record<string, AtomProgress>;
  private lessons: Record<string, LessonProgress>;
  private unlocked: Set<string>;
  private collected: Set<string>;
  private profile: Profile | null;

  constructor(snapshot: ProgressSnapshot = emptySnapshot()) {
    const s = migrate(snapshot);
    this.atoms = { ...s.atoms };
    this.lessons = { ...s.lessons };
    this.unlocked = new Set(s.unlocked);
    this.collected = new Set(s.collectedFacts);
    this.profile = s.profile;
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

  getProfile(): Profile | null {
    return this.profile;
  }

  getGrade(): number | null {
    return this.profile?.grade ?? null;
  }

  setProfile(profile: Profile): void {
    this.profile = profile;
  }

  isOnboarded(): boolean {
    return this.profile !== null;
  }

  isFactCollected(lessonId: string): boolean {
    return this.collected.has(lessonId);
  }

  collectFact(lessonId: string): void {
    this.collected.add(lessonId);
  }

  toSnapshot(): ProgressSnapshot {
    return {
      version: STORE_VERSION,
      atoms: { ...this.atoms },
      lessons: { ...this.lessons },
      unlocked: [...this.unlocked],
      collectedFacts: [...this.collected],
      profile: this.profile,
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
