// Canonical SRS-atom id scheme: colon-delimited strings, e.g.
// "note_read:treble:C4", "key_sig:G_major", "interval:5", "term:cantabile",
// "rhythm_sum".

import type { Clef, Dots, Duration, VoiceName } from '../music/types';

/** pitch is a free-form label — either scientific notation ("C4") or a named
 * position ("middle_c") — so it stays `string`, not the stricter Pitch type. */
export function noteReadAtom(clef: Clef, pitch: string): string {
  return `note_read:${clef}:${pitch}`;
}

/** rest:<value>, e.g. restAtom('crotchet') -> "rest:crotchet" (chromaticly-gni),
 *  restAtom('minim', 2) -> "rest:double_dotted_minim" (chromaticly-7xv.3). */
export function restAtom(duration: Duration, dots: Dots = 0): string {
  // Spelled here: atoms.ts is a leaf and must not depend on a generator.
  const prefix = dots === 0 ? '' : dots === 1 ? 'dotted_' : 'double_dotted_';
  return `rest:${prefix}${duration}`;
}

/** note_read_keyed:<clef>:<letter><octave> — the same stave POSITION as
 *  note_read, but read under a key signature the generator draws
 *  (chromaticly-7xv.6). The pitch part is always natural: the signature, not the
 *  atom, decides what the note sounds. */
export function keyedNoteAtom(clef: Clef, naturalPitch: string): string {
  return `note_read_keyed:${clef}:${naturalPitch}`;
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

/** Grade-4 between-any-notes interval atom (chromaticly-6ga) — distinct again from
 *  `interval_type:<n>`, for the same reason that one is distinct from `interval:<n>`.
 *
 *  Grade 3 names an interval ABOVE THE TONIC; grade 4 names one between any two
 *  diatonic notes, which is what makes augmented and diminished reachable at all.
 *  Those are different skills, and they shared an atom id until this existed — so
 *  mastering the grade-3 lesson silently credited the grade-4 one, and lane depth
 *  could not tell the two grades apart. */
export function intervalAnyAtom(number: number): string {
  return `interval_any:${number}`;
}

/** Grade-5 compound interval atom (chromaticly-e3z.8), e.g.
 *  intervalCompoundAtom(10) -> "interval_compound:10". Distinct from
 *  `interval_any:<n>` for the same reason that one is distinct from
 *  `interval_type:<n>`: naming a 10th requires seeing it as an octave plus a
 *  3rd, which is a step beyond naming the 3rd. Sharing an atom would let
 *  grade-4 mastery silently credit the grade-5 skill. */
export function intervalCompoundAtom(number: number): string {
  return `interval_compound:${number}`;
}

export function termAtom(slug: string): string {
  return `term:${slug}`;
}

export function rhythmSumAtom(): string {
  return 'rhythm_sum';
}

/** Grade-4-only scoping atom: pins rhythm_sum's target to the double-dotted
 *  value so the double-dotted-rhythms lesson actually assesses it
 *  (chromaticly-2fc). A bare `rhythm_sum` atom stays unconstrained. */
export const RHYTHM_SUM_DOUBLE_DOT_ATOM = 'rhythm_sum:double_dot';

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

/** The Grade 2 interval widening is the KEY SET, so the key is the skill. */
export function intervalKeyAtom(keySig: string): string {
  return `interval_key:${keySig}`;
}

/** Grouping is metre-specific, so the signature is the skill (chromaticly-18o). */
export function groupingAtom(sig: string): string {
  return `grouping:${sig}`;
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

/** Grade-1 major-scale construction (chromaticly-e3z.15), one atom per key. */
export function majorStepsAtom(tonic: string): string {
  return `major_steps:${tonic}`;
}

/** Grade-2 triplets (chromaticly-e3z.9). A group containing a rest is its own
 *  atom: the notes stop being countable, which is the whole difficulty. */
export function tripletAtom(sig: string, withRest = false): string {
  return `${withRest ? 'triplet_rest' : 'triplet'}:${sig}`;
}

/** Grade-5 irregular division (chromaticly-e3z.6), e.g. tupletAtom(5) ->
 *  "tuplet:5". One atom per size: a learner who knows the quintuplet does not
 *  automatically know the septuplet, and the size is the fact being learned. */
export function tupletAtom(size: number): string {
  return `tuplet:${size}`;
}

/** Grade 1 owns the bare atom. Every later grade gets its own, because the
 *  passage widens with the grade and because the SRS routes on first owner. */
export function findBarAtom(property: string, grade = 1): string {
  return grade <= 1 ? `find_bar:${property}` : `find_bar:${property}:${grade}`;
}

/** Octave transposition (Grade 3, treble<->bass clef-rewrite) — one atom for
 *  the skill, mirroring bare `rhythm_sum`: per-direction atoms would just
 *  split SRS signal, since direction is coupled to the clef pair, not an
 *  independently-taught fact. */
export function transposeAtom(): string {
  return 'transpose:octave';
}

/** Cross-clef same-pitch equivalence (Grade 4, chromaticly-ra3) — one atom for
 *  the whole skill, like transposeAtom(): the specific clef pair is drawn by
 *  the generator, not encoded per atom (the skill is "the same pitch reads
 *  across treble/alto/bass", not any one pair). */
export function clefEquivAtom(): string {
  return 'clef_equiv:cross';
}

/** Scale degree by NUMBER (Grades 1-3, chromaticly-e3z.3), e.g.
 *  degreeNumberAtom(5) -> "degree:5". Distinct from degree_name:<name>, which
 *  is the Grade-4 technical name for the same position: answering "5th" and
 *  answering "dominant" are different facts. */
export function degreeNumberAtom(degree: number): string {
  return `degree:${degree}`;
}

/** The tonic triad in root position (Grades 1-3). One bare atom: the skill is
 *  "build the triad on the 1st degree", and the key it is built in is drawn by
 *  the generator from the grade's own key set. */
export const TONIC_TRIAD_ATOM = 'tonic_triad';

/** The tonic triad of a MINOR key (Grade 3, chromaticly-6xs.2). Its own atom
 *  because the triad is minor, not major, and the third is the fact being
 *  learned — a learner who builds C-E-G does not thereby build C-Eb-G. */
export const TONIC_TRIAD_MINOR_ATOM = 'tonic_triad_minor';

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

/** Grade-5 chord numerals (chromaticly-ehp / plan U2): the grade-4 primary
 *  triads plus II (the supertonic — minor in a major key; its quality falls out
 *  of diatonic spelling, not a separate flag). A distinct const from
 *  CHORD_NUMERALS so grade-4 chord_recognition output stays byte-identical. */
export const CHORD_NUMERALS_G5 = ['I', 'II', 'IV', 'V'] as const;

/** Grade-4 primary triads in a MINOR key (chromaticly-7xv). The numerals are the
 *  same three degrees and ABRSM keeps them upper-case at this level, so the atom
 *  carries the mode rather than the numeral's case: `chord:I` and `chord_minor:I`
 *  are different facts and are scored apart.
 *
 *  A separate kind rather than a third part of `chord:<numeral>:<x>`, because
 *  that shape is already the Grade-5 position axis — `chord:I:a` is an inversion,
 *  not a mode. Keeping them apart also leaves every grade-4 pin byte-identical. */
export const CHORD_NUMERALS_MINOR = ['I', 'IV', 'V'] as const;

/** e.g. chordMinorAtom('IV') -> "chord_minor:IV". */
export function chordMinorAtom(numeral: string): string {
  return `chord_minor:${numeral}`;
}

/** Chord positions (Grade 5 inversions): a = root, b = 1st inversion (3rd in
 *  bass), c = 2nd inversion (5th in bass). ABRSM figuring. */
export const CHORD_POSITIONS = ['a', 'b', 'c'] as const;

/** Grade 5 (chromaticly-ic5.6): CHOOSING the chord at a cadential point, as
 *  opposed to naming the cadence. Its own atom because a learner who can name
 *  a cadence and cannot supply its missing chord must be caught, not averaged. */
export function cadenceChooseAtom(kind: string): string {
  return `cadence_choose:${kind}`;
}

/** Grade-5 position-qualified chord atom, e.g. chordPositionAtom('IV','b') ->
 *  "chord:IV:b". The 3-part shape (vs the bare 2-part `chord:<numeral>`) is what
 *  gates the generator into inversions mode, leaving the grade-4 root-position
 *  path untouched. */
export function chordPositionAtom(numeral: string, position: string): string {
  return `chord:${numeral}:${position}`;
}

/** The same shape in a MINOR key (chromaticly-ic5.5), e.g. "chord_minor:II:b".
 *  Its own atom kind because ii is diminished there and I and IV are minor. */
export function chordMinorPositionAtom(numeral: string, position: string): string {
  return `chord_minor:${numeral}:${position}`;
}

/** Grade-5 transposing instruments (transposing_instrument, KB grade5Adds
 *  transposition). The learner writes the part each must READ to sound at
 *  concert pitch — the instrument sounds LOWER than written, so the written
 *  part is written UP by the interval. `letterSteps` is the interval's diatonic
 *  span (a M2 = 1 step, m3 = 2, P5 = 4); `keys` pins concert->written major-key
 *  pairs (both in the supported key set, written spelling clean) so the written
 *  line is notated in the transposed key, not accidentals against the concert
 *  key. Shared reference data — the validator imports this to recompute the
 *  written line (recompute-don't-trust), like CHORD_DEGREE_STEPS. */
export const INSTRUMENT_TRANSPOSITIONS = {
  bb: {
    name: 'B♭ clarinet',
    intervalName: 'major 2nd',
    intervalPill: '↑ M2',
    letterSteps: 1,
    keys: [
      { concert: 'C', written: 'D' },
      { concert: 'F', written: 'G' },
      { concert: 'Bb', written: 'C' },
      { concert: 'G', written: 'A' },
      { concert: 'Eb', written: 'F' },
      { concert: 'D', written: 'E' },
    ],
  },
  a: {
    name: 'A clarinet',
    intervalName: 'minor 3rd',
    intervalPill: '↑ m3',
    letterSteps: 2,
    keys: [
      { concert: 'C', written: 'Eb' },
      { concert: 'G', written: 'Bb' },
      { concert: 'D', written: 'F' },
      { concert: 'F', written: 'Ab' },
      { concert: 'A', written: 'C' },
      { concert: 'E', written: 'G' },
    ],
  },
  f: {
    name: 'horn in F',
    intervalName: 'perfect 5th',
    intervalPill: '↑ P5',
    letterSteps: 4,
    keys: [
      { concert: 'C', written: 'G' },
      { concert: 'F', written: 'C' },
      { concert: 'Bb', written: 'F' },
      { concert: 'Eb', written: 'Bb' },
      { concert: 'G', written: 'D' },
      { concert: 'D', written: 'A' },
    ],
  },
} as const;

export type TransposingInstrument = keyof typeof INSTRUMENT_TRANSPOSITIONS;

/** Grade-5 cadence atom (chromaticly-e3z.5), e.g. cadenceAtom('plagal') ->
 *  "cadence:plagal". One per cadence type: they are three separate facts, and
 *  a learner who knows the perfect cadence has not thereby learned the plagal. */
export function cadenceAtom(kind: string): string {
  return `cadence:${kind}`;
}

/** e.g. transposeInstrumentAtom('bb') -> "transpose_instrument:bb". */
export function transposeInstrumentAtom(instrument: string): string {
  return `transpose_instrument:${instrument}`;
}

/** Grade-5 simple<->compound metre-rewrite (G5-2, chromaticly-4ak). One bare
 *  atom for the whole skill (like transposeAtom): the specific direction and
 *  metre pair are drawn by the generator, not encoded per atom — the skill is
 *  "rewrite a bar between simple and compound time", not any one direction. */
export function metreRewriteAtom(): string {
  return 'rewrite:simple_compound';
}

/** Grade-4 ornament kinds (ornament_recognition, KB `ornaments_recognize`). */
export const ORNAMENT_KINDS = ['trill', 'turn', 'upper_mordent', 'lower_mordent', 'acciaccatura', 'appoggiatura'] as const;

/** e.g. ornamentAtom('trill') -> "ornament:trill". */
export function ornamentAtom(kind: string): string {
  return `ornament:${kind}`;
}

/** Grade-5 ornament direction suffix (G5-5, chromaticly-cke): the 3-part atom
 *  ornament:<kind>:written_to_sign gates the REVERSE direction — the ornament is
 *  written out as ordinary notes and the learner picks the sign. The bare 2-part
 *  ornament:<kind> stays the Grade-4 sign->name path (byte-identical). */
export const ORNAMENT_WRITTEN_TO_SIGN = 'written_to_sign';

/** e.g. ornamentSignAtom('turn') -> "ornament:turn:written_to_sign". */
export function ornamentSignAtom(kind: string): string {
  return `ornament:${kind}:${ORNAMENT_WRITTEN_TO_SIGN}`;
}

/** Exam readiness filters on this suffix, so by-ear can never read as written. */
export const BY_EAR_SUFFIX = 'by_ear';

export function byEarAtom(written: string): string {
  return `${written}:${BY_EAR_SUFFIX}`;
}

export function isByEarAtom(atom: string): boolean {
  return atom.endsWith(`:${BY_EAR_SUFFIX}`);
}

export function writtenAtomOf(atom: string): string {
  return isByEarAtom(atom) ? atom.slice(0, -(BY_EAR_SUFFIX.length + 1)) : atom;
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

/** Grade 5 (chromaticly-ic5.3): the clef an instrument also reads for its
 *  higher passages. Only the three UPPER_CLEF_TABLE instruments have one. */
export function instrumentClefUpperAtom(inst: string): string {
  return `instrument_clef_upper:${inst}`;
}

/** Grade-4 instrument-knowledge playing directions (instrument_knowledge, KB
 *  directions). Mirrors DIRECTION_TABLE's keys in instrument-knowledge.ts —
 *  kept in sync by hand, guarded by instrument-knowledge.test.ts. */
export const DIRECTIONS = ['arco', 'pizzicato', 'con sordino', 'senza sordino', 'col legno', 'tremolo'] as const;

/** Grade 5 (chromaticly-e3z.16): how an instrument makes its sound. */
export function instrumentSoundAtom(inst: string): string {
  return `instrument_sound:${inst}`;
}

/** The six voice types Grade 5 names, high to low within each group. */
export const VOICE_TYPES = ['soprano', 'mezzo-soprano', 'contralto', 'tenor', 'baritone', 'bass'] as const;

export function voiceTypeAtom(voice: string): string {
  return `voice_type:${voice}`;
}

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

export function contextAtom(kind: string, grade = 1): string {
  return grade <= 1 ? `context:${kind}` : `context:${kind}:${grade}`;
}

/** Grade-5 SATB voice names (satb_voice_recognition, G5-1), in the design's
 *  S/A/T/B order — matches VOICE_NAME_TO_ID's order in abc-emitter.ts and the
 *  answer-option order the voice_options interaction renders. */
export const SATB_VOICES: readonly VoiceName[] = ['soprano', 'alto', 'tenor', 'bass'];

/** e.g. satbVoiceAtom('tenor') -> "satb_voice:tenor". */
export function satbVoiceAtom(voice: VoiceName): string {
  return `satb_voice:${voice}`;
}

// --- First steps atoms (grade 0, chromaticly-dhe) ---------------------------
// None of these takes a grade-scoped part, so each validates on shape alone.
// That is deliberate: the level teaches what notation IS, and none of its five
// lessons depends on a key, a metre or a clef the grade scope could widen.

/** The single pulse atom. Lesson 1 asks how many beats a played bar has, and
 *  there is only one idea under it — a beat exists and can be counted. */
export function pulseAtom(): string {
  return 'pulse';
}

/** The seven letter names. One atom per letter so the SRS can review the wrap
 *  after G on its own — that wrap is the thing Grade 1 states in passing and
 *  never drills, and a single `alphabet` atom would hide it inside an average. */
export const ALPHABET_LETTERS: readonly string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export function alphabetAtom(letter: string): string {
  return `alphabet:${letter}`;
}

/** One atom per white-key letter the keyboard lesson asks for. Keyed by letter,
 *  not by pitch: lesson 3 teaches where a NAME lives on the keyboard, and C4 and
 *  C5 are the same answer to that question. */
export function keyboardAtom(letter: string): string {
  return `keyboard:${letter}`;
}

/** The parts of a stave a beginner must name before Grade 1 assumes them.
 *  `higher_lower` is always asked within ONE clef, because unqualified it is
 *  false the moment the bass clef arrives. `earlier_later` is the other axis:
 *  the stave reads left to right in time, not up the page (chromaticly-bpu.2). */
export const STAVE_ANATOMY_KINDS: readonly string[] = ['line_or_space', 'higher_lower', 'earlier_later'];

export function staveAnatomyAtom(kind: string): string {
  return `stave_anatomy:${kind}`;
}

/** One atom per note shape lesson 5 names. The shape and its length arrive
 *  together — a name learned without a meaning is an arbitrary label. */
export const NOTE_SHAPES: readonly string[] = ['semibreve', 'minim', 'crotchet', 'quaver'];

export function noteShapeAtom(shape: string): string {
  return `note_shape:${shape}`;
}
