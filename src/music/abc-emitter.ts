// Pure Music-object → ABC-string emitter (KTD3). No DOM, no side effects.
//
// Invariant (the one Codex flagged): ABC pitch tokens are ABSOLUTE. Clef only
// sets the K: header for staff placement; it never changes a pitch's token —
// middle C is `C` in both treble and bass. See pitchToAbc, which takes no clef.

import type {
  ChordEvent,
  Clef,
  Dots,
  Duration,
  DynamicEvent,
  KeySig,
  Music,
  NoteEvent,
  Ornament,
  OrnamentKind,
  RestEvent,
  Voice,
} from './types';

type Accidental = 'sharp' | 'flat' | 'natural' | 'double_sharp' | 'double_flat';

/** Beats measured in crotchets. */
const DURATION_BEATS: Record<Duration, number> = {
  breve: 8,
  semibreve: 4,
  minim: 2,
  crotchet: 1,
  quaver: 0.5,
  semiquaver: 0.25,
  demisemiquaver: 0.125,
};

// Unit note length L:1/32 — one crotchet = 8 units. Chosen so every Grade-1
// duration, including single- and double-dotted values, is an integer count.
const UNITS_PER_CROTCHET = 8;
const UNIT_NOTE_LENGTH = '1/32';

const DOT_MULTIPLIER: Record<Dots, number> = { 0: 1, 1: 1.5, 2: 1.75 };

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const;
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const;

const MAJOR_FIFTHS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6,
};
const MINOR_FIFTHS: Record<string, number> = {
  A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6,
  D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6,
};

const ACCIDENTAL_ABC: Record<Accidental, string> = {
  sharp: '^',
  flat: '_',
  natural: '=',
  double_sharp: '^^',
  double_flat: '__',
};

const SYMBOL_TO_ACCIDENTAL: Record<string, Accidental> = {
  '#': 'sharp',
  '##': 'double_sharp',
  b: 'flat',
  bb: 'double_flat',
};

interface ParsedPitch {
  letter: string;
  accidental: Accidental | null; // null = no explicit symbol (a plain natural letter)
  octave: number;
}

function parsePitch(pitch: string): ParsedPitch {
  const match = /^([A-G])(##|#|bb|b)?(-?\d+)$/.exec(pitch);
  if (!match) {
    throw new Error(`Invalid pitch: ${pitch}`);
  }
  const [, letter, symbol, octave] = match;
  return {
    letter,
    accidental: symbol ? SYMBOL_TO_ACCIDENTAL[symbol] : null,
    octave: Number(octave),
  };
}

/** Map a key signature to the accidental it imposes on each letter, e.g. G major -> {F:'sharp'}. */
export function keyAccidentals(keySig: KeySig): Record<string, Accidental> {
  if (!keySig) return {};
  const [tonic, mode] = keySig.split('_');
  const count = mode === 'minor' ? MINOR_FIFTHS[tonic] : MAJOR_FIFTHS[tonic];
  if (count === undefined) {
    throw new Error(`Unknown key signature: ${keySig}`);
  }
  const map: Record<string, Accidental> = {};
  if (count > 0) {
    for (let i = 0; i < count; i++) map[SHARP_ORDER[i]] = 'sharp';
  } else if (count < 0) {
    for (let i = 0; i < -count; i++) map[FLAT_ORDER[i]] = 'flat';
  }
  return map;
}

function keyName(keySig: KeySig): string {
  if (!keySig) return 'C';
  const [tonic, mode] = keySig.split('_');
  return mode === 'minor' ? `${tonic}m` : tonic;
}

/**
 * Emit the ABC pitch token for a scientific pitch, given the key's accidental map.
 * Takes NO clef — the token is absolute (the invariant). Prints an accidental only
 * when it differs from what the key signature already applies to that letter.
 */
export function pitchToAbc(pitch: string, keyAcc: Record<string, Accidental>): string {
  const { letter, accidental, octave } = parsePitch(pitch);
  const keyAccidental = keyAcc[letter];

  let accidentalStr = '';
  if (accidental) {
    // Explicit accidental: suppress only if the key already imposes the same one.
    if (accidental !== keyAccidental) accidentalStr = ACCIDENTAL_ABC[accidental];
  } else if (keyAccidental) {
    // Plain letter but the key alters it -> must print a natural.
    accidentalStr = ACCIDENTAL_ABC.natural;
  }

  const base = octave >= 5 ? letter.toLowerCase() : letter.toUpperCase();
  const marks = octave >= 5 ? "'".repeat(octave - 5) : ','.repeat(4 - octave);

  return `${accidentalStr}${base}${marks}`;
}

/** Duration as an ABC unit-count suffix (relative to L:1/32); "" means one unit. */
export function durationToAbc(dur: Duration, dots: Dots = 0): string {
  const units = DURATION_BEATS[dur] * UNITS_PER_CROTCHET * DOT_MULTIPLIER[dots];
  if (!Number.isInteger(units)) {
    throw new Error(`Non-integer ABC length for ${dur} with ${dots} dot(s)`);
  }
  return units === 1 ? '' : String(units);
}

function clefTag(clef: Clef): string {
  return `clef=${clef}`;
}

/** ABC decoration token for the decoration ornaments — grace ornaments render
 *  structurally (a `{...}` grace note) instead, handled in noteToAbc. */
const ORNAMENT_DECORATION: Partial<Record<OrnamentKind, string>> = {
  trill: '!trill!',
  turn: '!turn!',
  upper_mordent: '!uppermordent!',
  lower_mordent: '!lowermordent!',
};

/** The ABC prefix that carries an ornament onto its note: a `!name!` decoration
 *  for trill/turn/mordents, or a grace note (`{/g}` slashed acciaccatura,
 *  `{g}` appoggiatura) that abcjs prints small before the principal. */
function ornamentPrefix(orn: Ornament, keyAcc: Record<string, Accidental>): string {
  const decoration = ORNAMENT_DECORATION[orn.kind];
  if (decoration) return decoration;
  if (!orn.pitch) throw new Error(`Ornament "${orn.kind}" is a grace note and needs a pitch`);
  const grace = pitchToAbc(orn.pitch, keyAcc);
  return orn.kind === 'acciaccatura' ? `{/${grace}}` : `{${grace}}`;
}

function noteToAbc(ev: NoteEvent, keyAcc: Record<string, Accidental>): string {
  const prefix = ev.ornament ? ornamentPrefix(ev.ornament, keyAcc) : '';
  return prefix + pitchToAbc(ev.pitch, keyAcc) + durationToAbc(ev.dur, ev.dots ?? 0);
}

function chordToAbc(ev: ChordEvent, keyAcc: Record<string, Accidental>): string {
  const inner = ev.pitches.map((p) => pitchToAbc(p, keyAcc)).join('');
  return `[${inner}]${durationToAbc(ev.dur, ev.dots ?? 0)}`;
}

function restToAbc(ev: RestEvent): string {
  return `z${durationToAbc(ev.dur, ev.dots ?? 0)}`;
}

/** ABC decoration for a dynamic, e.g. `!f!`. The Dynamic values are the ABC tokens. */
function dynamicToAbc(ev: DynamicEvent): string {
  return `!${ev.mark}!`;
}

/** Emit a voice's events, gluing each dynamic's decoration onto the following note
 *  (`!f!C`) — ABC binds a decoration to the next note, so it must not be split off as
 *  its own space-separated token. A dynamic with no following note/chord/rest is
 *  malformed input and throws rather than emitting a decoration on a barline or nothing. */
const EPS = 1e-9;

/** Crotchet-beats spanned by a duration+dots. */
function beatsOf(dur: Duration, dots: Dots = 0): number {
  return DURATION_BEATS[dur] * DOT_MULTIPLIER[dots];
}

/** The beat the notation groups by, in crotchet-beats: the denominator note in simple
 *  time (a quaver in /8, a crotchet in /4), a dotted note three times that in compound
 *  time (numerator a multiple of three greater than three) — 6/8 beams by dotted
 *  crotchet, 6/4 by dotted minim, 6/16 by dotted quaver. Byte-identical to the former
 *  rule for every metre grades 1-3 use. This is what "beat" means for beaming, not the
 *  notated bottom number. */
function beatUnit(timeSig: string | null | undefined): number {
  if (!timeSig) return 1;
  const [num, den] = timeSig.split('/').map(Number);
  const unit = 4 / den;
  const compound = num % 3 === 0 && num > 3;
  return compound ? unit * 3 : unit;
}

/** Emit a voice, beaming sub-crotchet notes that share a beat. In ABC, adjacent notes
 *  with NO space between them are beamed; a space breaks the beam. Emitting every note
 *  space-separated (the old behaviour) left quavers unbeamed — wrong for the metre. So
 *  notes shorter than a crotchet that fall in the same beat are glued; everything else
 *  (crotchet-or-longer, rests, a dynamic, a bar edge, a new beat) gets a space. */
function voiceToAbc(voice: Voice, keyAcc: Record<string, Accidental>, unit: number): string {
  let out = '';
  let pendingDecoration = '';
  let beatPos = 0; // crotchet-beats elapsed in the current bar
  let prevBeamable = false;
  let prevBeat = -1;

  const append = (token: string, glue: boolean) => {
    out += out === '' ? token : (glue ? '' : ' ') + token;
  };

  for (const ev of voice.events) {
    if (ev.type === 'dynamic') {
      pendingDecoration += dynamicToAbc(ev);
      continue;
    }
    if (ev.type === 'barline') {
      if (pendingDecoration) throw new Error('Dynamic marking must precede a note, not a barline');
      append(ev.style === 'double' ? '||' : '|', false);
      beatPos = 0;
      prevBeamable = false;
      prevBeat = -1;
      continue;
    }

    // A tuplet note occupies its written value scaled by inTimeOf/size — the
    // metric truth the bar/beam grid must track, even though the note is
    // WRITTEN at face value (abcjs applies the scaling from the `(p:q:r`
    // bracket the start note carries). beatsOf is the written value; `d` is the
    // sounded span.
    const tuplet = ev.type === 'note' ? ev.tuplet : undefined;
    const written = beatsOf(ev.dur, ev.dots ?? 0);
    const d = tuplet ? (written * tuplet.inTimeOf) / tuplet.size : written;
    const beat = Math.floor((beatPos + EPS) / unit);
    const isPitched = ev.type === 'note' || ev.type === 'chord';
    const beamable = isPitched && written <= 0.5; // quaver or shorter carries a beam
    const tupletPrefix = tuplet?.start ? `(${tuplet.size}:${tuplet.inTimeOf}:${tuplet.size}` : '';
    const body =
      tupletPrefix + (ev.type === 'note' ? noteToAbc(ev, keyAcc) : ev.type === 'chord' ? chordToAbc(ev, keyAcc) : restToAbc(ev));

    // Glue to the previous token only when both are beam-carrying notes in the same beat,
    // and no dynamic sits between them (a marking starts a fresh group).
    const glue = beamable && prevBeamable && beat === prevBeat && pendingDecoration === '';
    append(pendingDecoration + body, glue);

    beatPos += d;
    prevBeamable = beamable;
    prevBeat = beat;
    pendingDecoration = '';
  }

  if (pendingDecoration) throw new Error('Dynamic marking has no following note');
  return out;
}

/** Project a Music object to a complete, renderable ABC tune string. */
export function musicToAbc(music: Music): string {
  const keyAcc = keyAccidentals(music.key_sig);
  const header = [
    'X:1',
    `L:${UNIT_NOTE_LENGTH}`,
    `M:${music.time_sig_hidden ? 'none' : music.time_sig ?? 'none'}`,
    // A rhythm-staff stimulus (musical sums) is a bare note SYMBOL — no clef and no
    // staff line at all (stafflines=0), the ABRSM worksheet convention. Pitch carries
    // no meaning; only the note VALUE reads (chromaticly-f9k).
    `K:${keyName(music.key_sig)} ${music.rhythmStaff ? 'clef=none stafflines=0' : clefTag(music.clef)}`,
  ].join('\n');

  const unit = beatUnit(music.time_sig);
  const body = music.voices.map((voice) => voiceToAbc(voice, keyAcc, unit)).join('\n');

  return `${header}\n${body}\n`;
}
