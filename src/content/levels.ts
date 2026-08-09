// Level/grade model (U1, AD7). Level 1's unit list derives dynamically from
// LESSONS_BY_GRADE[1] rather than a frozen id literal, so a later content
// restructure (U9) can't silently invalidate this file — one row per grade-1
// lesson, always, and a later grade-2 doc registering can never inflate it.
// Level 2 (U5) derives the same way from LESSONS_BY_GRADE[2]. Levels 3-5 now all
// carry real content and derive their unit lists the same way (Grade 5 shipped
// its slice, chromaticly-ehp), so there are no content-less placeholder levels
// left. Whether a level is reachable is NOT a field here — it is a derivation over
// the store (U12 deleted that derivation; content presence is now the whole of
// never drift out of sync with the persisted exam-clear record. This module
// must stay RN/expo-free (core-boundary test).

import { LESSONS_BY_GRADE } from './lessons';

export interface Level {
  id: string;
  grade: number;
  title: string;
  prerequisite?: string;
  unitIds: string[];
  /** ABSENT on a level that cannot be sat. ABRSM has no Grade 0 theory paper, so
   *  First steps has no honest gate, and absence is the honest representation:
   *  a sentinel would still render a row promising a paper that will never exist.
   *  Optional rather than nullable so TypeScript names every consumer. */
  examGate?: { unlockAtStars: number };
}

/** First steps (chromaticly-dhe) — the starter level below Grade 1. Same
 *  anti-drift rule as level1()-level5(): unitIds derive from the doc.
 *
 *  No examGate and no prerequisite. There is no Grade 0 paper to sit, so the gate
 *  that opens Grade 1 is the unit list itself. `title` is the user-facing name —
 *  "Grade 0" is the internal key and appears in no copy, because a zero reads as
 *  a failing mark to an adult beginner. */
function level0(): Level {
  return {
    id: 'level-0',
    grade: 0,
    title: 'First steps',
    unitIds: LESSONS_BY_GRADE[0].map((l) => l.id),
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
// still locked for real learners this slice: reachability gates on
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

// fyu.13: Grade 4 is now real — unitIds and the exam-gate threshold derive from
// the grade-4 doc, same anti-drift rule as level1()–level3(). This is what makes
// Grade 4 startable (isStartableGrade), content-ful, and walkable
// end-to-end for a real learner.
function level4(): Level {
  const unitIds = LESSONS_BY_GRADE[4].map((l) => l.id);
  return {
    id: 'level-4',
    grade: 4,
    title: 'Grade 4',
    prerequisite: 'Clear the Level 3 exam to unlock',
    unitIds,
    examGate: { unlockAtStars: unitIds.length * 3 },
  };
}

// chromaticly-ehp: Grade 5 is now real — its content slice (chord inversions,
// transposing instruments, ornament→sign, metre rewrite) shipped, so unitIds
// derive from the grade-5 doc like every level above. This is what surfaces the
// Grade-5 lessons on the level map / grade picker; without it the content exists
// in the engine but renders as a collapsed content-less preview (the gap the
// on-device gate caught).
function level5(): Level {
  const unitIds = LESSONS_BY_GRADE[5].map((l) => l.id);
  return {
    id: 'level-5',
    grade: 5,
    title: 'Grade 5',
    prerequisite: 'Clear the Level 4 exam to unlock',
    unitIds,
    examGate: { unlockAtStars: unitIds.length * 3 },
  };
}

export const LEVELS: Level[] = [level0(), level1(), level2(), level3(), level4(), level5()];

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
