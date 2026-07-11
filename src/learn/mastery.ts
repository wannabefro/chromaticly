// Per-atom mastery tracking (U11, KTD10). An atom is mastered after
// MASTERY_THRESHOLD consecutive *hint-free* correct attempts; a wrong answer
// or a hint-assisted correct resets the streak. Mastery is sticky — once
// earned it is not lost by a later slip (the streak is the live signal;
// `mastered` is the achievement). Pure: state in, state out.

import type { AttemptResult } from '../ui/grading';

export const MASTERY_THRESHOLD = 3;

export interface MasteryState {
  streak: number;
  mastered: boolean;
}

export function initialMastery(): MasteryState {
  return { streak: 0, mastered: false };
}

/** Fold one attempt into an atom's mastery state. Only a hint-free correct
 *  advances the streak; anything else resets it to zero. */
export function recordAttempt(state: MasteryState, attempt: Pick<AttemptResult, 'correct' | 'hintsUsed'>): MasteryState {
  const unaidedCorrect = attempt.correct && attempt.hintsUsed === 0;
  const streak = unaidedCorrect ? state.streak + 1 : 0;
  return {
    streak,
    mastered: state.mastered || streak >= MASTERY_THRESHOLD,
  };
}

/** A lesson is complete once every atom it teaches is mastered. */
export function lessonComplete(atoms: string[], masteryOf: (atom: string) => MasteryState | undefined): boolean {
  return atoms.every((atom) => masteryOf(atom)?.mastered === true);
}
