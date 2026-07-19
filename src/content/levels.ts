// Level/grade model (U1, AD7). Level 1's unit list derives dynamically from
// LESSONS_BY_GRADE[1] rather than a frozen id literal, so a later content
// restructure (U9) can't silently invalidate this file — one row per grade-1
// lesson, always, and a later grade-2 doc registering can never inflate it.
// Level 2 (U5) derives the same way from LESSONS_BY_GRADE[2]. Levels 3-5 are
// still locked placeholders: no content, no unlock path yet (RD1/R1/R4).
// Whether a level is reachable is NOT a field here — it is a derivation over
// the store (`isLevelUnlocked`, `src/learn/mastery-rollup.ts`, D5), so it can
// never drift out of sync with the persisted exam-clear record. This module
// must stay RN/expo-free (core-boundary test).

import { LESSONS_BY_GRADE } from './lessons';

export interface Level {
  id: string;
  grade: number;
  title: string;
  prerequisite?: string;
  unitIds: string[];
  examGate: { unlockAtStars: number };
}

function lockedLevel(grade: number): Level {
  return {
    id: `level-${grade}`,
    grade,
    title: `Grade ${grade}`,
    // D5: per-level, not the old shared "Clear the Level 1 exam to unlock" —
    // fixes the latent Level-3-5 copy bug (every level's gate is its OWN
    // previous grade's exam, not always Level 1).
    prerequisite: `Clear the Level ${grade - 1} exam to unlock`,
    unitIds: [],
    examGate: { unlockAtStars: 0 },
  };
}

function level1(): Level {
  const unitIds = LESSONS_BY_GRADE[1].map((l) => l.id);
  return {
    id: 'level-1',
    grade: 1,
    title: 'Grade 1',
    unitIds,
    examGate: { unlockAtStars: unitIds.length * 3 },
  };
}

// D5: same anti-drift rule as level1() — unitIds and the exam-gate threshold
// derive from the grade-2 doc, never a frozen literal.
function level2(): Level {
  const unitIds = LESSONS_BY_GRADE[2].map((l) => l.id);
  return {
    id: 'level-2',
    grade: 2,
    title: 'Grade 2',
    prerequisite: 'Clear the Level 1 exam to unlock',
    unitIds,
    examGate: { unlockAtStars: unitIds.length * 3 },
  };
}

export const LEVELS: Level[] = [level1(), level2(), ...[3, 4, 5].map(lockedLevel)];

/** Whether a grade can be picked as an onboarding start grade (D14). This is
 *  deliberately a static content concept, NOT `isLevelUnlocked` — onboarding
 *  runs pre-profile (no store to read) and must not let a device where a
 *  later grade's exam was cleared offer that grade to a brand-new learner.
 *  Grade 1 only, until onboarding into higher grades is designed. */
export function isStartableGrade(grade: number): boolean {
  return grade === 1;
}
