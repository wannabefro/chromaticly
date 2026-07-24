// Canonical SRS-atom id scheme: colon-delimited strings, e.g.
// "note_read:treble:C4", "key_sig:G_major", "interval:5", "term:cantabile",
// "rhythm_sum".

import type { Clef, Duration } from '../music/types';

/** pitch is a free-form label — either scientific notation ("C4") or a named
 * position ("middle_c") — so it stays `string`, not the stricter Pitch type. */
export function noteReadAtom(clef: Clef, pitch: string): string {
  return `note_read:${clef}:${pitch}`;
}

/** rest:<duration>, e.g. restAtom('crotchet') -> "rest:crotchet" (chromaticly-gni). */
export function restAtom(duration: Duration): string {
  return `rest:${duration}`;
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
/** One atom per simple time signature the anacrusis_recognition MCQ can be
 *  asked about (D5) — mirrors metreAtom's per-signature SRS discipline. */
export function anacrusisAtom(sig: string): string {
  return `anacrusis:${sig}`;
}
export function dupletAtom(sig: string): string {
  return `duplet:${sig}`;
}

export function findBarAtom(property: string): string {
  return `find_bar:${property}`;
}

/** Octave transposition (Grade 3, treble<->bass clef-rewrite) — one atom for
 *  the skill, mirroring bare `rhythm_sum`: per-direction atoms would just
 *  split SRS signal, since direction is coupled to the clef pair, not an
 *  independently-taught fact. */
export function transposeAtom(): string {
  return 'transpose:octave';
}

/** Grade-4 technical degree name atom (fyu.4 degree-names slice), e.g.
 *  degreeNameAtom('dominant') -> "degree_name:dominant". */
export function degreeNameAtom(name: string): string {
  return `degree_name:${name}`;
}

/** Grade-4 primary-triad numerals (chord_recognition, KB.grade4Adds.chords.primary_triads_and_chords). */
export const CHORD_NUMERALS = ['I', 'IV', 'V'] as const;

/** e.g. chordAtom('IV') -> "chord:IV". */
export function chordAtom(numeral: string): string {
  return `chord:${numeral}`;
}

/** Grade-4 ornament kinds (ornament_recognition, KB `ornaments_recognize`). */
export const ORNAMENT_KINDS = ['trill', 'turn', 'upper_mordent', 'lower_mordent', 'acciaccatura', 'appoggiatura'] as const;

/** e.g. ornamentAtom('trill') -> "ornament:trill". */
export function ornamentAtom(kind: string): string {
  return `ornament:${kind}`;
}

/** Grade-4 instrument-knowledge instruments (instrument_knowledge, KB
 *  instrument families/clefs). Mirrors INSTRUMENT_TABLE's keys in
 *  instrument-knowledge.ts — kept in sync by hand (like CHORD_NUMERALS/
 *  CHORD_DEGREE_STEPS), guarded by instrument-knowledge.test.ts. */
export const INSTRUMENTS = [
  'violin',
  'viola',
  'cello',
  'double bass',
  'flute',
  'oboe',
  'clarinet',
  'bassoon',
  'trumpet',
  'horn',
  'trombone',
  'tuba',
  'timpani',
] as const;

/** e.g. instrumentFamilyAtom('viola') -> "instrument_family:viola". */
export function instrumentFamilyAtom(inst: string): string {
  return `instrument_family:${inst}`;
}

/** e.g. instrumentClefAtom('viola') -> "instrument_clef:viola". */
export function instrumentClefAtom(inst: string): string {
  return `instrument_clef:${inst}`;
}

/** Grade-4 instrument-knowledge playing directions (instrument_knowledge, KB
 *  directions). Mirrors DIRECTION_TABLE's keys in instrument-knowledge.ts —
 *  kept in sync by hand, guarded by instrument-knowledge.test.ts. */
export const DIRECTIONS = ['arco', 'pizzicato', 'con sordino', 'senza sordino', 'col legno', 'tremolo'] as const;

/** e.g. directionAtom('arco') -> "direction:arco". */
export function directionAtom(term: string): string {
  return `direction:${term}`;
}

/** Grade-4 enharmonic-equivalent note spellings (enharmonic_recognition, KB
 *  pitch_knowledge "enharmonic equivalents"). The five black-key pairs, both
 *  spellings — each atom names one note whose enharmonic partner is the answer.
 *  Mirrors ENHARMONIC_PARTNER in enharmonic-recognition.ts, guarded by its test. */
export const ENHARMONIC_NOTES = ['C#', 'Db', 'D#', 'Eb', 'F#', 'Gb', 'G#', 'Ab', 'A#', 'Bb'] as const;

/** e.g. enharmonicAtom('F#') -> "enharmonic:F#". */
export function enharmonicAtom(note: string): string {
  return `enharmonic:${note}`;
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
