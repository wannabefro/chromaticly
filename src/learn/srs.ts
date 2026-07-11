// Leitner-lite spaced repetition (U11). Each atom sits in a box; a correct
// attempt promotes it (longer interval before it's due again), a wrong attempt
// demotes it to box 0 (due immediately). Time is a caller-supplied logical
// clock (an integer "tick"), so scheduling is deterministic and testable
// without a wall clock — the app advances `now` per review; tests pass explicit
// ticks. Practice draws the most-due, weakest atoms first.

export const BOX_INTERVALS: readonly number[] = [0, 1, 2, 4, 8];
const MAX_BOX = BOX_INTERVALS.length - 1;

export interface SrsState {
  box: number;
  lastReviewed: number;
  nextDue: number;
}

export function initialSrs(now = 0): SrsState {
  return { box: 0, lastReviewed: now, nextDue: now };
}

/** Fold one attempt into an atom's SRS state at logical time `now`. */
export function reviewSrs(state: SrsState, correct: boolean, now: number): SrsState {
  const box = correct ? Math.min(state.box + 1, MAX_BOX) : 0;
  return { box, lastReviewed: now, nextDue: now + BOX_INTERVALS[box] };
}

export function isDue(state: SrsState, now: number): boolean {
  return now >= state.nextDue;
}

/** Ordering key for Practice: due atoms before not-due, then weaker (lower box)
 *  and longer-overdue first. Lower sorts earlier. */
export function duePriority(state: SrsState, now: number): number {
  const overdue = now - state.nextDue; // >= 0 when due
  if (overdue < 0) return 1_000_000 - overdue; // not due yet: pushed to the back, soonest-due first
  return state.box * 1000 - overdue; // due: weakest box first, most-overdue first
}

/** The atoms Practice should serve now, most-due-and-weakest first, restricted
 *  to `eligible` (e.g. atoms from unlocked lessons only). */
export function selectDue(
  entries: { atom: string; srs: SrsState }[],
  now: number,
  eligible: (atom: string) => boolean,
): string[] {
  return entries
    .filter((e) => eligible(e.atom))
    .filter((e) => isDue(e.srs, now))
    .sort((a, b) => duePriority(a.srs, now) - duePriority(b.srs, now))
    .map((e) => e.atom);
}
