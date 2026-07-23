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

// D9: same anti-drift rule as level1()/level2() — unitIds and the exam-gate
// threshold derive from the grade-3 doc, never a frozen literal. Level 3 is
// still locked for real learners this slice: isLevelUnlocked gates on
// isExamCleared(2), and no Grade 2 exam paper exists yet (hasExamPaper(2) is
// false), so that gate is unreachable except via the __DEV__ seed seam.
function level3(): Level {
  const unitIds = LESSONS_BY_GRADE[3].map((l) => l.id);
  return {
    id: 'level-3',
    grade: 3,
    title: 'Grade 3',
    prerequisite: 'Clear the Level 2 exam to unlock',
    unitIds,
    examGate: { unlockAtStars: unitIds.length * 3 },
  };
}

export const LEVELS: Level[] = [level1(), level2(), level3(), ...[4, 5].map(lockedLevel)];

/** Whether a grade can be picked as a start grade (free grade access, fyu.2).
 *  Grade is a self-service choice now, so any grade that HAS content is
 *  startable — no exam gate, no store needed (onboarding runs pre-profile). A
 *  content-less grade (Grade 5 before its epic) is not startable, so the picker
 *  never offers an empty grade. Grade 4 becomes startable once level4() carries
 *  content (fyu.13). */
export function isStartableGrade(grade: number): boolean {
  const level = LEVELS.find((l) => l.grade === grade);
  return level != null && level.unitIds.length > 0;
}
