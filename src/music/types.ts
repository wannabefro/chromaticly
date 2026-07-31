// Canonical Music object (spec §2, Grade 1 MVP subset). This JSON model is the
// source of truth; the ABC emitter projects it for rendering and audio (KTD3).

// 'tenor' is the C clef centred on the 4th line (Grade 5, chromaticly-e3z.7).
// abcjs takes `clef=tenor` natively, so the emitter needs no new case — but
// every Record<Clef, ...> in the codebase does, which is the point of widening
// the union rather than passing a string.
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';

export type Duration =
  | 'breve'
  | 'semibreve'
  | 'minim'
  | 'crotchet'
  | 'quaver'
  | 'semiquaver'
  | 'demisemiquaver';

export type Dots = 0 | 1 | 2;

/** A tuplet grouping marker carried by each note in the group (not a separate
 *  event, so every `type === 'note'` consumer still sees the notes). `size`
 *  notes play in the time of `inTimeOf` of the same written value — a duplet is
 *  `{ size: 2, inTimeOf: 3 }` (two in the time of three, used in compound time),
 *  a triplet `{ size: 3, inTimeOf: 2 }`. `start` marks the group's first note,
 *  where the emitter writes the ABC `(p:q:r` bracket. Notes are written at their
 *  face value; the tuplet does the metric scaling. */
export interface TupletMark {
  size: number;
  inTimeOf: number;
  start?: boolean;
}

/** The six ornament signs recognised at Grade 4 (KB `ornaments_recognize`).
 *  trill/turn/mordents are ABC decorations printed above the note; acciaccatura
 *  and appoggiatura are grace notes printed before it. */
export type OrnamentKind =
  | 'trill'
  | 'turn'
  | 'upper_mordent'
  | 'lower_mordent'
  | 'acciaccatura'
  | 'appoggiatura';

/** An ornament carried by the note it decorates (like TupletMark, a per-note
 *  marker, not a separate event). Decoration kinds (trill/turn/mordents) render
 *  as an ABC `!name!` above the note; grace kinds (acciaccatura/appoggiatura)
 *  render as a small grace note before it, so those carry the grace `pitch`. The
 *  ornament never changes the note's metric value — grace notes are decorative,
 *  so bar-math and beaming ignore it entirely. */
export interface Ornament {
  kind: OrnamentKind;
  /** Required for the grace kinds (acciaccatura/appoggiatura); unread otherwise. */
  pitch?: Pitch;
}

/** Scientific pitch notation, e.g. "C4" (middle C), "Eb3", "F#5". */
export type Pitch = string;

/** e.g. "G_major", "C_minor", or null when accidentals are written in explicitly. */
export type KeySig = string | null;

export interface NoteEvent {
  type: 'note';
  pitch: Pitch;
  dur: Duration;
  dots?: Dots;
  tuplet?: TupletMark;
  ornament?: Ornament;
  /** Marks the single target note for a "name the voice" exercise (SATB
   *  recognition, G5-1). The core locates it; the surface draws the ring. */
  highlight?: boolean;
}

/** Simultaneous pitches — a harmonic interval or a triad (rendered as an ABC chord). */
export interface ChordEvent {
  type: 'chord';
  pitches: Pitch[];
  dur: Duration;
  dots?: Dots;
  /** Marks the single target chord for a "name the voice" exercise (SATB
   *  recognition, G5-1). The core locates it; the surface draws the ring. */
  highlight?: boolean;
}

export interface RestEvent {
  type: 'rest';
  dur: Duration;
  dots?: Dots;
  /** A rest inside a tuplet group carries the mark too — "triplet groups with
   *  rests" is its own Grade 2 skill (chromaticly-e3z.9). */
  tuplet?: TupletMark;
}

export interface BarlineEvent {
  type: 'barline';
  style?: 'single' | 'double';
}

/** Point dynamics for Grade 1–3 (the single-glyph markings, e.g. 𝆑 = forte). Named
 *  with the ABC decoration tokens so the emitter maps them straight through. Hairpins
 *  (crescendo/diminuendo spans) are a separate, later concern. */
export type Dynamic = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'sfz';

/** A dynamic marking sitting in the voice before the note it colours. Modelled as its
 *  own event (not a note field) because a dynamic is positioned under the staff in its
 *  own right; the emitter glues its decoration onto the following note. */
export interface DynamicEvent {
  type: 'dynamic';
  mark: Dynamic;
}

export type MusicEvent = NoteEvent | ChordEvent | RestEvent | BarlineEvent | DynamicEvent;

/** SATB voice names (recognition-first slice, G5-1). Tenor sits on the bass
 *  staff, stem up — no tenor clef (deliberately deferred, see the G5-1 plan). */
export type VoiceName = 'soprano' | 'alto' | 'tenor' | 'bass';

export interface Voice {
  events: MusicEvent[];
  /** Grand-staff routing: which entry of `Music.staves` this voice renders on
   *  (0 = top/treble, 1 = bottom/bass). Unset on the single-voice path. */
  staff?: number;
  stem?: 'up' | 'down';
  name?: VoiceName;
}

export interface Music {
  clef: Clef;
  key_sig: KeySig;
  time_sig?: string | null;
  /** Per-staff clefs for a braced grand staff (e.g. `['treble','bass']` for
   *  SATB). When present, this declares grand-staff mode and each `Voice`
   *  routes to a staff via `Voice.staff`; when absent, the single `clef`
   *  above is authoritative and behavior is unchanged (single-voice path). */
  staves?: Clef[];
  /** When true, the emitter hides the printed time signature (`M:none`) but still
   *  beams by the true `time_sig` — used for "guess the signature" stimuli where the
   *  grouping must remain honest even though the glyph is hidden. */
  time_sig_hidden?: boolean;
  /** When true, the stimulus begins with a partial (upbeat) bar — a
   *  self-describing marker for the anacrusis_recognition template. The
   *  emitter never reads this field; the pickup is rendered structurally (a
   *  short first bar in the event stream), so this flag cannot change
   *  emitted abc — it only lets the generator/validator declare intent. */
  anacrusis?: boolean;
  /** When true, render on a single-line staff with no clef (`clef=none
   *  stafflines=1`) — a "pure rhythm" glyph where pitch is irrelevant, used for
   *  the musical-sum operands and their note-value answer options (chromaticly-f9k).
   *  Only the emitter's clef tag reads this; every note token is unchanged. */
  rhythmStaff?: boolean;
  voices: Voice[];
}
