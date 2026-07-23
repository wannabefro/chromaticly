// Pins noteY/ledgerLineYs against an INDEPENDENT frozen copy of the formula,
// not derived circularly from stave-geometry.ts (mirrors bar-math.test.ts's
// independent-capture discipline). LINE_GAP is the true line→line distance
// (28px) so notes land ON the drawn staff lines: the drawn lines sit at
// `i * LINE_GAP`, and a line→line is two diatonic steps (2 * STEP). The prior
// value (14) spaced notes at half the drawn line gap, compressing them into the
// top half of the staff — the tap-vs-visual mismatch this test now guards.

import { ledgerLineYs, noteY } from './stave-geometry';

const LINE_GAP = 28;
const STEP = LINE_GAP / 2;
const LINE_TOP = 26;
const STAVE_LINES = 5;
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const MIDDLE_LINE_PITCH: Record<'treble' | 'bass' | 'alto', string> = {
  treble: 'B4',
  bass: 'D3',
  alto: 'C4',
};

function ordinal(pitch: string): number {
  const letter = pitch[0];
  const octave = Number(pitch.slice(1));
  return octave * 7 + LETTERS.indexOf(letter);
}

function frozenNoteY(clef: 'treble' | 'bass' | 'alto', pitch: string): number {
  const middleLineY = LINE_TOP + STEP * (STAVE_LINES - 1);
  const refOrd = ordinal(MIDDLE_LINE_PITCH[clef]);
  const ord = ordinal(pitch.replace(/[#b]/g, ''));
  return middleLineY - (ord - refOrd) * STEP;
}

function frozenLedgerLineYs(y: number): number[] {
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

describe('noteY — pure move: matches an independent frozen copy of the pre-extraction formula', () => {
  const CASES: Array<['treble' | 'bass' | 'alto', string]> = [
    ['treble', 'B4'],
    ['treble', 'C4'],
    ['treble', 'A5'],
    ['treble', 'G4'],
    ['treble', 'F3'],
    ['treble', 'E6'],
    ['bass', 'D3'],
    ['bass', 'E2'],
    ['bass', 'D4'],
    ['bass', 'A3'],
    ['bass', 'A1'],
    ['bass', 'G4'],
    // Alto (fyu.5): middle line is C4; F3 is the bottom line, G4 the top line.
    ['alto', 'C4'],
    ['alto', 'F3'],
    ['alto', 'G4'],
    ['alto', 'B3'],
    ['alto', 'D4'],
  ];

  test.each(CASES)('noteY(%s, %s) matches the frozen formula', (clef, pitch) => {
    expect(noteY(clef, pitch)).toBe(frozenNoteY(clef, pitch));
  });

  test('alto C4 sits on the middle line, F3 on the bottom line, G4 on the top line', () => {
    const middleLineY = LINE_TOP + STEP * (STAVE_LINES - 1);
    const bottomLineY = LINE_TOP + STEP * 2 * (STAVE_LINES - 1);
    expect(noteY('alto', 'C4')).toBe(middleLineY);
    expect(noteY('alto', 'F3')).toBe(bottomLineY);
    expect(noteY('alto', 'G4')).toBe(LINE_TOP);
  });

  test('an accidented pitch is measured by its natural letter/octave, ignoring the accidental', () => {
    expect(noteY('treble', 'C#4')).toBe(noteY('treble', 'C4'));
    expect(noteY('treble', 'Cb4')).toBe(noteY('treble', 'C4'));
    expect(noteY('bass', 'F#3')).toBe(noteY('bass', 'F3'));
  });
});

describe('ledgerLineYs — pure move: matches an independent frozen copy of the pre-extraction formula', () => {
  const Y_CASES = [54, 96, 12, 5, -2, 26, 82, 19, 89, -20, 150];

  test.each(Y_CASES)('ledgerLineYs(%i) matches the frozen formula', (y) => {
    expect(ledgerLineYs(y)).toEqual(frozenLedgerLineYs(y));
  });

  test('a pitch inside the staff bounds gets no ledger lines', () => {
    expect(ledgerLineYs(54)).toEqual([]);
  });
});
