// Fixed-length exercise set model (U5, KTD3). A "set" is exactly SET_SIZE
// items long; each item lands one of three mastery gems: clean (correct, no
// hint), hinted (correct, but a hint was used), or missed (incorrect). A
// hinted-correct must never read as clean — that parity with the streak-based
// mastery rule (KTD10, src/learn/mastery.ts) is the whole point of the
// three-way split instead of a boolean. Pure: state in, state out.

export const SET_SIZE = 8;

/** chromaticly-inr — the first item of every set is a TRY, not a test. A lesson
 *  used to go straight from one worked example on the teach card to eight scored
 *  questions, with nothing in between. The warm-up is an ordinary item of the
 *  set — same generator, same shell — that simply lands no gem and has its smart
 *  tip already open.
 *
 *  It is counted in SET_SIZE (eight items are still presented, and the seed
 *  window per play is unchanged) and excluded from SCORED_SIZE. Keeping both
 *  numbers named, rather than writing 7 anywhere, is what stops the score ring
 *  and the progress bar from disagreeing about what a set is. */
export const WARM_UP_ITEMS = 1;

/** Items that land a gem: SET_SIZE minus the warm-up. */
export const SCORED_SIZE = SET_SIZE - WARM_UP_ITEMS;

export type Gem = 'clean' | 'hinted' | 'missed';

/** `warmup` is the dashed lead-in slot — drawn, never earned. */
export type SegmentState = 'warmup' | 'done' | 'incorrect' | 'current' | 'todo';

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

/** Fold one SCORED item result into the set. The warm-up never reaches here —
 *  it is presented and then dropped, which is what "this one doesn't count"
 *  means. Throws once the set already holds SCORED_SIZE items. */
export function recordItem(state: ExerciseSetState, result: { correct: boolean; hintsUsed: number }): ExerciseSetState {
  if (state.gems.length >= SCORED_SIZE) {
    throw new Error(`exercise set already has ${SCORED_SIZE} recorded items`);
  }
  return { gems: [...state.gems, classifyGem(result)] };
}

export function isComplete(state: ExerciseSetState): boolean {
  return state.gems.length === SCORED_SIZE;
}

export function gems(state: ExerciseSetState): Gem[] {
  return [...state.gems];
}

/** Score for the "X/7" ring: correct items, hinted or not. */
export function score(state: ExerciseSetState): number {
  return state.gems.filter((g) => g !== 'missed').length;
}

/** Per-slot state for the ProgressSegments header, length SET_SIZE. The lead-in
 *  slots are always `warmup` — dashed, never filled, because there is nothing to
 *  earn there. After them: recorded correct (clean/hinted) → 'done', recorded
 *  incorrect (missed) → 'incorrect', the next unrecorded slot → 'current', the
 *  rest → 'todo'.
 *
 *  `currentIndex` is a PRESENTED index (0..SET_SIZE-1), the same counter
 *  SetRunner advances — not a gem index. It defaults to the slot after the last
 *  recorded gem. */
export function segmentStates(
  state: ExerciseSetState,
  currentIndex: number = state.gems.length + WARM_UP_ITEMS,
): SegmentState[] {
  return Array.from({ length: SET_SIZE }, (_, i) => {
    if (i < WARM_UP_ITEMS) return 'warmup';
    const gemIndex = i - WARM_UP_ITEMS;
    if (gemIndex < state.gems.length) return state.gems[gemIndex] === 'missed' ? 'incorrect' : 'done';
    if (i === currentIndex) return 'current';
    return 'todo';
  });
}
