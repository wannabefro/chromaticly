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

import type { Dots, Duration } from '../../music/types';
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

/** A rest value: a duration plus its dots. `dots: 0` is the plain rest. */
export interface RestValue {
  dur: Duration;
  dots: Dots;
}

// chromaticly-7xv.3. A dotted rest was declared in scope from Grade 2
// (GRADE_2_SCOPE.rhythmDevices carries 'dotted_rests') and generated at no grade,
// so the atom, the label and the arithmetic all start here. The token form keeps
// ONE part — `rest:dotted_crotchet`, not `rest:crotchet:1` — so the by-ear suffix
// still composes as `rest:dotted_crotchet:by_ear`.
const DOT_PREFIXES: ReadonlyArray<readonly [string, Dots]> = [
  ['double_dotted_', 2],
  ['dotted_', 1],
];

const DOT_WORDS: Record<Dots, string> = { 0: '', 1: 'dotted ', 2: 'double-dotted ' };

/** Length in bar-math units. Each dot adds half of the running value, so one dot
 *  is 1.5x and two dots 1.75x — integral for every value this course offers. */
export function restUnits({ dur, dots }: RestValue): number {
  const base = REST_UNITS[dur];
  return dots === 0 ? base : dots === 1 ? base * 1.5 : base * 1.75;
}

/** The atom/scope token for a rest value, e.g. `{minim, 2}` -> "double_dotted_minim". */
export function restToken({ dur, dots }: RestValue): string {
  return dots === 0 ? dur : `${DOT_PREFIXES.find(([, d]) => d === dots)![0]}${dur}`;
}

/** Reverse of restToken. Returns null for a token that names no rest value. */
export function parseRestToken(token: string): RestValue | null {
  for (const [prefix, dots] of DOT_PREFIXES) {
    if (!token.startsWith(prefix)) continue;
    const dur = token.slice(prefix.length) as Duration;
    return dur in REST_UNITS ? { dur, dots } : null;
  }
  return token in REST_UNITS ? { dur: token as Duration, dots: 0 } : null;
}

/** The graded answer/label for a rest value, e.g. "dotted minim rest".
 *  ASCII and stable — grading is a plain string equal. */
export function restLabel(dur: Duration, dots: Dots = 0): string {
  return `${DOT_WORDS[dots]}${dur} rest`;
}

/** Reverse of restLabel: "dotted minim rest" -> {minim, 1}. Null for a non-label. */
export function parseRestLabel(label: string): RestValue | null {
  const m = /^(?:(double-dotted|dotted) )?(\w+) rest$/.exec(label);
  if (!m) return null;
  const dots: Dots = m[1] === 'double-dotted' ? 2 : m[1] === 'dotted' ? 1 : 0;
  const dur = m[2] as Duration;
  return dur in REST_UNITS ? { dur, dots } : null;
}

// A dot is only offered where the dotted length lands on a whole bar-math unit —
// below that the rest cannot fill an exact gap. One dot needs 2 units, two dots
// need 4, which rules the demisemiquaver out of both and the semiquaver out of
// the double dot.
const MIN_UNITS_FOR_DOTS: Record<1 | 2, number> = { 1: 2, 2: 4 };

/** Every dotted rest value the grade's rhythm devices admit, plain rests excluded.
 *  `dotted_rests` opens one dot (Grade 2); `double_dot` opens two (Grade 4). */
export function dottedRestsInScope(rests: readonly Duration[], rhythmDevices: readonly string[]): RestValue[] {
  const dotCounts: Dots[] = [];
  if (rhythmDevices.includes('dotted_rests')) dotCounts.push(1);
  if (rhythmDevices.includes('double_dot')) dotCounts.push(2);
  return dotCounts.flatMap((dots) =>
    rests.filter((dur) => REST_UNITS[dur] >= MIN_UNITS_FOR_DOTS[dots as 1 | 2]).map((dur) => ({ dur, dots })),
  );
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
