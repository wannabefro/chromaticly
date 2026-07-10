// Canonical Music object (spec §2, Grade 1 MVP subset). This JSON model is the
// source of truth; the ABC emitter projects it for rendering and audio (KTD3).

export type Clef = 'treble' | 'bass';

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

export type MusicEvent = NoteEvent | ChordEvent | RestEvent | BarlineEvent;

export interface Voice {
  events: MusicEvent[];
}

export interface Music {
  clef: Clef;
  key_sig: KeySig;
  time_sig?: string | null;
  voices: Voice[];
}
