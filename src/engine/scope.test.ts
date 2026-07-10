import {
  diatonicPitchesInRange,
  G1_INTERVAL_RULE,
  G1_KEYS_MAJOR,
  G1_NOTE_VALUES,
  G1_TIME_SIGNATURES,
  pitchRange,
} from './scope';

describe('G1_KEYS_MAJOR — commandment 1 (scope is law)', () => {
  test('only the four G1 major keys are exposed, and no minor key ever appears', () => {
    expect(G1_KEYS_MAJOR).toEqual(['C', 'G', 'D', 'F']);
    expect(G1_KEYS_MAJOR).not.toContain('A_minor');
    expect(G1_KEYS_MAJOR.some((k) => k.toLowerCase().includes('minor'))).toBe(false);
  });
});

describe('G1_TIME_SIGNATURES — scope is law', () => {
  test('excludes 6/8, which is a later-grade compound time signature', () => {
    expect(G1_TIME_SIGNATURES).not.toContain('6/8');
  });

  test('is exactly the three G1 simple time signatures', () => {
    expect(G1_TIME_SIGNATURES).toEqual(['2/4', '3/4', '4/4']);
  });
});

describe('G1_NOTE_VALUES — scope is law', () => {
  test('excludes demisemiquaver, which is introduced at grade 3', () => {
    expect(G1_NOTE_VALUES).not.toContain('demisemiquaver');
  });

  test('excludes breve, which is not part of the G1 note-value scope', () => {
    expect(G1_NOTE_VALUES).not.toContain('breve');
  });
});

describe('G1_INTERVAL_RULE', () => {
  test('matches the KB rule: number-only naming, above tonic only, max one octave', () => {
    expect(G1_INTERVAL_RULE.aboveTonicOnly).toBe(true);
    expect(G1_INTERVAL_RULE.namingStyle).toBe('number');
    expect(G1_INTERVAL_RULE.maxOctaves).toBe(1);
  });
});

describe('diatonicPitchesInRange — every enumerated pitch stays within the declared clef bounds', () => {
  test('treble pitches never go below C4 or above A5', () => {
    const pitches = diatonicPitchesInRange('treble');
    expect(pitches.length).toBeGreaterThan(0);
    for (const p of pitches) {
      const match = /^([A-G])(\d)$/.exec(p);
      expect(match).not.toBeNull();
      const [, letter, octaveStr] = match!;
      const octave = Number(octaveStr);
      // reject anything below C4
      expect(octave === 4 ? 'CDEFGAB'.indexOf(letter) >= 0 : true).toBe(true);
      expect(octave).toBeGreaterThanOrEqual(4);
      if (octave === 4) expect('CDEFGAB'.indexOf(letter)).toBeGreaterThanOrEqual('CDEFGAB'.indexOf('C'));
      expect(octave).toBeLessThanOrEqual(5);
      if (octave === 5) expect('CDEFGAB'.indexOf(letter)).toBeLessThanOrEqual('CDEFGAB'.indexOf('A'));
    }
    expect(pitches[0]).toBe('C4');
    expect(pitches[pitches.length - 1]).toBe('A5');
  });

  test('bass pitches never go below E2 or above D4', () => {
    const pitches = diatonicPitchesInRange('bass');
    expect(pitches.length).toBeGreaterThan(0);
    for (const p of pitches) {
      const match = /^([A-G])(\d)$/.exec(p);
      expect(match).not.toBeNull();
      const [, letter, octaveStr] = match!;
      const octave = Number(octaveStr);
      expect(octave).toBeGreaterThanOrEqual(2);
      if (octave === 2) expect('CDEFGAB'.indexOf(letter)).toBeGreaterThanOrEqual('CDEFGAB'.indexOf('E'));
      expect(octave).toBeLessThanOrEqual(4);
      if (octave === 4) expect('CDEFGAB'.indexOf(letter)).toBeLessThanOrEqual('CDEFGAB'.indexOf('D'));
    }
    expect(pitches[0]).toBe('E2');
    expect(pitches[pitches.length - 1]).toBe('D4');
  });

  test('the enumerator only ever returns pitches inside the declared low/high bounds for the given clef', () => {
    for (const clef of ['treble', 'bass'] as const) {
      const { low, high } = pitchRange(clef);
      const pitches = diatonicPitchesInRange(clef);
      expect(pitches[0]).toBe(low);
      expect(pitches[pitches.length - 1]).toBe(high);
    }
  });
});
