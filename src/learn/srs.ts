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
  /** Ease factor for the graded (flashcard) path only — undefined on atoms that
   *  have only ever gone through the binary `reviewSrs` path, or on a snapshot
   *  persisted before U6. `reviewSrsGraded` defaults it; the binary path never
   *  reads or writes it. */
  ease?: number;
  /** The store's `writeSeq` at the moment this atom was last reviewed (G6 U1).
   *  Additive/optional — back-filled to 0 by the v2 migration. Nothing in `srs.ts`
   *  reads it: it exists so lane-depth can order a placement seed against an
   *  attempt made *the same day*, which `lastReviewed` cannot do. Days measure
   *  staleness; `seq` decides authority. */
  seq?: number;
}

export function initialSrs(now = 0): SrsState {
  return { box: 0, lastReviewed: now, nextDue: now };
}

/** Fold one attempt into an atom's SRS state at logical time `now`. */
export function reviewSrs(state: SrsState, correct: boolean, now: number): SrsState {
  const box = correct ? Math.min(state.box + 1, MAX_BOX) : 0;
  return { box, lastReviewed: now, nextDue: now + BOX_INTERVALS[box] };
}

// --- Graded SRS (U6, AD4): self-graded flashcards (Again/Hard/Good/Easy) get
// their own scheduling path — the binary `reviewSrs` above is untouched. An
// SM-2-style ease factor scales a per-grade base interval so the resulting gap
// is strictly monotonic (Again < Hard < Good < Easy) across the whole clamped
// ease range: bases are 0/1/2/4 (a doubling-ish ladder) and ease moves in the
// same rank order as the grade (again lowers it most, easy raises it most), so
// the product base(grade) * ease(grade) is provably increasing — see srs.test.ts.

export type SrsGrade = 'again' | 'hard' | 'good' | 'easy';

export const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 3.5;

const GRADE_BASE_INTERVAL: Record<SrsGrade, number> = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 4,
};

const GRADE_EASE_DELTA: Record<SrsGrade, number> = {
  again: -0.2,
  hard: -0.05,
  good: 0,
  easy: 0.15,
};

function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, ease));
}

/** Fold one self-graded flashcard review into an atom's SRS state. Distinct
 *  from `reviewSrs` — no correct/incorrect verdict, just a grade that both
 *  reschedules (via the interval table) and adjusts the ease factor. */
export function reviewSrsGraded(state: SrsState, grade: SrsGrade, now: number): SrsState {
  const ease = clampEase((state.ease ?? DEFAULT_EASE) + GRADE_EASE_DELTA[grade]);
  const box = grade === 'again' ? 0 : Math.min(state.box + 1, MAX_BOX);
  const interval = Math.round(GRADE_BASE_INTERVAL[grade] * ease);
  return { box, ease, lastReviewed: now, nextDue: now + interval };
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
