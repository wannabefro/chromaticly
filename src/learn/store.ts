// Progress persistence (U11, KTD6). Per-atom mastery + SRS state and per-lesson
// completion, held in memory and serialized to a versioned snapshot. The
// platform storage (expo-sqlite / MMKV) is hidden behind the tiny async
// SnapshotStorage port, so all the store logic — versioning, migration,
// read-back-after-restart — is testable with an in-memory port and only the
// concrete adapter is device-specific.

import { initialMastery, type MasteryState } from './mastery';
import { DEFAULT_EASE, initialSrs, type SrsState } from './srs';

/** v2 (G6 U1): SRS time moved from per-session ticks to whole days since the
 *  epoch, which is a *semantic* change to already-persisted `nextDue`/`lastReviewed`
 *  values rather than a shape change — hence a version bump and a real migration,
 *  not an additive back-fill. Reading a legacy tick as an epoch day would leave
 *  every atom ~20,000 days overdue, which lane-depth decay turns into "all your
 *  skills reset". */
export const STORE_VERSION = 2;

export interface AtomProgress {
  mastery: MasteryState;
  srs: SrsState;
}

export interface LessonProgress {
  completed: boolean;
  /** How many 8-item sets of this lesson the learner has finished.
   *
   *  This is the seed offset the set runner rotates on, and it is the whole fix
   *  for a lesson only ever asking the same eight questions. Optional and read
   *  through `?? 0`, so a snapshot written before it existed needs no migration
   *  and simply starts its next set where it always did.
   *
   *  Distinct from `completed`, which is a one-way latch: a learner who replays a
   *  finished lesson still advances this. */
  plays?: number;
}

/** One strand's placement/re-test claim (G6 U1 declares it, U2 derives from it).
 *  Two independent fields doing two jobs: `day` measures how stale the claim has
 *  become, `seq` decides whether it or a recorded attempt is the more recent
 *  evidence. */
export interface SeededDepth {
  depth: number;
  day: number;
  seq: number;
}

export interface Profile {
  /** The grade the learner selected during onboarding (U1). Required; old profiles
   *  written before grade existed are back-filled to 1 in migrate(). */
  grade: number;
  /** Deferred to account creation (screen 6b) — optional and absent on the primary
   *  onboarding path, which no longer runs the age gate. */
  birthYear?: number;
  onboardedAt: string;
  /** A self-chosen display name (design 6b/6c). Its presence marks a "named account"
   *  (Guest → named). No age, email, or auth — a local identity only, never transmitted. */
  name?: string;
}

export interface ProgressSnapshot {
  version: number;
  atoms: Record<string, AtomProgress>;
  lessons: Record<string, LessonProgress>;
  /** Lesson ids whose "did you know?" fact card (design 4b) the learner has
   *  collected — the fact-card collection. Additive/optional (302.3.4). */
  collectedFacts: string[];
  profile: Profile | null;
  /** Whether the guest→account save-progress nudge (design 6c) has been shown and
   *  actioned — a once-only flag. Additive/optional; back-filled false in migrate(). */
  accountNudgeSeen?: boolean;
  /** Grades whose practice exam has been cleared (band ≥ pass) — the persisted
   *  unlock record for "Clear the Level N exam to unlock" (D4). Additive/optional;
   *  back-filled [] in migrate(). */
  clearedExams?: number[];
  /** Monotonic write counter (G6 U1, KTD1). Advanced once per recorded attempt
   *  and once per placement-seed reservation; stamped onto `SrsState.seq` and,
   *  later, onto each seeded depth. It exists because whole-day timestamps cannot
   *  order a seed against an attempt made the same day, and the per-skill re-test
   *  is exactly that comparison. Additive/optional; back-filled in migrate(). */
  writeSeq?: number;
  /** Placement/re-test seeded depths per strand (G6 U2). Declared here at v2 —
   *  even though nothing writes it until U2 — so a snapshot persisted between the
   *  two units is not a v2 missing a v2 field. Additive/optional; defaults {}. */
  seededDepths?: Record<string, SeededDepth>;
}

/** Async persistence port — implemented by expo-sqlite/MMKV on device and by an
 *  in-memory fake in tests. The store never talks to a platform API directly. */
export interface SnapshotStorage {
  load(): Promise<string | null>;
  save(serialized: string): Promise<void>;
}

function emptySnapshot(): ProgressSnapshot {
  return { version: STORE_VERSION, atoms: {}, lessons: {}, collectedFacts: [], profile: null, accountNudgeSeen: false, clearedExams: [], writeSeq: 0, seededDepths: {} };
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

/** v1 → v2 (G6 U1): re-base one atom's schedule from session ticks onto real days.
 *
 *  Keep everything the learner earned — `box`, `ease`, `mastery` — and move only
 *  the schedule, so they resume at the strength they had with a sane next-due
 *  date. Two details are load-bearing:
 *
 *  • The interval comes from the atom's own `nextDue - lastReviewed`, never from
 *    `BOX_INTERVALS[box]`. The graded (flashcard) path computes an ease-scaled
 *    interval independent of the box table, so a box-table rebase would silently
 *    shorten an "Easy" card's schedule and make it stale early.
 *  • The floor is 0, not 1. `BOX_INTERVALS[0] === 0` and `isDue` is `now >= nextDue`,
 *    so a box-0 (or last-graded-Again) atom is *meant* to be due immediately;
 *    flooring at 1 would postpone every failed atom in every existing store by a
 *    day. The `max(1, …)` floor belongs to staleness arithmetic, where a zero
 *    window would make everything instantly stale — a different quantity. */
function rebaseToDays(progress: AtomProgress, now: number): AtomProgress {
  const interval = Math.max(0, progress.srs.nextDue - progress.srs.lastReviewed);
  return {
    ...progress,
    srs: { ...progress.srs, lastReviewed: now, nextDue: now + interval, seq: 0 },
  };
}

/** Drop fields the current shape no longer carries. `unlocked` (G6 U3) is the
 *  first: nothing is hard-locked any more, so the array is dead weight that would
 *  otherwise ride along on every save through migrate's `{...snapshot}` spread.
 *  Dropping it is lossless *because* nothing reads it — the retirement of the
 *  gate and of its persisted state are the same change. */
function dropRetired(snapshot: ProgressSnapshot): ProgressSnapshot {
  const { unlocked, ...rest } = snapshot as ProgressSnapshot & { unlocked?: string[] };
  void unlocked;
  return rest;
}

/** The highest write-sequence number any persisted record carries. The counter
 *  must never start below this, or a fresh write would be ordered before evidence
 *  that already exists. */
function highestSeq(atoms: Record<string, AtomProgress>, seeds: Record<string, SeededDepth>): number {
  let max = 0;
  for (const progress of Object.values(atoms)) {
    const seq = progress.srs.seq ?? 0;
    if (seq > max) max = seq;
  }
  for (const seed of Object.values(seeds)) {
    if (seed.seq > max) max = seed.seq;
  }
  return max;
}

/** Bring any persisted snapshot up to the current shape. A version we can't
 *  migrate is discarded (start fresh) rather than trusted — fail safe. Only a
 *  genuinely breaking shape change justifies that; additive optional fields
 *  (like `ease`) are back-filled in place instead (AD4).
 *
 *  `now` is required because the v1 → v2 step re-bases every schedule onto the
 *  day the migration runs; there is no correct answer without it. */
function migrate(snapshot: ProgressSnapshot, now?: number): ProgressSnapshot {
  if (snapshot.version === 1) {
    // Loud, not defaulted. `now` used to default to 0, so a caller who forgot it
    // re-based every v1 schedule onto day 0 — and `loadProgress` then PERSISTED
    // that, making it permanent rather than a bad read. There is no correct
    // fallback here: day 0 is roughly 20,000 days stale, and any other guess
    // invents a review date the learner never had. The doc comments already said
    // `now` was required; only the default made that untrue.
    if (now === undefined) {
      throw new Error('ProgressStore: migrating a v1 snapshot requires `now` (whole days since the epoch) — there is no correct default');
    }
    const merged = { ...emptySnapshot(), ...dropRetired(snapshot), version: STORE_VERSION };
    const atoms = Object.fromEntries(
      Object.entries(merged.atoms).map(([id, progress]) => [id, rebaseToDays(withDefaultEase(progress), now)]),
    );
    // writeSeq starts at 1 rather than 0 so every seed or attempt recorded after
    // the migration out-ranks the back-filled `seq: 0` on migrated atoms.
    return { ...merged, atoms, profile: withDefaultGrade(merged.profile), writeSeq: 1, seededDepths: {} };
  }
  if (snapshot.version !== STORE_VERSION) return emptySnapshot();
  const merged = { ...emptySnapshot(), ...dropRetired(snapshot) };
  const atoms = Object.fromEntries(Object.entries(merged.atoms).map(([id, progress]) => [id, withDefaultEase(progress)]));
  return { ...merged, atoms, profile: withDefaultGrade(merged.profile) };
}

export class ProgressStore {
  private atoms: Record<string, AtomProgress>;
  private lessons: Record<string, LessonProgress>;
  private collected: Set<string>;
  private profile: Profile | null;
  private nudgeSeen: boolean;
  private clearedExams: Set<number>;
  private writeSeq: number;
  private seededDepths: Record<string, SeededDepth>;
  /** True when the constructor actually changed the persisted shape, so
   *  `loadProgress` knows it must write the result back. See its comment. */
  readonly migrated: boolean;

  /** `now` (whole days since the epoch) is only consulted when a v1 snapshot has
   *  to be re-based; a fresh store or an already-v2 snapshot ignores it. It is
   *  still required rather than optional for a snapshot-bearing construction —
   *  making it optional is how a caller silently re-bases to day 0. */
  constructor(snapshot: ProgressSnapshot = emptySnapshot(), now?: number) {
    const s = migrate(snapshot, now);
    this.migrated = snapshot.version !== STORE_VERSION;
    this.atoms = { ...s.atoms };
    this.lessons = { ...s.lessons };
    this.collected = new Set(s.collectedFacts);
    this.profile = s.profile;
    this.nudgeSeen = s.accountNudgeSeen ?? false;
    this.clearedExams = new Set(s.clearedExams ?? []);
    this.seededDepths = { ...(s.seededDepths ?? {}) };
    // Never below the highest `seq` already banked. `writeSeq` is optional, so a
    // truncated or hand-edited snapshot can carry atoms stamped 20 with no counter
    // at all — and restarting at 0 hands the NEXT attempt `seq: 1`, which then
    // loses authority to evidence recorded long before it. Deriving the floor from
    // the data makes the counter self-healing instead of merely trusted; the stored
    // value still wins when it is ahead, which is the normal case.
    this.writeSeq = Math.max(s.writeSeq ?? 0, highestSeq(this.atoms, this.seededDepths));
  }

  /** Take the next write sequence number without persisting anything (KTD1/KTD6).
   *  Placement stamps a seed with this the moment its measurement resolves, so the
   *  ordering is fixed then rather than at the later commit — otherwise an attempt
   *  recorded in between would be wrongly out-ranked by the older measurement. */
  reserveSeq(): number {
    this.writeSeq += 1;
    return this.writeSeq;
  }

  /** The current counter, for tests and for stamping an attempt. */
  currentSeq(): number {
    return this.writeSeq;
  }

  seededDepthFor(strand: string): SeededDepth | undefined {
    return this.seededDepths[strand];
  }

  allSeededDepths(): Record<string, SeededDepth> {
    return { ...this.seededDepths };
  }

  /** Write one already-stamped seed, unless a NEWER measurement is already stored.
   *  The caller reserved its `seq` when the measurement resolved; this never
   *  allocates one.
   *
   *  The `seq` guard is the whole point of reserving early. Reservation happens at
   *  measurement time and the write happens at a later commit, so the two orders
   *  can differ: a placement that resolves first but commits last would otherwise
   *  overwrite a re-test that resolved after it. Assigning unconditionally threw
   *  away the ordering `reserveSeq` exists to establish, at the one place it is
   *  finally banked. Equal `seq` cannot happen — reservations are unique — so the
   *  comparison is strict and a replayed identical write is a no-op. */
  setSeededDepth(strand: string, seed: SeededDepth): void {
    const stored = this.seededDepths[strand];
    if (stored !== undefined && stored.seq >= seed.seq) return;
    this.seededDepths[strand] = seed;
  }

  /** How many lessons the learner has completed — the "three lessons in" trigger for the
   *  account nudge (design 6c). */
  completedLessonCount(): number {
    return Object.values(this.lessons).filter((l) => l.completed).length;
  }

  getAtom(atom: string): AtomProgress {
    return this.atoms[atom] ?? { mastery: initialMastery(), srs: initialSrs() };
  }

  /** Write one atom's progress, stamping it with the next write sequence number
   *  (G6 U1). Every recorded attempt goes through here — binary, passage
   *  sub-result and flashcard grade alike — so `srs.seq` is the single ordering
   *  fact lane-depth compares a placement seed against. */
  setAtom(atom: string, progress: AtomProgress): void {
    this.writeSeq += 1;
    this.atoms[atom] = { ...progress, srs: { ...progress.srs, seq: this.writeSeq } };
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

  getProfile(): Profile | null {
    return this.profile;
  }

  getGrade(): number | null {
    return this.profile?.grade ?? null;
  }

  setProfile(profile: Profile): void {
    this.profile = profile;
  }

  getName(): string | undefined {
    return this.profile?.name;
  }

  /** Set the account display name (design 6b). No-op if there is no profile yet —
   *  a name is an upgrade of an existing (onboarded) profile, never its creation. */
  setName(name: string): void {
    if (!this.profile) return;
    this.profile = { ...this.profile, name };
  }

  /** Whether this learner has a named account (design 6b) — the presence of a name. */
  isNamed(): boolean {
    return this.profile?.name != null && this.profile.name !== '';
  }

  isNudgeSeen(): boolean {
    return this.nudgeSeen;
  }

  markNudgeSeen(): void {
    this.nudgeSeen = true;
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

  /** Whether the grade's practice exam has been cleared (band ≥ pass) — the
   *  Level N+1 unlock signal (D4). */
  isExamCleared(grade: number): boolean {
    return this.clearedExams.has(grade);
  }

  /** Record the grade's practice exam as cleared. Set semantics — recording the
   *  same grade twice keeps one entry (idempotent, safe on a replayed exam). */
  recordExamCleared(grade: number): void {
    this.clearedExams.add(grade);
  }

  toSnapshot(): ProgressSnapshot {
    return {
      version: STORE_VERSION,
      atoms: { ...this.atoms },
      lessons: { ...this.lessons },
      collectedFacts: [...this.collected],
      profile: this.profile,
      accountNudgeSeen: this.nudgeSeen,
      clearedExams: [...this.clearedExams],
      writeSeq: this.writeSeq,
      seededDepths: { ...this.seededDepths },
    };
  }
}

/** Load, migrating if needed — and **persist the migration before returning**.
 *
 *  The v1 → v2 step re-bases every schedule onto "today". If that result is never
 *  written back, the next launch re-bases the same v1 blob onto a *later* today,
 *  walking every due date forward indefinitely: nothing is ever due, and no
 *  single-load test can see it. `now` is whole days since the epoch. */
export async function loadProgress(storage: SnapshotStorage, now?: number): Promise<ProgressStore> {
  const raw = await storage.load();
  if (!raw) return new ProgressStore(emptySnapshot(), now);
  let store: ProgressStore;
  try {
    store = new ProgressStore(JSON.parse(raw) as ProgressSnapshot, now);
  } catch {
    return new ProgressStore(emptySnapshot(), now); // corrupt blob → start fresh rather than crash
  }
  if (store.migrated) await saveProgress(store, storage);
  return store;
}

export async function saveProgress(store: ProgressStore, storage: SnapshotStorage): Promise<void> {
  await storage.save(JSON.stringify(store.toSnapshot()));
}
