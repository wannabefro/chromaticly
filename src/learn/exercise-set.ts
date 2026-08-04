// Exercise set model (U5, KTD3): the written window plus any by-ear tail.

export const WRITTEN_ITEMS = 8;

/** chromaticly-inr — the first item of every set is a TRY, not a test. A lesson
 *  used to go straight from one worked example on the teach card to eight scored
 *  questions, with nothing in between. The warm-up is an ordinary item of the
 *  set — same generator, same shell — that simply lands no gem and has its smart
 *  tip already open.
 *
 *  Counted in the presented length, excluded from the scored one. */
export const WARM_UP_ITEMS = 1;

/** 0 or 1: 22 of 91 lessons emit no notation to compare against (KTD4). */
export function byEarCountFor(lesson: { by_ear_source?: string | null }): number {
  return lesson.by_ear_source ? 1 : 0;
}

export function presentedLengthFor(lesson: { by_ear_source?: string | null }): number {
  return WRITTEN_ITEMS + byEarCountFor(lesson);
}

export function scoredLengthFor(lesson: { by_ear_source?: string | null }): number {
  return presentedLengthFor(lesson) - WARM_UP_ITEMS;
}

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
 *  means. Throws once the set already holds `scoredLength` items. */
export function recordItem(
  state: ExerciseSetState,
  result: { correct: boolean; hintsUsed: number },
  scoredLength: number,
): ExerciseSetState {
  if (state.gems.length >= scoredLength) {
    throw new Error(`exercise set already has ${scoredLength} recorded items`);
  }
  return { gems: [...state.gems, classifyGem(result)] };
}

export function isComplete(state: ExerciseSetState, scoredLength: number): boolean {
  return state.gems.length === scoredLength;
}

export function gems(state: ExerciseSetState): Gem[] {
  return [...state.gems];
}

export function score(state: ExerciseSetState): number {
  return state.gems.filter((g) => g !== 'missed').length;
}

/** Per-slot state for the ProgressSegments header, length `presentedLength`. The lead-in
 *  slots are always `warmup` — dashed, never filled, because there is nothing to
 *  earn there. After them: recorded correct (clean/hinted) → 'done', recorded
 *  incorrect (missed) → 'incorrect', the next unrecorded slot → 'current', the
 *  rest → 'todo'.
 *
 *  `currentIndex` is a PRESENTED index, the same counter
 *  SetRunner advances — not a gem index. It defaults to the slot after the last
 *  recorded gem. */
export function segmentStates(
  state: ExerciseSetState,
  presentedLength: number,
  currentIndex: number = state.gems.length + WARM_UP_ITEMS,
): SegmentState[] {
  return Array.from({ length: presentedLength }, (_, i) => {
    if (i < WARM_UP_ITEMS) return 'warmup';
    const gemIndex = i - WARM_UP_ITEMS;
    if (gemIndex < state.gems.length) return state.gems[gemIndex] === 'missed' ? 'incorrect' : 'done';
    if (i === currentIndex) return 'current';
    return 'todo';
  });
}
