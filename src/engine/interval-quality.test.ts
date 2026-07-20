import {
  diatonicIntervalNumber,
  intervalLabel,
  intervalQuality,
  parseIntervalLabel,
  pitchSemitone,
} from './interval-quality';

describe('pitchSemitone — absolute semitone value of a spelled scientific pitch', () => {
  test('C4 is 48 and E4 is 52 (the plan-cited anchors)', () => {
    expect(pitchSemitone('C4')).toBe(48);
    expect(pitchSemitone('E4')).toBe(52);
  });

  test('a sharp/flat accidental shifts the value by exactly one semitone', () => {
    expect(pitchSemitone('F#4')).toBe(pitchSemitone('F4') + 1);
    expect(pitchSemitone('Gb4')).toBe(pitchSemitone('G4') - 1);
  });

  test('throws on a malformed pitch string', () => {
    expect(() => pitchSemitone('H4')).toThrow();
    expect(() => pitchSemitone('C')).toThrow();
  });
});

describe('intervalQuality — major-tonic table above C (only perfect/major exist above a major tonic)', () => {
  test.each([
    ['D4', 2, 'major'],
    ['E4', 3, 'major'],
    ['F4', 4, 'perfect'],
    ['G4', 5, 'perfect'],
    ['A4', 6, 'major'],
    ['B4', 7, 'major'],
    ['C5', 8, 'perfect'],
  ] as const)('C4 -> %s (number %i) classifies %s', (upper, number, expected) => {
    expect(intervalQuality('C4', upper, number)).toBe(expected);
  });
});

describe('intervalQuality — natural-minor table above A (D3: minor becomes reachable)', () => {
  test.each([
    ['B4', 2, 'major'],
    ['C5', 3, 'minor'],
    ['D5', 4, 'perfect'],
    ['E5', 5, 'perfect'],
    ['F5', 6, 'minor'],
    ['G5', 7, 'minor'],
    ['A5', 8, 'perfect'],
  ] as const)('A4 -> %s (number %i) classifies %s — natural-minor degree', (upper, number, expected) => {
    expect(intervalQuality('A4', upper, number)).toBe(expected);
  });

  test('all three minor degrees (3rd, 6th, 7th) are reachable above a natural-minor tonic', () => {
    expect(intervalQuality('A4', 'C5', 3)).toBe('minor');
    expect(intervalQuality('A4', 'F5', 6)).toBe('minor');
    expect(intervalQuality('A4', 'G5', 7)).toBe('minor');
  });
});

describe('intervalQuality — sharp-tonic spelling reads the accidental, not the letter', () => {
  test('F#4 -> A4 (A-natural under Fs minor signature, 3 semitones) classifies minor 3rd', () => {
    expect(diatonicIntervalNumber('F#4', 'A4')).toBe(3);
    expect(intervalQuality('F#4', 'A4', 3)).toBe('minor');
  });

  test('a raised-7th chromatic input F#4 -> E#5 (11 semitones, letter-count 7th) classifies major 7th', () => {
    expect(diatonicIntervalNumber('F#4', 'E#5')).toBe(7);
    expect(intervalQuality('F#4', 'E#5', 7)).toBe('major');
  });
});

describe('intervalQuality — fails loud on a diff outside grade-3 vocabulary (no dim/aug in scope)', () => {
  test('C4 -> Gb4 as a 5th (6 semitones, a diminished 5th) throws rather than inventing a label', () => {
    expect(() => intervalQuality('C4', 'Gb4', 5)).toThrow();
  });

  test('an out-of-vocabulary number (9, a compound interval) throws — neither perfect nor major/minor covers it', () => {
    expect(() => intervalQuality('C4', 'D5', 9)).toThrow();
  });
});

describe('diatonicIntervalNumber — letter-counting above the tonic, ignoring accidentals', () => {
  test('C4 -> C5 is an octave (number 8)', () => {
    expect(diatonicIntervalNumber('C4', 'C5')).toBe(8);
  });
});

describe('intervalLabel / parseIntervalLabel — the single serialization the generator emits and the validator parses', () => {
  test.each([
    ['minor', 3, 'minor 3rd'],
    ['perfect', 5, 'perfect 5th'],
    ['perfect', 8, 'perfect octave'],
  ] as const)('intervalLabel(%s, %i) round-trips through parseIntervalLabel', (quality, number, expectedLabel) => {
    const label = intervalLabel(quality, number);
    expect(label).toBe(expectedLabel);
    expect(parseIntervalLabel(label)).toEqual({ quality, number });
  });

  test('the octave label is specifically "perfect octave", never "perfect 8th" (confirmed copy, D5)', () => {
    expect(intervalLabel('perfect', 8)).toBe('perfect octave');
  });

  test('intervalLabel throws if number 8 is asked for a non-perfect quality (an octave can only be perfect)', () => {
    expect(() => intervalLabel('major', 8)).toThrow();
    expect(() => intervalLabel('minor', 8)).toThrow();
  });
});

describe('parseIntervalLabel — rejects malformed / out-of-vocabulary labels (the validator well-formedness check has teeth)', () => {
  test('"major 5th" rejects — 5 is a perfect-only number, major is an illegal quality for it', () => {
    expect(() => parseIntervalLabel('major 5th')).toThrow();
  });

  test('"diminished 4th" rejects — diminished is out of the grade-3 quality vocabulary entirely', () => {
    expect(() => parseIntervalLabel('diminished 4th')).toThrow();
  });

  test('"perfect 3rd" rejects — 3 is a major/minor-only number, perfect is an illegal quality for it', () => {
    expect(() => parseIntervalLabel('perfect 3rd')).toThrow();
  });
});
