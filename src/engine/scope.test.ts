import { keyAccidentals } from '../music/abc-emitter';
import { KB } from '../content/knowledge-base';
import {
  comfortablePitchRange,
  diatonicPitchesInRange,
  GRADE_SCOPES,
  metreRenderableTimeSignatures,
  pitchRange,
  renderableTimeSignatures,
  scopeForGrade,
} from './scope';

describe('metreRenderableTimeSignatures — metre-scoped path, global set untouched (chromaticly-570)', () => {
  // 3/8 left this list at chromaticly-e3z.9: it is a Grade 2 metre.
  const NEW_METRES = ['2/8', '4/8', '6/4', '9/4', '12/4', '6/16', '9/16', '12/16'];

  test('grade 4 exposes the nine new metres plus the grade-3 set', () => {
    for (const sig of [...NEW_METRES, '3/8', '2/4', '3/4', '4/4', '6/8', '9/8', '12/8']) {
      expect(metreRenderableTimeSignatures(4)).toContain(sig);
    }
  });

  test('grades 1-3 match the global renderable set exactly (byte-identity)', () => {
    for (const grade of [1, 2, 3]) {
      expect(metreRenderableTimeSignatures(grade)).toEqual(renderableTimeSignatures(grade));
    }
  });

  test('the GLOBAL renderableTimeSignatures never carries the new metres — even at grade 4', () => {
    for (const grade of [1, 2, 3, 4]) {
      for (const sig of NEW_METRES) {
        expect(renderableTimeSignatures(grade)).not.toContain(sig);
      }
    }
  });
});

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

// chromaticly-gni — rest values in scope widen with the grades, mirroring the
// KB's per-grade `rests` arrays (whole_bar excluded: it is not a Duration; the
// semibreve rest serves as the whole-bar rest).
describe('scopeForGrade(N).rests — rests mirror note values, cumulative per grade', () => {
  test('grade 1 exposes the five basic rest values (no whole_bar token)', () => {
    expect(scopeForGrade(1).rests).toEqual(['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver']);
    expect(scopeForGrade(1).rests).not.toContain('whole_bar');
    expect(scopeForGrade(1).rests).not.toContain('demisemiquaver');
    expect(scopeForGrade(1).rests).not.toContain('breve');
  });

  test('grade 2 adds no rests (same as grade 1)', () => {
    expect(scopeForGrade(2).rests).toEqual(scopeForGrade(1).rests);
  });

  test('grade 3 adds the demisemiquaver rest', () => {
    expect(scopeForGrade(3).rests).toContain('demisemiquaver');
    expect(scopeForGrade(3).rests).not.toContain('breve');
  });

  test('grade 4 adds the breve rest and is cumulative over grade 3', () => {
    expect(scopeForGrade(4).rests).toContain('breve');
    for (const r of scopeForGrade(3).rests) expect(scopeForGrade(4).rests).toContain(r);
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

// chromaticly-tqg.5. The grade-1 bounds were A5 and E2, and both were one
// position too far because the stave geometry was misread. Numbers alone would
// not have caught it, so this asserts the RULE the numbers come from.
describe('grade 1 draws no ledger line but middle C', () => {
  const LINE_INDEX = (p: string) => Number(p[1]) * 7 + 'CDEFGAB'.indexOf(p[0]);
  const STAVE = { treble: { bottom: 'E4', top: 'F5' }, bass: { bottom: 'G2', top: 'A3' } } as const;

  test.each(['treble', 'bass'] as const)('%s: every out-of-stave pitch is a space, except middle C', (clef) => {
    const { bottom, top } = STAVE[clef];
    for (const pitch of diatonicPitchesInRange(clef, 1)) {
      const outside = LINE_INDEX(pitch) < LINE_INDEX(bottom) || LINE_INDEX(pitch) > LINE_INDEX(top);
      if (!outside) continue;
      const onLedger = (LINE_INDEX(pitch) - LINE_INDEX(bottom)) % 2 === 0;
      if (onLedger) expect(pitch).toBe('C4');
    }
  });

  // The bound itself, not a value inside it: one position further out is the
  // ledger line, which is exactly the mistake this replaced.
  test.each([
    ['treble', 'G5', 'A5'],
    ['bass', 'F2', 'E2'],
  ])('%s stops at %s, because %s is a ledger line', (clef, kept, dropped) => {
    const pitches = diatonicPitchesInRange(clef as 'treble' | 'bass', 1);
    expect(pitches).toContain(kept);
    expect(pitches).not.toContain(dropped);
  });
});

describe('diatonicPitchesInRange — every enumerated pitch stays within the declared clef bounds', () => {
  test('treble pitches never go below C4 or above G5 at grade 1', () => {
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
    expect(pitches[pitches.length - 1]).toBe('G5');
  });

  test('bass pitches never go below F2 or above D4 at grade 1', () => {
    const pitches = diatonicPitchesInRange('bass', 1);
    expect(pitches.length).toBeGreaterThan(0);
    for (const p of pitches) {
      const match = /^([A-G])(\d)$/.exec(p);
      expect(match).not.toBeNull();
      const [, letter, octaveStr] = match!;
      const octave = Number(octaveStr);
      expect(octave).toBeGreaterThanOrEqual(2);
      if (octave === 2) expect('CDEFGAB'.indexOf(letter)).toBeGreaterThanOrEqual('CDEFGAB'.indexOf('F'));
      expect(octave).toBeLessThanOrEqual(4);
      if (octave === 4) expect('CDEFGAB'.indexOf(letter)).toBeLessThanOrEqual('CDEFGAB'.indexOf('D'));
    }
    expect(pitches[0]).toBe('F2');
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
    expect(g2.timeSignatures).toEqual(['2/4', '3/4', '4/4', '2/2', '3/2', '4/2', '3/8']);
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
  // Grade 5 is supported (chromaticly-ehp) and grade 0 is now First steps
  // (chromaticly-dhe), so the supported band is 0..5 and it is bounded at both
  // ends: -1 below, 6 above.
  test.each([-1, 6, 99])('scopeForGrade(%i) throws, naming the grade', (grade) => {
    expect(() => scopeForGrade(grade)).toThrow(String(grade));
  });
});

// Grade 5 (chromaticly-ehp, then chromaticly-e3z.4). Some grade-5 dimensions
// attach via atoms + generator grade-gates rather than GradeScope fields —
// GradeScope has no chord/ornament/instrument axis, so chord inversions,
// transposing instruments and ornament→sign leave it untouched. Keys are not
// like that: the syllabus caps grade 5 at six sharps and flats, and every
// key-consuming generator reads keysMajor/keysMinor, so the widening has to
// land here.
describe('scopeForGrade(5) — keys, intervals, metres and the tenor clef all widen', () => {
  test('grade 5 is supported and does not throw', () => {
    expect(() => scopeForGrade(5)).not.toThrow();
  });

  // The syllabus line this encodes: "all major and minor keys up to and
  // including six sharps and flats". Six is the cap, so a seventh appearing
  // here would be out of scope, not merely untested.
  test('the six-accidental keys are in scope, and nothing beyond them', () => {
    const g5 = scopeForGrade(5);
    expect(g5.keysMajor).toEqual(expect.arrayContaining(['F#', 'Gb']));
    expect(g5.keysMinor).toEqual(expect.arrayContaining(['D#', 'Eb']));
    expect(g5.keysMajor).not.toEqual(expect.arrayContaining(['C#', 'Cb']));
    expect(g5.keysMinor).not.toEqual(expect.arrayContaining(['A#', 'Ab']));
  });

  test('the key widening is additive — grade 4 keeps its own five-accidental cap', () => {
    expect(scopeForGrade(4).keysMajor).not.toEqual(expect.arrayContaining(['F#', 'Gb']));
    expect(scopeForGrade(4).keysMinor).not.toEqual(expect.arrayContaining(['D#', 'Eb']));
    for (const key of scopeForGrade(4).keysMajor) expect(scopeForGrade(5).keysMajor).toContain(key);
  });

  // Compound intervals (chromaticly-e3z.8): "all simple and compound intervals
  // from any note". The domain was already open beyond the tonic at grade 4, so
  // the widening is the octave alone.
  test('intervals reach two octaves, and the domain stays open beyond the tonic', () => {
    expect(scopeForGrade(5).intervalRule).toEqual({
      aboveTonicOnly: false,
      namingStyle: 'number_and_type',
      maxOctaves: 2,
    });
    expect(scopeForGrade(4).intervalRule.maxOctaves).toBe(1);
  });

  test('the note-value and rest dimensions still deep-equal grade 4', () => {
    const g5 = scopeForGrade(5);
    const g4 = scopeForGrade(4);
    expect(g5.noteValues).toEqual(g4.noteValues);
    expect(g5.rests).toEqual(g4.rests);
    expect(g5.minorForms).toEqual(g4.minorForms);
    expect(g5.pitchRanges).toEqual(g4.pitchRanges);
  });

  // chromaticly-e3z.7: "the identification of notes in the four clefs".
  test('all four clefs are readable at grade 5, and only three below it', () => {
    expect(scopeForGrade(5).clefs).toEqual(['treble', 'bass', 'alto', 'tenor']);
    expect(scopeForGrade(4).clefs).not.toContain('tenor');
    expect(scopeForGrade(3).clefs).toEqual(['treble', 'bass']);
  });

  test('the tenor reading range is centred on the 4th-line C, not copied from alto', () => {
    const { tenor, alto } = scopeForGrade(5).pitchRanges;
    expect(tenor).toEqual({ low: 'E2', high: 'D5' });
    expect(tenor).not.toEqual(alto);
  });

  // chromaticly-e3z.6. They are confined to metre_classification exactly as the
  // grade-4 metres are: the GLOBAL renderable set has consumers that assume a
  // crotchet-beat or fixed-family model and cannot draw a 3+2 bar.
  test('the irregular metres are in scope and metre-renderable, but not globally renderable', () => {
    for (const sig of ['5/4', '7/4', '5/8', '7/8']) {
      expect(scopeForGrade(5).timeSignatures).toContain(sig);
      expect(metreRenderableTimeSignatures(5)).toContain(sig);
      expect(renderableTimeSignatures(5)).not.toContain(sig);
      expect(metreRenderableTimeSignatures(4)).not.toContain(sig);
    }
  });

  test("the rewrite slice's 2/4↔6/8 are already renderable at grade 5 (no new metre entry needed)", () => {
    expect(renderableTimeSignatures(5)).toEqual(expect.arrayContaining(['2/4', '6/8']));
  });

  test('grades 1-4 scope objects are unchanged by adding grade 5 (additive-only)', () => {
    expect(scopeForGrade(4).keysMajor).toEqual(expect.arrayContaining(['B', 'Db']));
    expect(scopeForGrade(1).timeSignatures).toEqual(['2/4', '3/4', '4/4']);
  });
});

describe('scopeForGrade(4) — Grade 4 scope is wired (fyu.4)', () => {
  test('grade 4 is supported and carries the additive keys, note value, rhythm devices, and time signatures', () => {
    const g4 = scopeForGrade(4);
    // keys widen over grade 3 with B/Db major + Bb/G# minor
    expect(g4.keysMajor).toEqual(expect.arrayContaining(['B', 'Db']));
    expect(g4.keysMinor).toEqual(expect.arrayContaining(['Bb', 'G#']));
    // breve joins the note values; double_dot + duplet join the rhythm devices
    expect(g4.noteValues).toContain('breve');
    expect(g4.rhythmDevices).toEqual(expect.arrayContaining(['double_dot', 'duplet']));
    // the resolved (VERIFY-flag) time-signature set is added on top of grade 3's
    expect(g4.timeSignatures).toEqual(
      expect.arrayContaining(['2/8', '3/8', '4/8', '6/4', '9/4', '12/4', '6/16', '9/16', '12/16']),
    );
    // intervals open beyond the tonic (aug/dim + between-any-notes naming lands in fyu.8)
    expect(g4.intervalRule.aboveTonicOnly).toBe(false);
  });

  test('grade 4 is a superset of grade 3 keys (additive, not replacement)', () => {
    const g3 = scopeForGrade(3);
    const g4 = scopeForGrade(4);
    for (const k of g3.keysMajor) expect(g4.keysMajor).toContain(k);
    for (const k of g3.keysMinor) expect(g4.keysMinor).toContain(k);
  });
});

describe('keyAccidentals round-trip — every grade-1..4 tonic is emitter-safe (invariant: no scope key can reach the emitter and explode)', () => {
  test('every keysMajor tonic at grades 1–4 resolves without throwing — including the 5-flat/5-sharp G4 keys B/Db', () => {
    for (const grade of [1, 2, 3, 4] as const) {
      for (const tonic of scopeForGrade(grade).keysMajor) {
        expect(() => keyAccidentals(`${tonic}_major`)).not.toThrow();
      }
    }
  });

  test('every keysMinor tonic at grades 2–4 resolves without throwing — including F#/C# (D5) and the G4 keys Bb/G#', () => {
    for (const grade of [2, 3, 4] as const) {
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
    expect(g3.timeSignatures).toEqual(['2/4', '3/4', '4/4', '2/2', '3/2', '4/2', '3/8', '6/8', '9/8', '12/8']);
  });

  // Grade 2 opens the minim-beat metres and 3/8; grade 3 adds the compound trio.
  test('renderableTimeSignatures widens at grade 2, then again at grade 3', () => {
    expect(renderableTimeSignatures(1)).toEqual(['2/4', '3/4', '4/4']);
    expect(renderableTimeSignatures(2)).toEqual(['2/4', '3/4', '4/4', '2/2', '3/2', '4/2', '3/8']);
    expect(renderableTimeSignatures(3)).toEqual([...['2/4', '3/4', '4/4', '2/2', '3/2', '4/2', '3/8'], '6/8', '9/8', '12/8']);
  });

  test('grade-1 and grade-2 scope objects are byte-identical to their pre-grade-3 values (additive-only)', () => {
    expect(scopeForGrade(1)).toEqual({
      clefs: ['treble', 'bass'],
      noteValues: ['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver'],
      rests: ['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver'],
      keysMajor: ['C', 'G', 'D', 'F'],
      keysMinor: [],
      minorForms: [],
      timeSignatures: ['2/4', '3/4', '4/4'],
      rhythmDevices: ['tie', 'single_dot'],
      intervalRule: { aboveTonicOnly: true, namingStyle: 'number', maxOctaves: 1 },
      pitchRanges: {
        // chromaticly-tqg.5 narrowed both by one position: A5 and E2 are ledger
        // lines, and grade 1's ledger allowance is middle C only.
        treble: { low: 'C4', high: 'G5' },
        bass: { low: 'F2', high: 'D4' },
        // alto is the grade-4 clef (fyu.5) and tenor the grade-5 one
        // (chromaticly-e3z.7); both are required by the exhaustive Record<Clef>
        // but neither is ever read at grade 1, whose clefs exclude them.
        alto: { low: 'G2', high: 'F5' },
        tenor: { low: 'E2', high: 'D5' },
      },
    });
    expect(scopeForGrade(2)).toEqual({
      clefs: ['treble', 'bass'],
      noteValues: ['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver'],
      rests: ['semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver'],
      keysMajor: ['C', 'G', 'D', 'F', 'A', 'Bb', 'Eb'],
      keysMinor: ['A', 'E', 'D'],
      minorForms: ['harmonic'],
      timeSignatures: ['2/4', '3/4', '4/4', '2/2', '3/2', '4/2', '3/8'],
      rhythmDevices: ['tie', 'single_dot', 'triplet', 'triplet_with_rests', 'dotted_rests'],
      intervalRule: { aboveTonicOnly: true, namingStyle: 'number', maxOctaves: 1 },
      pitchRanges: {
        treble: { low: 'A3', high: 'C6' },
        bass: { low: 'C2', high: 'E4' },
        alto: { low: 'G2', high: 'F5' },
        tenor: { low: 'E2', high: 'D5' },
      },
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

  test('grade-1 and grade-2 treble/bass pitchRanges are unchanged by the grade-3 widening', () => {
    // Asserts treble/bass specifically (not the whole object) — the alto key
    // added for Grade 4 (fyu.5) is a grade-4-only clef and must not be read as
    // a change to the grade-1/2 treble/bass reading bounds this guards.
    expect(GRADE_SCOPES[1].pitchRanges.treble).toEqual({ low: 'C4', high: 'G5' });
    expect(GRADE_SCOPES[1].pitchRanges.bass).toEqual({ low: 'F2', high: 'D4' });
    expect(GRADE_SCOPES[2].pitchRanges.treble).toEqual({ low: 'A3', high: 'C6' });
    expect(GRADE_SCOPES[2].pitchRanges.bass).toEqual({ low: 'C2', high: 'E4' });
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

// Grade 0 (First steps, chromaticly-dhe). The narrowest scope in the file, and
// deliberately hand-written rather than derived from grade 1: it is a SUBSET, so
// a spread would widen it every time grade 1 grows.
describe('grade 0 — the First steps scope', () => {
  test('is narrower than grade 1 on every axis First steps teaches', () => {
    const scope = scopeForGrade(0);
    expect(scope.clefs).toEqual(['treble']);
    expect(scope.noteValues).toEqual(['semibreve', 'minim', 'crotchet', 'quaver']);
    expect(scope.rests).toEqual(['semibreve', 'minim', 'crotchet', 'quaver']);
    expect(scope.keysMajor).toEqual(['C']);
    expect(scope.keysMinor).toEqual([]);
    expect(scope.minorForms).toEqual([]);
    expect(scope.timeSignatures).toEqual(['4/4']);
    expect(scope.rhythmDevices).toEqual([]);
  });

  // The pair is what atom validation reads (scope AND renderable), so the
  // intersection is the real answer — renderableTimeSignatures(0) is the wider side.
  test('only 4/4 survives the scope-and-renderable intersection', () => {
    const renderable = renderableTimeSignatures(0);
    expect(scopeForGrade(0).timeSignatures.filter((s) => renderable.includes(s))).toEqual(['4/4']);
  });

  test('the treble reading range is the stave plus middle C, with no ledger lines above', () => {
    const pitches = diatonicPitchesInRange('treble', 0);
    expect(pitches).toContain('C4'); // one ledger line below — the landmark lesson 4 teaches
    expect(pitches).toContain('G5'); // top line
    expect(pitches).not.toContain('A5'); // the space above the stave: grade 1's bound, not grade 0's
    expect(pitches).not.toContain('B3'); // below middle C
  });

  test('comfortablePitchRange does not widen grade 0 — Math.min(0, 2) is 0', () => {
    expect(comfortablePitchRange('treble', 0)).toEqual(pitchRange('treble', 0));
  });

  // The guard is a lookup miss, not a range check. Widening the literal type to
  // include 0 must not turn an unsupported grade into a silent undefined.
  test('an unsupported grade still throws', () => {
    expect(() => scopeForGrade(-1)).toThrow('scope: grade -1 is not supported');
    expect(() => scopeForGrade(6)).toThrow('scope: grade 6 is not supported');
  });

  test('grades 1-5 are untouched by the widening', () => {
    for (const grade of [1, 2, 3, 4, 5] as const) {
      expect(scopeForGrade(grade)).toBe(GRADE_SCOPES[grade]);
    }
    expect(scopeForGrade(1).clefs).toEqual(['treble', 'bass']);
    expect(scopeForGrade(1).timeSignatures).toEqual(['2/4', '3/4', '4/4']);
  });
});
