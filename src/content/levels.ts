// Level/grade model (U1, AD7). Level 1's unit list derives dynamically from
// LESSONS rather than a frozen id literal, so a later content restructure
// (U9) can't silently invalidate this file — one row per lesson, always.
// Levels 2-5 are locked placeholders: no content, no unlock path yet
// (RD1/R1/R4). This module must stay RN/expo-free (core-boundary test).

import { LESSONS } from './lessons';

export interface Level {
  id: string;
  grade: number;
  title: string;
  unlocked: boolean;
  prerequisite?: string;
  unitIds: string[];
  examGate: { unlockAtStars: number };
}

const LOCKED_PREREQUISITE = 'Clear the Level 1 exam to unlock';

function lockedLevel(grade: number): Level {
  return {
    id: `level-${grade}`,
    grade,
    title: `Grade ${grade}`,
    unlocked: false,
    prerequisite: LOCKED_PREREQUISITE,
    unitIds: [],
    examGate: { unlockAtStars: 0 },
  };
}

function level1(): Level {
  const unitIds = LESSONS.map((l) => l.id);
  return {
    id: 'level-1',
    grade: 1,
    title: 'Grade 1',
    unlocked: true,
    unitIds,
    examGate: { unlockAtStars: unitIds.length * 3 },
  };
}

export const LEVELS: Level[] = [level1(), ...[2, 3, 4, 5].map(lockedLevel)];
