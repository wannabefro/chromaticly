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

describe('intervalQuality — grade-4 (fyu.8): augmented/diminished from the standard modification rules', () => {
  test("F4 -> B4 (the tritone, 6 semitones) as a 4th is augmented", () => {
    expect(intervalQuality('F4', 'B4', 4)).toBe('augmented');
    expect(intervalLabel(intervalQuality('F4', 'B4', 4), 4)).toBe('augmented 4th');
  });

  test('B3 -> F4 (the tritone, 6 semitones) as a 5th is diminished', () => {
    expect(intervalQuality('B3', 'F4', 5)).toBe('diminished');
    expect(intervalLabel(intervalQuality('B3', 'F4', 5), 5)).toBe('diminished 5th');
  });

  test('E4 -> F4 is a minor 2nd; C4 -> D4 is a major 2nd', () => {
    expect(intervalQuality('E4', 'F4', 2)).toBe('minor');
    expect(intervalQuality('C4', 'D4', 2)).toBe('major');
  });

  test('D4 -> F4 is a minor 3rd; C4 -> E4 is a major 3rd', () => {
    expect(intervalQuality('D4', 'F4', 3)).toBe('minor');
    expect(intervalQuality('C4', 'E4', 3)).toBe('major');
  });

  test('C4 -> F4 (4th), C4 -> G4 (5th), and C4 -> C5 (octave) all stay perfect', () => {
    expect(intervalQuality('C4', 'F4', 4)).toBe('perfect');
    expect(intervalQuality('C4', 'G4', 5)).toBe('perfect');
    expect(intervalQuality('C4', 'C5', 8)).toBe('perfect');
  });
});

describe('intervalQuality — fails loud on a diff outside the widened vocabulary (no doubly-altered intervals in scope)', () => {
  test('C4 -> D4 claimed as a 4th (2 semitones, nowhere near perfect/augmented/diminished) throws rather than inventing a label', () => {
    expect(() => intervalQuality('C4', 'D4', 4)).toThrow();
  });

  test('C4 -> F4 claimed as a 2nd (5 semitones, nowhere near major/minor/augmented/diminished) throws rather than inventing a label', () => {
    expect(() => intervalQuality('C4', 'F4', 2)).toThrow();
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
    ['augmented', 4, 'augmented 4th'],
    ['diminished', 5, 'diminished 5th'],
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

  test('"perfect 3rd" rejects — 3 is a major/minor-only number, perfect is an illegal quality for it', () => {
    expect(() => parseIntervalLabel('perfect 3rd')).toThrow();
  });

  test('"diminished 4th" and "augmented 3rd" are well-formed (aug/dim apply to any classifiable number)', () => {
    expect(() => parseIntervalLabel('diminished 4th')).not.toThrow();
    expect(() => parseIntervalLabel('augmented 3rd')).not.toThrow();
  });
});
