// 0-3 star mastery rollup (U1, RD3). A pure derivation over the existing
// per-atom MasteryState — no new stored aggregate. deriveStars is a
// fraction-of-atoms-mastered threshold, monotone and atom-count-agnostic:
// 0 -> 0 mastered; (0, 2/3) -> 1 star; [2/3, 1) -> 2 stars; 1 -> 3 stars.
// A 1-atom unit is therefore 0 or 3 stars by nature (RD3, accepted).

import type { Lesson } from '../content/lessons';
import type { Level } from '../content/levels';
import { laneDepths } from './lane-depth';
import { selectDue } from './srs';
import type { ProgressStore } from './store';

export function deriveStars(atomIds: string[], store: ProgressStore): 0 | 1 | 2 | 3 {
  const total = atomIds.length;
  if (total === 0) return 0;

  const mastered = atomIds.filter((atom) => store.masteryOf(atom)?.mastered === true).length;
  if (mastered === 0) return 0;
  if (mastered === total) return 3;
  return mastered / total >= 2 / 3 ? 2 : 1;
}

/** Real, backed stats for the account nudge's stat card (design 6c) — no invented
 *  numbers. Lessons = completed count; stars = total 0-3 stars summed over every
 *  lesson (the same derivation the app shows elsewhere); dueCount = review-queue size
 *  at logical time `now`, over ATTEMPTED atoms only — which is Practice eligibility
 *  since G6 U3 (nothing is locked; review reaches what the learner has met). */
export function accountNudgeStats(
  store: ProgressStore,
  lessons: Lesson[],
  now: number,
): { lessons: number; stars: number; dueCount: number } {
  const stars = lessons.reduce((sum, l) => sum + deriveStars(l.atoms, store), 0);
  const dueCount = selectDue(store.atomEntries(), now).length;
  return { lessons: store.completedLessonCount(), stars, dueCount };
}

export interface StrandMastery {
  /** Content-bearing grades currently HELD in this strand. */
  mastered: number;
  /** Content-bearing grades this strand teaches at all. */
  total: number;
  /** 0..1 — held grades over content-bearing grades. */
  value: number;
}

/** Whole-profile mastery per strand (design 6d radar), as a PROJECTION of the one
 *  lane-depth derivation (G6 U4, R3).
 *
 *  R3 says the Learn tab, the radar, exam readiness and the placement result must
 *  never disagree. That is made structural rather than conventional: they all read
 *  `laneDepths`, and this function only reshapes it into the `{ mastered, total,
 *  value }` StrandRadar already consumes. Two consequences worth stating:
 *
 *  • The ratio is `heldGrades.length / contentGrades.length`, NOT `depth / 5` and
 *    not `depth / highestContentGrade`. Four of the seven strands are sparse today
 *    — chords has nothing below grade 4 — so a denominator of 5 would permanently
 *    cap chords at 0.4 for a learner who holds everything that exists.
 *  • It counts `heldGrades`, not `depth`. Under a sparse matrix a learner can hold
 *    G4 while G3 is unheld; `depth` reads 1 there by design (it is contiguous
 *    progress), but the radar answers "how much of this do you know", so it counts
 *    the holds (KTD5/KTD10). Reading `depth` alone would silently under-report.
 *
 *  Keyed by strand string — the canonical 7-strand order lives in the UI layer,
 *  which the core must not import (core-boundary). */
export function strandMastery(store: ProgressStore, now: number): Record<string, StrandMastery> {
  const out: Record<string, StrandMastery> = {};
  for (const [strand, lane] of Object.entries(laneDepths(store, now))) {
    const total = lane.contentGrades.length;
    const mastered = lane.heldGrades.length;
    out[strand] = { mastered, total, value: total === 0 ? 0 : mastered / total };
  }
  return out;
}

/** G6 U3 retired `'locked'`: under non-linear progression nothing is gated, so a
 *  row can no longer be in that state. The union survives (minus that member)
 *  until U12 deletes this derivation with the level map. */
export type UnitState = 'active' | 'started' | 'done';

/** Per-unit state for the level map. Only one not-yet-started unit can be the
 *  frontier — the first such unit in list order is marked `active`; any other
 *  non-done unit (partial stars, or a later 0-star unit) is `started`. */
export function unitStates(
  unitIds: string[],
  store: ProgressStore,
  lessonAtoms: (id: string) => string[],
): { unitId: string; stars: 0 | 1 | 2 | 3; state: UnitState }[] {
  let activeAssigned = false;

  return unitIds.map((unitId) => {
    const stars = deriveStars(lessonAtoms(unitId), store);
    if (stars === 3) return { unitId, stars, state: 'done' as const };
    if (stars === 0 && !activeAssigned) {
      activeAssigned = true;
      return { unitId, stars, state: 'active' as const };
    }
    return { unitId, stars, state: 'started' as const };
  });
}

export interface ExamReadiness {
  stars: number;
  maxStars: number;
  /** 0..1 — how far through the level's stars the learner is. */
  fraction: number;
  /** True once the level's exam gate opens. */
  gateOpen: boolean;
  /** The strands holding the learner back, weakest first. Empty at full mastery. */
  weakest: string[];
}

/** Exam readiness for a level (design 5c). Readiness is stars-earned over
 *  stars-available — the same signal the exam gate itself uses — so the ring can
 *  never disagree with whether the paper is actually open. */
export function examReadiness(
  unitIds: string[],
  store: ProgressStore,
  lesson: (id: string) => { atoms: string[]; strand: string } | undefined,
  unlockAtStars: number,
): ExamReadiness {
  const rows = unitIds.map((id) => ({
    stars: deriveStars(lesson(id)?.atoms ?? [], store),
    strand: lesson(id)?.strand ?? 'unknown',
  }));

  const stars = rows.reduce((sum, r) => sum + r.stars, 0);
  const maxStars = unitIds.length * 3;

  // A strand is weak while any of its units is short of full marks; the least-starred
  // strand is the one holding the learner back.
  const byStrand = new Map<string, number>();
  for (const row of rows) {
    byStrand.set(row.strand, Math.min(byStrand.get(row.strand) ?? 3, row.stars));
  }
  const weakest = [...byStrand.entries()]
    .filter(([, s]) => s < 3)
    .sort((a, b) => a[1] - b[1])
    .map(([strand]) => strand);

  return {
    stars,
    maxStars,
    fraction: maxStars === 0 ? 0 : stars / maxStars,
    gateOpen: stars >= unlockAtStars,
    weakest,
  };
}

/** Whether a level is REACHABLE. Under free grade access (fyu.2) grade is a
 *  self-service choice, not an exam-gated climb, so a level is reachable iff it
 *  has content — the exam clear is no longer a gate. Grade 1 is always
 *  reachable; a content-less level (e.g. Grade 5 before its epic) stays
 *  unreachable, so a level never "opens" onto nothing and the not-ready grades
 *  hide rather than showing empty (R1, R6). `store` is retained in the
 *  signature for call-site stability but no longer consulted. */
export function isLevelUnlocked(level: Level, _store?: ProgressStore): boolean {
  return level.grade === 1 || level.unitIds.length > 0;
}

/** The learner's CURRENT position — their working grade (fyu.2, KTD8). Under
 *  free grade access this is the grade the learner has chosen (Profile.grade),
 *  NOT the highest reachable level: with the exam gate gone every content level
 *  is reachable, so "highest reachable" would always jump to the top grade and
 *  misreport where the learner actually is. Drives the grade pill, the Profile
 *  readiness card, and the level-map active highlight. Falls back to Level 1. */
export function currentLevel(levels: Level[], store: ProgressStore): Level {
  const workingGrade = store.getGrade() ?? 1;
  return levels.find((l) => l.grade === workingGrade) ?? levels[0];
}
