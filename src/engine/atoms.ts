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

/** e.g. scaleAtom('A', 'harmonic') -> "scale:A_minor_harmonic" (D9) — matches
 *  the "<tonic>_minor_<form>" convention scale_construction's srs_tags already
 *  emit (scale-construction.ts). Minor-only for now; a major scale-family atom
 *  would need a different helper, not a mode parameter here. */
export function scaleAtom(tonic: string, form: string): string {
  return `scale:${tonic}_minor_${form}`;
}

export function intervalAtom(number: number): string {
  return `interval:${number}`;
}

/** Grade-3 number+type interval atom (D4) — distinct from bare `interval:<n>`
 *  so "name the 3rd" (grade 1) and "name it a minor 3rd" (grade 3) route to
 *  their own owning lesson instead of first-owner-wins misrouting a due
 *  number+type review to the grade-1 number-only lesson. */
export function intervalTypeAtom(number: number): string {
  return `interval_type:${number}`;
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

/** Bare (grade-1, `sig` omitted) or parameterized (grade-3 compound, D6)
 *  atom id. Distinct atom ids per compound signature keep the SRS due path
 *  routed to the grade-3 owner instead of misrouting to the grade-1 lesson
 *  that owns the bare atom (first-owner-wins, practice-plan.ts). */
export function addTimeSignatureAtom(sig?: string): string {
  return sig ? `add_time_signature:${sig}` : 'add_time_signature';
}

export function noteValueCompareAtom(): string {
  return 'note_value_compare';
}

/** One atom per time signature the metre_classification MCQ can be asked
 *  about (D7) — a single atom pins the signature, matching the SRS due-path
 *  discipline `keySigAtom`/`addTimeSignatureAtom` already establish. */
export function metreAtom(sig: string): string {
  return `metre:${sig}`;
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
