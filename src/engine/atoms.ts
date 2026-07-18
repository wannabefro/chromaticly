// Canonical SRS-atom id scheme: colon-delimited strings, e.g.
// "note_read:treble:C4", "key_sig:G_major", "interval:5", "term:cantabile",
// "rhythm_sum".

import type { Clef } from '../music/types';

/** pitch is a free-form label — either scientific notation ("C4") or a named
 * position ("middle_c") — so it stays `string`, not the stricter Pitch type. */
export function noteReadAtom(clef: Clef, pitch: string): string {
  return `note_read:${clef}:${pitch}`;
}

export function keySigAtom(key: string): string {
  return `key_sig:${key}`;
}

export function intervalAtom(number: number): string {
  return `interval:${number}`;
}

export function termAtom(slug: string): string {
  return `term:${slug}`;
}

export function rhythmSumAtom(): string {
  return 'rhythm_sum';
}

export function barValidityAtom(): string {
  return 'bar_validity';
}

export function addTimeSignatureAtom(): string {
  return 'add_time_signature';
}

export function noteValueCompareAtom(): string {
  return 'note_value_compare';
}

/** Music in Context find-the-bar (302.4) — one atom per bar property the learner
 *  can be asked to spot, so mastery tracks "can find the highest note" separately
 *  from "can find the longest". */
export function findBarAtom(property: string): string {
  return `find_bar:${property}`;
}

export function parseAtom(id: string): { kind: string; parts: string[] } {
  const [kind, ...parts] = id.split(':');
  return { kind, parts };
}

/** Music-in-Context sub-questions that aren't find-the-bar: reading the passage for
 *  its highest note, its metre, or a dynamic marking read in context (design 8d). */
export const CONTEXT_KINDS: readonly string[] = ['highest_note', 'time_sig', 'dynamic_term'];

export function contextAtom(kind: string): string {
  return `context:${kind}`;
}
