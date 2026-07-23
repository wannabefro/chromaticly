// Canonical Music object (spec §2, Grade 1 MVP subset). This JSON model is the
// source of truth; the ABC emitter projects it for rendering and audio (KTD3).

export type Clef = 'treble' | 'bass' | 'alto';

export type Duration =
  | 'breve'
  | 'semibreve'
  | 'minim'
  | 'crotchet'
  | 'quaver'
  | 'semiquaver'
  | 'demisemiquaver';

export type Dots = 0 | 1 | 2;

/** Scientific pitch notation, e.g. "C4" (middle C), "Eb3", "F#5". */
export type Pitch = string;

/** e.g. "G_major", "C_minor", or null when accidentals are written in explicitly. */
export type KeySig = string | null;

export interface NoteEvent {
  type: 'note';
  pitch: Pitch;
  dur: Duration;
  dots?: Dots;
}

/** Simultaneous pitches — a harmonic interval or a triad (rendered as an ABC chord). */
export interface ChordEvent {
  type: 'chord';
  pitches: Pitch[];
  dur: Duration;
  dots?: Dots;
}

export interface RestEvent {
  type: 'rest';
  dur: Duration;
  dots?: Dots;
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

export interface Voice {
  events: MusicEvent[];
}

export interface Music {
  clef: Clef;
  key_sig: KeySig;
  time_sig?: string | null;
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
  voices: Voice[];
}
