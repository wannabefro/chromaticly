// The learning clock (G6 U1, KTD1). SRS scheduling used to run on a per-screen
// `tickRef` seeded at 0, so `nextDue` was measured in "attempts this session"
// and nothing was ever meaningfully due after an app restart. This port makes
// time real and, critically, *shared*: one clock behind the whole domain core,
// injectable in tests.
//
// Two quantities, two jobs — conflating them is a bug the plan was caught on
// twice:
//   • `now()` is whole days since the epoch, and drives SRS scheduling and
//     staleness. Days keep BOX_INTERVALS ([0,1,2,4,8]) meaningful unchanged.
//   • the store's `writeSeq` (see store.ts) is a monotonic counter that decides
//     *authority* between a placement seed and a recorded attempt. Days cannot
//     do that job: a seed and an attempt written the same day are indistinguish-
//     able by date, and the per-skill re-test depends on exactly that ordering.
//
// Portable core: no react-native/expo import (src/core-boundary.test.ts).

/** Whole days since the Unix epoch — the unit every SRS interval is measured in. */
export interface Clock {
  now(): number;
}

export const MS_PER_DAY = 86_400_000;

/** Whole days since the epoch for a millisecond timestamp. Floored, so every
 *  instant within a calendar-ish day maps to one integer and `now()` is
 *  non-decreasing. */
export function daysSinceEpoch(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

/** A clock driven by an explicit millisecond source. The platform adapter passes
 *  `Date.now`; tests pass a fake they advance by hand. */
export function clockFrom(nowMs: () => number): Clock {
  return { now: () => daysSinceEpoch(nowMs()) };
}

/** A test clock whose day can be set directly. Not for production use — the app
 *  builds its clock from the platform adapter (src/platform/system-clock.ts). */
export function fixedClock(startDay = 0): Clock & { set(day: number): void; advance(days: number): void } {
  let day = startDay;
  return {
    now: () => day,
    set: (d) => {
      day = d;
    },
    advance: (d) => {
      day += d;
    },
  };
}

/** The core's own fallback clock. `Date.now()` is a JS builtin, not a platform
 *  API, so this keeps `src/learn` free of any `src/platform` import (the core
 *  boundary runs one way only). The app still injects `systemClock` explicitly at
 *  the edge; this is what an un-injected core call falls back to, and what makes
 *  the clock parameter optional for the many tests that do not care about time. */
export const defaultClock: Clock = clockFrom(() => Date.now());
