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
