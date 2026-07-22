import { keyAccidentals } from '../music/abc-emitter';
import { KB } from '../content/knowledge-base';
import {
  comfortablePitchRange,
  diatonicPitchesInRange,
  GRADE_SCOPES,
  pitchRange,
  renderableTimeSignatures,
  scopeForGrade,
} from './scope';

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
  test.each([0, 4, 99])('scopeForGrade(%i) throws, naming the grade', (grade) => {
    expect(() => scopeForGrade(grade)).toThrow(String(grade));
  });
});

describe('keyAccidentals round-trip — every grade-1/grade-2/grade-3 tonic is emitter-safe (invariant: no scope key can reach the emitter and explode)', () => {
  test('every keysMajor tonic at grade 1, grade 2, and grade 3 resolves without throwing', () => {
    for (const grade of [1, 2, 3] as const) {
      for (const tonic of scopeForGrade(grade).keysMajor) {
        expect(() => keyAccidentals(`${tonic}_major`)).not.toThrow();
      }
    }
  });

  test('every keysMinor tonic at grade 2 and grade 3 resolves without throwing — including the sharp tonics F#/C# (D5)', () => {
    for (const grade of [2, 3] as const) {
      for (const tonic of scopeForGrade(grade).keysMinor) {
        expect(() => keyAccidentals(`${tonic}_minor`)).not.toThrow();
      }
    }
  });
});

// --- U2 grade-3 scope additions (D1) ---

describe('scopeForGrade(3) — grade-3 scope entry (D1): keys/forms are grade-2 unioned with KB.grade3Adds', () => {
  test('keysMinor/keysMajor/minorForms equal grade-2 lists unioned with KB.grade3Adds, order-preserved', () => {
    const g2 = scopeForGrade(2);
    const g3 = scopeForGrade(3);
    expect(g3.keysMinor).toEqual([...g2.keysMinor, ...KB.grade3Adds.keys_minor]);
    expect(g3.keysMajor).toEqual([...g2.keysMajor, ...KB.grade3Adds.keys_major]);
    expect(g3.minorForms).toEqual([...g2.minorForms, ...KB.grade3Adds.minor_forms]);
  });

  test('grade-3 keysMinor/keysMajor/minorForms match the plan D1 table exactly', () => {
    const g3 = scopeForGrade(3);
    expect(g3.keysMinor).toEqual(['A', 'E', 'D', 'B', 'G', 'F#', 'C', 'C#', 'F']);
    expect(g3.keysMajor).toEqual(['C', 'G', 'D', 'F', 'A', 'Bb', 'Eb', 'E', 'Ab']);
    expect(g3.minorForms).toEqual(['harmonic', 'melodic']);
  });

  test('clefs are frozen at grade-2 values; rhythmDevices widens with anacrusis (D6); pitchRanges widens (see the ledger-lines-3 block below)', () => {
    const g2 = scopeForGrade(2);
    const g3 = scopeForGrade(3);
    expect(g3.clefs).toEqual(g2.clefs);
  });

  test('anacrusis is a Grade 3 device — rhythmDevices = grade-2 list unioned with KB.grade3Adds.rhythm_devices (D6)', () => {
    const g2 = scopeForGrade(2);
    const g3 = scopeForGrade(3);
    expect(g3.rhythmDevices).toEqual([...g2.rhythmDevices, 'anacrusis']);
    expect(g2.rhythmDevices).not.toContain('anacrusis');
    expect(scopeForGrade(1).rhythmDevices).not.toContain('anacrusis');
  });

  test('noteValues = grade-2 list unioned with KB.grade3Adds.note_values (demisemiquaver) — enters scope now that bar-math (U4) has its UNITS row (D2/R1)', () => {
    const g2 = scopeForGrade(2);
    const g3 = scopeForGrade(3);
    expect(g3.noteValues).toEqual([...g2.noteValues, ...KB.grade3Adds.note_values]);
    expect(g3.noteValues).toEqual(['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver', 'demisemiquaver']);
  });

  test('grade-3 intervalRule widens to number_and_type, cross-checked against the KB naming string it implements (D1/U1)', () => {
    expect(scopeForGrade(3).intervalRule).toEqual({
      aboveTonicOnly: true,
      namingStyle: 'number_and_type',
      maxOctaves: 1,
    });
    expect(KB.grade3Adds.intervals.naming).toBe('number + type (perfect, major, minor)');
  });

  test('grade-1 and grade-2 intervalRule stay number-only — the grade-3 object is additive, not a mutation of shared state (D1/U1)', () => {
    expect(scopeForGrade(1).intervalRule).toEqual({ aboveTonicOnly: true, namingStyle: 'number', maxOctaves: 1 });
    expect(scopeForGrade(2).intervalRule).toEqual({ aboveTonicOnly: true, namingStyle: 'number', maxOctaves: 1 });
  });

  test('grade-3 timeSignatures = grade-2 list unioned with KB.grade3Adds.time_signatures, order-preserved (D2/U2)', () => {
    const g2 = scopeForGrade(2);
    const g3 = scopeForGrade(3);
    expect(g3.timeSignatures).toEqual([...g2.timeSignatures, ...KB.grade3Adds.time_signatures]);
    expect(g3.timeSignatures).toEqual(['2/4', '3/4', '4/4', '2/2', '3/2', '4/2', '6/8', '9/8', '12/8']);
  });

  test('renderableTimeSignatures(1) and (2) are the frozen /4 set; renderableTimeSignatures(3) opens exactly the compound trio alongside it, no /2 leak (D2/U2)', () => {
    expect(renderableTimeSignatures(1)).toEqual(['2/4', '3/4', '4/4']);
    expect(renderableTimeSignatures(2)).toEqual(['2/4', '3/4', '4/4']);
    expect(renderableTimeSignatures(3)).toEqual(['2/4', '3/4', '4/4', '6/8', '9/8', '12/8']);
  });

  test('grade-1 and grade-2 scope objects are byte-identical to their pre-grade-3 values (additive-only)', () => {
    expect(scopeForGrade(1)).toEqual({
      clefs: ['treble', 'bass'],
      noteValues: ['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver'],
      keysMajor: ['C', 'G', 'D', 'F'],
      keysMinor: [],
      minorForms: [],
      timeSignatures: ['2/4', '3/4', '4/4'],
      rhythmDevices: ['tie', 'single_dot'],
      intervalRule: { aboveTonicOnly: true, namingStyle: 'number', maxOctaves: 1 },
      pitchRanges: { treble: { low: 'C4', high: 'A5' }, bass: { low: 'E2', high: 'D4' } },
    });
    expect(scopeForGrade(2)).toEqual({
      clefs: ['treble', 'bass'],
      noteValues: ['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver'],
      keysMajor: ['C', 'G', 'D', 'F', 'A', 'Bb', 'Eb'],
      keysMinor: ['A', 'E', 'D'],
      minorForms: ['harmonic'],
      timeSignatures: ['2/4', '3/4', '4/4', '2/2', '3/2', '4/2'],
      rhythmDevices: ['tie', 'single_dot', 'triplet', 'triplet_with_rests', 'dotted_rests'],
      intervalRule: { aboveTonicOnly: true, namingStyle: 'number', maxOctaves: 1 },
      pitchRanges: { treble: { low: 'A3', high: 'C6' }, bass: { low: 'C2', high: 'E4' } },
    });
  });
});

// Ledger-lines-3 slice (chromaticly-1v5.6): GRADE_3_SCOPE.pitchRanges widens
// to a distinct literal, one ledger line further out each direction — grade
// 1/2 pitchRanges must stay untouched (proven above), and the widening must
// be grade-3-isolated since pitchRange/diatonicPitchesInRange are grade-parameterized.
describe('scopeForGrade(3).pitchRanges — ledger-lines-3 widening (chromaticly-1v5.6)', () => {
  test('grade-3 pitch bounds are exactly F3/E6 for treble and A1/G4 for bass', () => {
    expect(GRADE_SCOPES[3].pitchRanges.treble).toEqual({ low: 'F3', high: 'E6' });
    expect(GRADE_SCOPES[3].pitchRanges.bass).toEqual({ low: 'A1', high: 'G4' });
  });

  test('grade-1 and grade-2 pitchRanges are unchanged by the grade-3 widening', () => {
    expect(GRADE_SCOPES[1].pitchRanges).toEqual({ treble: { low: 'C4', high: 'A5' }, bass: { low: 'E2', high: 'D4' } });
    expect(GRADE_SCOPES[2].pitchRanges).toEqual({ treble: { low: 'A3', high: 'C6' }, bass: { low: 'C2', high: 'E4' } });
  });

  test('the grade-3 range is strictly wider than grade 2 — every grade-2 diatonic pitch is also in range at grade 3', () => {
    for (const clef of ['treble', 'bass'] as const) {
      const g2Pitches = new Set(diatonicPitchesInRange(clef, 2));
      const g3Pitches = new Set(diatonicPitchesInRange(clef, 3));
      for (const pitch of g2Pitches) expect(g3Pitches.has(pitch)).toBe(true);
      expect(g3Pitches.size).toBeGreaterThan(g2Pitches.size);
    }
  });

  test('diatonicPitchesInRange(clef, 3) first/last elements match the declared grade-3 bounds', () => {
    for (const clef of ['treble', 'bass'] as const) {
      const { low, high } = pitchRange(clef, 3);
      const pitches = diatonicPitchesInRange(clef, 3);
      expect(pitches[0]).toBe(low);
      expect(pitches[pitches.length - 1]).toBe(high);
    }
  });
});

// comfortablePitchRange (ledger-lines-3 follow-up fix): the reading range
// (pitchRange) widens with grade, but incidental-notation generators
// (add_time_signature, metre_classification) must stay in a comfortable band
// that caps at the grade-2 range — see the rationale comment on
// comfortablePitchRange in scope.ts.
describe('comfortablePitchRange — caps at the grade-2 range, never widens past it (incidental-notation invariant)', () => {
  test('grade 1 stays the grade-1 range (below the cap, unaffected)', () => {
    for (const clef of ['treble', 'bass'] as const) {
      expect(comfortablePitchRange(clef, 1)).toEqual(pitchRange(clef, 1));
    }
  });

  test('grade 2 stays the grade-2 range (at the cap)', () => {
    for (const clef of ['treble', 'bass'] as const) {
      expect(comfortablePitchRange(clef, 2)).toEqual(pitchRange(clef, 2));
    }
  });

  test('grade 3 is capped at the grade-2 range, not the wider grade-3 reading range', () => {
    for (const clef of ['treble', 'bass'] as const) {
      expect(comfortablePitchRange(clef, 3)).toEqual(pitchRange(clef, 2));
      expect(comfortablePitchRange(clef, 3)).not.toEqual(pitchRange(clef, 3));
    }
  });
});
