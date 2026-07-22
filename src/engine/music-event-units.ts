// Dot-aware event-duration helper (Codex correction 1) shared by the
// anacrusis-recognition generator and its validator hook. Lives outside
// generators/ for the same reason metre.ts does: the validator must not
// import from generators/ (import cycle via retry.ts -> validate), so a
// helper both sides need lives here instead.
//
// MusicEvent.dots is stored SEPARATELY from dur (types.ts) and the emitter is
// dot-aware (abc-emitter.ts durationToAbc) — summing group units via
// UNITS[ev.dur] alone silently drops the dot and mis-validates a dotted
// pickup/final bar. This handles both dots:1 and dots:2.

import type { Duration, MusicEvent } from '../music/types';

// Demisemiquaver-rebased unit table (mirrors generators/bar-math.ts's UNITS,
// widened to the full Duration domain including 'breve').
const UNITS: Record<Duration, number> = {
  breve: 64,
  semibreve: 32,
  minim: 16,
  crotchet: 8,
  quaver: 4,
  semiquaver: 2,
  demisemiquaver: 1,
};

const DOT_MULTIPLIER: Record<0 | 1 | 2, number> = { 0: 1, 1: 1.5, 2: 1.75 };

/** Demisemiquaver-unit duration of a note/chord/rest event; 0 for a barline
 *  or dynamic (neither carries a duration). */
export function musicEventUnits(ev: MusicEvent): number {
  if (ev.type !== 'note' && ev.type !== 'chord' && ev.type !== 'rest') return 0;
  return UNITS[ev.dur] * DOT_MULTIPLIER[ev.dots ?? 0];
}
