// Pure stave geometry shared by StaveInput (x = pitch, one slot per diatonic
// pitch) and its sibling TranspositionInput (x = note order, tap-vertical =
// pitch) — U1 seam, extracted verbatim (no signature/behavior changes) so
// both components draw the same staff lines, ledger lines, clef/key glyphs,
// and duration glyphs from one place. No React/RN import here: pure math +
// glyph lookup, jest-testable without rendering.

import { scientificPitchOrdinal } from '../../engine/generators/pitch-math';
import { keyAccidentals } from '../../music/abc-emitter';
import type { Clef, Duration, KeySig, Pitch } from '../../music/types';

export const LINE_GAP = 28; // px between adjacent staff lines
export const STEP = LINE_GAP / 2; // px per diatonic (letter-name) step (a line→space is half a line→line)
export const LINE_TOP = 26;
export const STAVE_LINES = 5;
export const MIDDLE_LINE_PITCH: Record<Clef, Pitch> = { treble: 'B4', bass: 'D3', alto: 'C4' };

/** Design 2d: the paper keeps this inset on all sides — the stave and the accidental
 *  picker never touch the card edge. */
export const PAPER_INSET = 14;

function naturalOf(pitch: Pitch): Pitch {
  return pitch.replace(/[#b]/g, '');
}

export function noteY(clef: Clef, pitch: Pitch): number {
  const middleLineY = LINE_TOP + STEP * (STAVE_LINES - 1);
  const refOrd = scientificPitchOrdinal(MIDDLE_LINE_PITCH[clef]);
  const ord = scientificPitchOrdinal(naturalOf(pitch));
  return middleLineY - (ord - refOrd) * STEP;
}

/** Ledger-line y-positions between the staff and a note that sits above/below
 *  it (G1's ledger allowance is narrow, but the algorithm is general rather
 *  than special-cased to middle C). */
export function ledgerLineYs(y: number): number[] {
  const topLineY = LINE_TOP;
  const bottomLineY = LINE_TOP + STEP * 2 * (STAVE_LINES - 1);
  const lines: number[] = [];
  if (y < topLineY - STEP) {
    for (let ly = topLineY - LINE_GAP; ly >= y - STEP; ly -= LINE_GAP) lines.push(ly);
  } else if (y > bottomLineY + STEP) {
    for (let ly = bottomLineY + LINE_GAP; ly <= y + STEP; ly += LINE_GAP) lines.push(ly);
  }
  return lines;
}

export function keySigGlyphs(keySig: KeySig): string {
  const accidentals = Object.values(keyAccidentals(keySig));
  if (accidentals.length === 0) return '';
  const glyph = accidentals[0] === 'flat' ? '♭' : '♯';
  return glyph.repeat(accidentals.length);
}

export const CLEF_GLYPH: Record<Clef, string> = { treble: '𝄞', bass: '𝄢', alto: '𝄡' };

/** Ruling A3: the duration tiles are glyph-only, so they scale 3-5 across per grade
 *  without the labels ever wrapping. The selected duration's name is echoed below. */
export const DURATION_GLYPH: Record<Duration, string> = {
  breve: '𝅜',
  semibreve: '𝅝',
  minim: '𝅗𝅥',
  crotchet: '𝅘𝅥',
  quaver: '𝅘𝅥𝅮',
  semiquaver: '𝅘𝅥𝅯',
  demisemiquaver: '𝅘𝅥𝅰',
};
