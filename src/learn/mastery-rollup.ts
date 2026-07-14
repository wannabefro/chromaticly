// 0-3 star mastery rollup (U1, RD3). A pure derivation over the existing
// per-atom MasteryState — no new stored aggregate. deriveStars is a
// fraction-of-atoms-mastered threshold, monotone and atom-count-agnostic:
// 0 -> 0 mastered; (0, 2/3) -> 1 star; [2/3, 1) -> 2 stars; 1 -> 3 stars.
// A 1-atom unit is therefore 0 or 3 stars by nature (RD3, accepted).

import type { ProgressStore } from './store';

export function deriveStars(atomIds: string[], store: ProgressStore): 0 | 1 | 2 | 3 {
  const total = atomIds.length;
  if (total === 0) return 0;

  const mastered = atomIds.filter((atom) => store.masteryOf(atom)?.mastered === true).length;
  if (mastered === 0) return 0;
  if (mastered === total) return 3;
  return mastered / total >= 2 / 3 ? 2 : 1;
}

export type UnitState = 'locked' | 'active' | 'started' | 'done';

/** Per-unit state for the level map. In a linear unlock chain only one
 *  unlocked, not-yet-started unit can be the frontier — the first such unit
 *  in list order is marked `active`; any other unlocked, non-done unit
 *  (partial stars, or a later 0-star unit) is `started`. */
export function unitStates(
  unitIds: string[],
  store: ProgressStore,
  lessonAtoms: (id: string) => string[],
): { unitId: string; stars: 0 | 1 | 2 | 3; state: UnitState }[] {
  let activeAssigned = false;

  return unitIds.map((unitId) => {
    if (!store.isUnlocked(unitId)) return { unitId, stars: 0 as const, state: 'locked' as const };

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
