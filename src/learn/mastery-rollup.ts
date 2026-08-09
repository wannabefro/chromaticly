// 0-3 star mastery rollup (U1, RD3). A pure derivation over the existing
// per-atom MasteryState — no new stored aggregate. deriveStars is a
// fraction-of-atoms-mastered threshold, monotone and atom-count-agnostic:
// 0 -> 0 mastered; (0, 2/3) -> 1 star; [2/3, 1) -> 2 stars; 1 -> 3 stars.
// A 1-atom unit is therefore 0 or 3 stars by nature (RD3, accepted).

import type { Lesson } from '../content/lessons';
import type { Level } from '../content/levels';
import { laneDepths, STRAND_ORDER } from './lane-depth';
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

/** One strand's standing against a paper. `examined: false` means the paper has
 *  no section for it at this grade — a fact about the PAPER, not a gap in the
 *  learner. */
export interface ReadinessRow {
  strand: string;
  examined: boolean;
  /** The section's title, for naming the shortfall in the learner's words. */
  sectionTitle?: string;
  /** Marks this section is worth. What being short of it actually costs. */
  marks: number;
  depth: number;
  /** True when the strand is examined and its depth is below the paper's grade. */
  short: boolean;
}

export interface ExamReadiness {
  grade: number;
  rows: ReadinessRow[];
  /** Examined strands below the paper's grade, weakest first. Empty when ready. */
  shortfalls: ReadinessRow[];
  /** Marks at risk: the sum of the shortfalls' section marks. */
  marksAtRisk: number;
  totalMarks: number;
  ready: boolean;
}

/** Exam readiness for a grade (design 7d, R6 as amended).
 *
 *  Readiness is a VECTOR COMPARISON — every examined strand's lane depth against
 *  the paper's grade — not a stars fraction. The fraction could not say which
 *  skill was short or what being short of it cost, and it moved when a strand
 *  the paper never asks about moved.
 *
 *  KTD8, the false-shortfall regression this shape exists to prevent: a paper
 *  asks about the strands it HAS SECTIONS FOR. The Grade 1 paper has five, and
 *  chords is not among them, so a fresh learner at chords depth 0 is not short of
 *  anything — chords is simply not examined at this grade. Deriving shortfalls
 *  from all seven strands reported two phantom gaps to every Grade 1 learner
 *  alive, and told them to go and fix material that does not exist below grade 4.
 *
 *  Readiness NEVER blocks (R6). There is no gate field to consult: the paper is
 *  startable at any depth, and this only tells the learner what it will cost. */
export function examReadiness(
  grade: number,
  sections: { strand: string; title: string }[],
  depthByStrand: Record<string, { depth: number }>,
  marksPerSection: number,
): ExamReadiness {
  const examined = new Map(sections.map((s) => [s.strand, s.title]));

  const rows: ReadinessRow[] = STRAND_ORDER.map((strand) => {
    const sectionTitle = examined.get(strand);
    const depth = depthByStrand[strand]?.depth ?? 0;
    return {
      strand,
      examined: sectionTitle !== undefined,
      sectionTitle,
      marks: sectionTitle === undefined ? 0 : marksPerSection,
      depth,
      short: sectionTitle !== undefined && depth < grade,
    };
  });

  // Weakest first, so the learner reads the biggest hole at the top. Ties break on
  // STRAND_ORDER, which `rows` is already in — a stable sort keeps it.
  const shortfalls = rows.filter((r) => r.short).sort((a, b) => a.depth - b.depth);

  return {
    grade,
    rows,
    shortfalls,
    marksAtRisk: shortfalls.reduce((sum, r) => sum + r.marks, 0),
    totalMarks: sections.length * marksPerSection,
    ready: shortfalls.length === 0,
  };
}

