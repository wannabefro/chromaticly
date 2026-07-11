// Fixed-length exercise set model (U5, KTD3). A "set" is exactly SET_SIZE
// items long; each item lands one of three mastery gems: clean (correct, no
// hint), hinted (correct, but a hint was used), or missed (incorrect). A
// hinted-correct must never read as clean — that parity with the streak-based
// mastery rule (KTD10, src/learn/mastery.ts) is the whole point of the
// three-way split instead of a boolean. Pure: state in, state out.

export const SET_SIZE = 8;

export type Gem = 'clean' | 'hinted' | 'missed';

export type SegmentState = 'done' | 'incorrect' | 'current' | 'todo';

export interface ExerciseSetState {
  readonly gems: readonly Gem[];
}

/** Classify one item result into its mastery gem. */
export function classifyGem(result: { correct: boolean; hintsUsed: number }): Gem {
  if (!result.correct) return 'missed';
  return result.hintsUsed === 0 ? 'clean' : 'hinted';
}

export function emptySet(): ExerciseSetState {
  return { gems: [] };
}

/** Fold one item result into the set. Throws once the set already holds
 *  SET_SIZE items — a set is fixed-length, so a 9th record is a caller bug. */
export function recordItem(state: ExerciseSetState, result: { correct: boolean; hintsUsed: number }): ExerciseSetState {
  if (state.gems.length >= SET_SIZE) {
    throw new Error(`exercise set already has ${SET_SIZE} recorded items`);
  }
  return { gems: [...state.gems, classifyGem(result)] };
}

export function isComplete(state: ExerciseSetState): boolean {
  return state.gems.length === SET_SIZE;
}

export function gems(state: ExerciseSetState): Gem[] {
  return [...state.gems];
}

/** Score for the "X/8" ring: correct items, hinted or not. */
export function score(state: ExerciseSetState): number {
  return state.gems.filter((g) => g !== 'missed').length;
}

/** Per-slot state for the ProgressSegments header, length SET_SIZE: recorded
 *  correct (clean/hinted) → 'done', recorded incorrect (missed) → 'incorrect',
 *  the next unrecorded slot → 'current', the rest → 'todo'. `currentIndex`
 *  defaults to the next unrecorded slot but can be overridden by the caller. */
export function segmentStates(state: ExerciseSetState, currentIndex: number = state.gems.length): SegmentState[] {
  return Array.from({ length: SET_SIZE }, (_, i) => {
    if (i < state.gems.length) return state.gems[i] === 'missed' ? 'incorrect' : 'done';
    if (i === currentIndex) return 'current';
    return 'todo';
  });
}
