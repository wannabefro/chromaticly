import { KB } from '../../content/knowledge-base';
import { scopeForGrade } from '../scope';
import { spellInKey, spellInKeySig } from './key-spelling';
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
