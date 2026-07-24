// Shared rest arithmetic for rest_completion (chromaticly-gni). A leaf module
// (imports only bar-math's bar totals + types) so both the generator and the
// validator's restCompletionHook can use it without a validator→generator
// import cycle — the same role bar-math plays for bar_validity/add_time_signature.
//
// REST_UNITS is in bar-math's demisemiquaver = 1 scale (crotchet = 8) so a rest
// gap can be compared directly against barUnitsFor(sig). It extends bar-math's
// UNITS with the breve (64) — bar-math deliberately stops at semibreve because
// no simple bar holds a breve, but a breve REST is exactly what Grade 4 teaches,
// so rest_completion owns its own table rather than reusing bar-math's (Codex C4).

import type { Duration } from '../../music/types';
import { barUnitsFor } from './bar-math';

export const REST_UNITS: Record<Duration, number> = {
  demisemiquaver: 1,
  semiquaver: 2,
  quaver: 4,
  crotchet: 8,
  minim: 16,
  semibreve: 32,
  breve: 64,
};

/** The graded answer/label for a rest of a given duration, e.g. "minim rest".
 *  ASCII and stable — grading is a plain string equal. */
export function restLabel(dur: Duration): string {
  return `${dur} rest`;
}

/** Reverse of restLabel: "minim rest" -> "minim". Returns null for a non-label. */
export function durationFromRestLabel(label: string): Duration | null {
  const m = /^(\w+) rest$/.exec(label);
  const dur = m?.[1] as Duration | undefined;
  return dur && dur in REST_UNITS ? dur : null;
}

// rest_completion's OWN renderable time-signature policy (Codex C4): the global
// renderableTimeSignatures excludes Grade-4 metres, and the /2 signatures in
// scope have no bar-math bar total — so this generator names its own hostable
// bars. Simple bars for the everyday rests; the compound /4 metres are added at
// Grade 4 only because they are the only bar-math bars large enough to host the
// breve rest (64 units): 9/4 = 72, 12/4 = 96.
export function restCompletionTimeSigs(grade: number): readonly string[] {
  const simple = ['2/4', '3/4', '4/4'] as const;
  return grade >= 4 ? [...simple, '9/4', '12/4'] : simple;
}

/** The bars (from the grade's policy) large enough to host a rest of `units`,
 *  so the gap can equal exactly that rest. Always non-empty for an in-scope
 *  rest: 4/4 (32) hosts up to the semibreve rest; 9/4/12/4 host the breve. */
export function hostableTimeSigs(grade: number, restUnits: number): string[] {
  return restCompletionTimeSigs(grade).filter((sig) => barUnitsFor(sig) >= restUnits);
}
