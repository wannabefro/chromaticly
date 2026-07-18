import { keyAccidentals } from '../music/abc-emitter';
import { KB } from '../content/knowledge-base';
import { diatonicPitchesInRange, GRADE_SCOPES, pitchRange, scopeForGrade } from './scope';

// --- Ported invariants (were G1_* module-level constants; now scopeForGrade(1)) ---

describe('scopeForGrade(1).keysMajor — commandment 1 (scope is law)', () => {
  test('only the four G1 major keys are exposed, and no minor key ever appears', () => {
    expect(scopeForGrade(1).keysMajor).toEqual(['C', 'G', 'D', 'F']);
    expect(scopeForGrade(1).keysMajor).not.toContain('A_minor');
    expect(scopeForGrade(1).keysMajor.some((k) => k.toLowerCase().includes('minor'))).toBe(false);
  });
});

describe('scopeForGrade(1).timeSignatures — scope is law', () => {
  test('excludes 6/8, which is a later-grade compound time signature', () => {
    expect(scopeForGrade(1).timeSignatures).not.toContain('6/8');
  });

  test('is exactly the three G1 simple time signatures', () => {
    expect(scopeForGrade(1).timeSignatures).toEqual(['2/4', '3/4', '4/4']);
  });
});

describe('scopeForGrade(1).noteValues — scope is law', () => {
  test('excludes demisemiquaver, which is introduced at grade 3', () => {
    expect(scopeForGrade(1).noteValues).not.toContain('demisemiquaver');
  });

  test('excludes breve, which is not part of the G1 note-value scope', () => {
    expect(scopeForGrade(1).noteValues).not.toContain('breve');
  });
});

describe('scopeForGrade(1).intervalRule', () => {
  test('matches the KB rule: number-only naming, above tonic only, max one octave', () => {
    expect(scopeForGrade(1).intervalRule.aboveTonicOnly).toBe(true);
    expect(scopeForGrade(1).intervalRule.namingStyle).toBe('number');
    expect(scopeForGrade(1).intervalRule.maxOctaves).toBe(1);
  });
});

describe('diatonicPitchesInRange — every enumerated pitch stays within the declared clef bounds', () => {
  test('treble pitches never go below C4 or above A5 at grade 1', () => {
    const pitches = diatonicPitchesInRange('treble', 1);
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

  test('bass pitches never go below E2 or above D4 at grade 1', () => {
    const pitches = diatonicPitchesInRange('bass', 1);
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

  test('the enumerator only ever returns pitches inside the declared low/high bounds for the given clef, at grade 1', () => {
    for (const clef of ['treble', 'bass'] as const) {
      const { low, high } = pitchRange(clef, 1);
      const pitches = diatonicPitchesInRange(clef, 1);
      expect(pitches[0]).toBe(low);
      expect(pitches[pitches.length - 1]).toBe(high);
    }
  });
});

// --- U2 additions ---

describe('scopeForGrade(1) — bit-identical to the pre-refactor G1_* constants (invariant 1)', () => {
  test('grade-1 keysMajor/timeSignatures/noteValues deep-equal the legacy values, in order (order = RNG stability)', () => {
    expect(scopeForGrade(1).keysMajor).toEqual(['C', 'G', 'D', 'F']);
    expect(scopeForGrade(1).timeSignatures).toEqual(['2/4', '3/4', '4/4']);
    expect(scopeForGrade(1).noteValues).toEqual(['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver']);
    expect(scopeForGrade(1).clefs).toEqual(['treble', 'bass']);
  });

  test('grade-1 minor scope is empty, and no grade-1 list contains a minor-flavored string', () => {
    expect(scopeForGrade(1).keysMinor).toEqual([]);
    expect(scopeForGrade(1).minorForms).toEqual([]);
    for (const list of [scopeForGrade(1).keysMajor, scopeForGrade(1).timeSignatures, scopeForGrade(1).noteValues]) {
      expect(list.some((v) => v.toLowerCase().includes('minor'))).toBe(false);
    }
  });
});

describe('scopeForGrade(2) — exact contents per the D2 table, order-sensitive', () => {
  test('grade-2 dimensions match the plan D2 table exactly, in order', () => {
    const g2 = scopeForGrade(2);
    expect(g2.clefs).toEqual(['treble', 'bass']);
    expect(g2.noteValues).toEqual(['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver']);
    expect(g2.keysMajor).toEqual(['C', 'G', 'D', 'F', 'A', 'Bb', 'Eb']);
    expect(g2.keysMinor).toEqual(['A', 'E', 'D']);
    expect(g2.minorForms).toEqual(['harmonic']);
    expect(g2.timeSignatures).toEqual(['2/4', '3/4', '4/4', '2/2', '3/2', '4/2']);
    expect(g2.rhythmDevices).toEqual(['tie', 'single_dot', 'triplet', 'triplet_with_rests', 'dotted_rests']);
    expect(g2.intervalRule).toEqual({ aboveTonicOnly: true, namingStyle: 'number', maxOctaves: 1 });
  });
});

describe('grade-1 lists are a structural prefix of grade-2 lists for additive dimensions', () => {
  test('keysMajor, timeSignatures, and rhythmDevices at grade 1 are a prefix of grade 2 (append, never reorder)', () => {
    const g1 = scopeForGrade(1);
    const g2 = scopeForGrade(2);
    expect(g2.keysMajor.slice(0, g1.keysMajor.length)).toEqual(g1.keysMajor);
    expect(g2.timeSignatures.slice(0, g1.timeSignatures.length)).toEqual(g1.timeSignatures);
    expect(g2.rhythmDevices.slice(0, g1.rhythmDevices.length)).toEqual(g1.rhythmDevices);
    // keysMinor/minorForms are empty at grade 1, so any grade-2 list is trivially a superset-with-empty-prefix
    expect(g1.keysMinor).toEqual([]);
    expect(g1.minorForms).toEqual([]);
  });
});

describe('GRADE_SCOPES vs knowledge-base.ts — TS-table/KB drift guard (D1 mitigation)', () => {
  test('grade-2 additive lists equal grade-1 lists unioned with grade_scopes["2"].adds, order-preserved', () => {
    const g1 = scopeForGrade(1);
    const g2 = scopeForGrade(2);
    expect(g2.keysMajor).toEqual([...KB.grade1.keys_major, ...KB.grade2Adds.keys_major]);
    expect(g2.keysMinor).toEqual([...g1.keysMinor, ...KB.grade2Adds.keys_minor]);
    expect(g2.minorForms).toEqual([...g1.minorForms, ...KB.grade2Adds.minor_forms]);
    expect(g2.timeSignatures).toEqual([...KB.grade1.time_signatures, ...KB.grade2Adds.time_signatures]);
  });
});

describe('grade-2 pitch ranges (D3 judgment call)', () => {
  test('pitch bounds are exactly A3/C6 for treble and C2/E4 for bass', () => {
    expect(GRADE_SCOPES[2].pitchRanges.treble).toEqual({ low: 'A3', high: 'C6' });
    expect(GRADE_SCOPES[2].pitchRanges.bass).toEqual({ low: 'C2', high: 'E4' });
  });

  test('diatonicPitchesInRange(clef, 2) first/last elements match the declared grade-2 bounds', () => {
    for (const clef of ['treble', 'bass'] as const) {
      const { low, high } = pitchRange(clef, 2);
      const pitches = diatonicPitchesInRange(clef, 2);
      expect(pitches[0]).toBe(low);
      expect(pitches[pitches.length - 1]).toBe(high);
    }
  });

  test('grade-1 pitch enumeration is a contiguous subsequence of grade-2 (replace-not-union bounds, wider superset)', () => {
    for (const clef of ['treble', 'bass'] as const) {
      const g1Pitches = diatonicPitchesInRange(clef, 1);
      const g2Pitches = diatonicPitchesInRange(clef, 2);
      const startIndex = g2Pitches.indexOf(g1Pitches[0]);
      expect(startIndex).toBeGreaterThanOrEqual(0);
      expect(g2Pitches.slice(startIndex, startIndex + g1Pitches.length)).toEqual(g1Pitches);
    }
  });
});

describe('scopeForGrade — unsupported grades fail loud', () => {
  test.each([0, 3, 99])('scopeForGrade(%i) throws, naming the grade', (grade) => {
    expect(() => scopeForGrade(grade)).toThrow(String(grade));
  });
});

describe('keyAccidentals round-trip — every grade-1/grade-2 tonic is emitter-safe (invariant: no scope key can reach the emitter and explode)', () => {
  test('every keysMajor tonic at grade 1 and grade 2 resolves without throwing', () => {
    for (const grade of [1, 2] as const) {
      for (const tonic of scopeForGrade(grade).keysMajor) {
        expect(() => keyAccidentals(`${tonic}_major`)).not.toThrow();
      }
    }
  });

  test('every keysMinor tonic at grade 2 resolves without throwing', () => {
    for (const tonic of scopeForGrade(2).keysMinor) {
      expect(() => keyAccidentals(`${tonic}_minor`)).not.toThrow();
    }
  });
});
