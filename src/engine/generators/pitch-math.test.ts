import {
  naturalPitchAtOrdinal,
  naturalPitchStepsAbove,
  parseNaturalPitch,
  pitchOrdinal,
  scientificPitchOrdinal,
} from './pitch-math';

describe('pitchOrdinal / naturalPitchAtOrdinal — round-trip', () => {
  test('naturalPitchAtOrdinal(pitchOrdinal(letter, octave)) recovers the original pitch', () => {
    for (const pitch of ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'E2', 'D0']) {
      const { letter, octave } = parseNaturalPitch(pitch);
      expect(naturalPitchAtOrdinal(pitchOrdinal(letter, octave))).toBe(pitch);
    }
  });

  test('ordinal increases by exactly 1 per diatonic (letter-name) step', () => {
    expect(scientificPitchOrdinal('D4') - scientificPitchOrdinal('C4')).toBe(1);
    expect(scientificPitchOrdinal('C5') - scientificPitchOrdinal('C4')).toBe(7);
    expect(scientificPitchOrdinal('B4') - scientificPitchOrdinal('C4')).toBe(6);
  });
});

describe('naturalPitchStepsAbove', () => {
  test('0 steps above returns the same pitch', () => {
    expect(naturalPitchStepsAbove('C4', 0)).toBe('C4');
  });

  test('7 steps above is exactly one octave up', () => {
    expect(naturalPitchStepsAbove('C4', 7)).toBe('C5');
  });

  test('4 steps above C4 is G4 (a 5th, inclusive counting = 5)', () => {
    expect(naturalPitchStepsAbove('C4', 4)).toBe('G4');
  });
});

describe('parseNaturalPitch — rejects accidented pitches', () => {
  test('throws on a pitch carrying a sharp or flat symbol', () => {
    expect(() => parseNaturalPitch('F#4')).toThrow();
    expect(() => parseNaturalPitch('Bb3')).toThrow();
  });
});
