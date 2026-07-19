import { keyAccidentals } from '../../music/abc-emitter';
import { KB } from '../../content/knowledge-base';
import { scopeForGrade } from '../scope';
import { spellInKey, spellInKeySig, tonicLetter } from './key-spelling';
import { minorScale, raisedSeventh, relativeMajorOf, relativeMinorOf } from './minor-keys';

describe('relativeMajorOf / relativeMinorOf — pairing is the KB fifths-count made executable (D5)', () => {
  test('G2-scope relative pairs are exactly A<->C, E<->G, D<->F', () => {
    expect(relativeMajorOf('A')).toBe('C');
    expect(relativeMajorOf('E')).toBe('G');
    expect(relativeMajorOf('D')).toBe('F');
    expect(relativeMinorOf('C')).toBe('A');
    expect(relativeMinorOf('G')).toBe('E');
    expect(relativeMinorOf('F')).toBe('D');
  });

  test('derivation round-trips: relativeMinorOf(relativeMajorOf(m)) === m for every G2 minor tonic', () => {
    for (const minorTonic of KB.grade2Adds.keys_minor) {
      expect(relativeMinorOf(relativeMajorOf(minorTonic))).toBe(minorTonic);
    }
  });
});

describe('minorScale — the built scale IS the KB-defined interval pattern, not a second copy of it', () => {
  const toSemitoneSteps = (scale: string[]): number[] => {
    const pitchClass: Record<string, number> = {
      C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
    };
    const toAbsolute = (pitch: string) => {
      const match = /^([A-G])(##|#|bb|b)?(-?\d+)$/.exec(pitch);
      if (!match) throw new Error(`bad pitch ${pitch}`);
      const [, letter, symbol, octave] = match;
      const accidental = symbol === '#' ? 1 : symbol === '##' ? 2 : symbol === 'b' ? -1 : symbol === 'bb' ? -2 : 0;
      return pitchClass[letter] + accidental + Number(octave) * 12;
    };
    const absolutes = scale.map(toAbsolute);
    return absolutes.slice(1).map((abs, i) => abs - absolutes[i]);
  };

  test.each([
    ['A', 'A4'],
    ['E', 'E4'],
    ['D', 'D4'],
  ])('harmonic minor of %s matches KB.scalePatterns.harmonic_minor semitone-for-semitone', (tonic, startPitch) => {
    const scale = minorScale(tonic, 'harmonic_minor', startPitch);
    expect(scale).toHaveLength(8);
    expect(toSemitoneSteps(scale)).toEqual([2, 1, 2, 2, 1, 3, 1]);
  });

  test('Form-generality (human requirement): melodic_minor_asc does not throw and matches its KB pattern, though G2 scope excludes it', () => {
    const scale = minorScale('A', 'melodic_minor_asc', 'A4');
    expect(scale).toHaveLength(8);
    expect(toSemitoneSteps(scale)).toEqual([2, 1, 2, 2, 2, 2, 1]);
    // A melodic-asc carries F# and G# (raised 6th and 7th)
    expect(scale[5]).toBe('F#5');
    expect(scale[6]).toBe('G#5');
  });

  test('Scope stays the gate: grade-2 scope lists minorForms as harmonic only — the builder itself places no restriction', () => {
    expect(scopeForGrade(2).minorForms).toEqual(['harmonic']);
  });

  test('raised 7ths are spelled G#/D#/C# on the 7th letter, never Ab-style enharmonics or doubled accidentals', () => {
    expect(raisedSeventh('A')).toBe('G#5');
    expect(raisedSeventh('E')).toBe('D#5');
    expect(raisedSeventh('D')).toBe('C#5');
  });
});

describe('spellInKeySig — a minor key signature spells like its relative major\'s (D6)', () => {
  test('spells F under E minor as F#, and B under D minor as Bb', () => {
    expect(spellInKeySig('F4', 'E_minor')).toBe('F#4');
    expect(spellInKeySig('B4', 'D_minor')).toBe('Bb4');
  });

  test('parity: spellInKeySig is a superset of spellInKey, not a fork', () => {
    expect(spellInKeySig('B4', 'Bb_major')).toBe(spellInKey('B4', 'Bb'));
  });
});

// --- U2: grade-3 new minor keys, melodic desc form, sharp-tonic support (D1/D2/D5) ---

describe('relativeMajorOf — the six new G3 minors, zero table edits (D5 payoff)', () => {
  test('B->D, G->Bb, F#->A, C->Eb, C#->E, F->Ab', () => {
    expect(relativeMajorOf('B')).toBe('D');
    expect(relativeMajorOf('G')).toBe('Bb');
    expect(relativeMajorOf('F#')).toBe('A');
    expect(relativeMajorOf('C')).toBe('Eb');
    expect(relativeMajorOf('C#')).toBe('E');
    expect(relativeMajorOf('F')).toBe('Ab');
  });

  test('derivation round-trips over every grade-3-added minor tonic', () => {
    for (const minorTonic of KB.grade3Adds.keys_minor) {
      expect(relativeMinorOf(relativeMajorOf(minorTonic))).toBe(minorTonic);
    }
  });
});

describe('minorScale — sharp tonics (F#/C#) build correctly from a natural-letter startPitch (D5)', () => {
  test("F# harmonic minor is F# G# A B C# D E# F# — the raised 7th spells E#, not the enharmonic F natural", () => {
    expect(minorScale('F#', 'harmonic_minor', 'F2')).toEqual(['F#2', 'G#2', 'A2', 'B2', 'C#3', 'D3', 'E#3', 'F#3']);
  });

  test('C# harmonic minor carries B# as its raised 7th, spelled on the 7th letter even though it is enharmonic of C', () => {
    expect(minorScale('C#', 'harmonic_minor', 'C4')).toEqual(['C#4', 'D#4', 'E4', 'F#4', 'G#4', 'A4', 'B#4', 'C#5']);
  });
});

describe('minorScale — raising a flatted degree yields the natural, never a sharp (shiftAccidental level arithmetic)', () => {
  test('C harmonic minor carries a plain B natural (not B#) as its raised 7th', () => {
    const scale = minorScale('C', 'harmonic_minor', 'C4');
    expect(scale[6]).toBe('B4');
  });

  test('G harmonic minor carries F# (not F##) as its raised 7th', () => {
    const scale = minorScale('G', 'harmonic_minor', 'G3');
    expect(scale[6]).toBe('F#4');
  });
});

describe('minorScale — melodic_minor_asc raises the 6th and 7th in the new sharp-tonic keys too', () => {
  test('F# melodic ascending carries D# (raised 6th) and E# (raised 7th)', () => {
    const scale = minorScale('F#', 'melodic_minor_asc', 'F4');
    expect(scale[5]).toBe('D#5');
    expect(scale[6]).toBe('E#5');
  });

  test('C# melodic ascending carries A# (raised 6th) and B# (raised 7th)', () => {
    const scale = minorScale('C#', 'melodic_minor_asc', 'C4');
    expect(scale[5]).toBe('A#4');
    expect(scale[6]).toBe('B#4');
  });
});

describe('minorScale — melodic_minor_desc IS the plain key-signature letter walk (D2 zero-delta derivation)', () => {
  test('every accidental in the desc-form scale matches the key signature exactly — no accidental the signature does not already impose, for every in-scope G3 minor', () => {
    for (const tonic of scopeForGrade(3).keysMinor) {
      const acc = keyAccidentals(`${tonic}_minor`);
      const scale = minorScale(tonic, 'melodic_minor_desc', `${tonicLetter(tonic)}4`);
      expect(scale).toHaveLength(8);
      for (const pitch of scale) {
        const match = /^([A-G])(#|b)?-?\d+$/.exec(pitch);
        expect(match).not.toBeNull();
        const [, letter, symbol] = match!;
        const expectedSymbol = acc[letter] === 'sharp' ? '#' : acc[letter] === 'flat' ? 'b' : undefined;
        expect(symbol).toBe(expectedSymbol);
      }
    }
  });
});

describe('raisedSeventh — fixed for sharp tonics (D5, review finding 2): no public helper on the sharp-tonic surface throws', () => {
  test("raisedSeventh('F#') === 'E#5' and raisedSeventh('C#') === 'B#4'", () => {
    expect(raisedSeventh('F#')).toBe('E#5');
    expect(raisedSeventh('C#')).toBe('B#4');
  });

  test('natural-tonic pins are unchanged by the fix', () => {
    expect(raisedSeventh('A')).toBe('G#5');
    expect(raisedSeventh('E')).toBe('D#5');
    expect(raisedSeventh('D')).toBe('C#5');
  });
});
