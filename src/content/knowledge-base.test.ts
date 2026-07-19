import { KB, KB_VERSION } from './knowledge-base';

describe('knowledge-base.ts — KTD7 load-time validation', () => {
  test('the real curriculum/knowledge-base.json parses against the schema without throwing', () => {
    // Importing the module already ran KnowledgeBaseSchema.parse(); if that
    // failed, module import above would have thrown before this test runs.
    expect(KB).toBeDefined();
    expect(KB.grade1).toBeDefined();
    expect(KB.grade2Adds).toBeDefined();
  });

  test('KB_VERSION is a non-empty string anchor', () => {
    expect(typeof KB_VERSION).toBe('string');
    expect(KB_VERSION.length).toBeGreaterThan(0);
  });

  // KB_VERSION is stamped into the kb_version field of every pinned
  // seed-stability snapshot instance (~400 keys). This slice edits KB content
  // (melodic_minor_desc, grade-3 adds) without touching what any existing
  // generator reads, so the anchor must NOT bump — an accidental bump would
  // silently churn the entire seed-stability snapshot instead of failing loud
  // here.
  test('KB_VERSION stays pinned at g1-2026-07-10 — this slice does not bump it', () => {
    expect(KB_VERSION).toBe('g1-2026-07-10');
  });
});

describe('knowledge-base.ts — note-value table matches G1 theory data', () => {
  test('semibreve, minim, crotchet, quaver, semiquaver are present with correct beats_in_crotchets', () => {
    expect(KB.noteValues.semibreve.beats_in_crotchets).toBe(4);
    expect(KB.noteValues.minim.beats_in_crotchets).toBe(2);
    expect(KB.noteValues.crotchet.beats_in_crotchets).toBe(1);
    expect(KB.noteValues.quaver.beats_in_crotchets).toBe(0.5);
    expect(KB.noteValues.semiquaver.beats_in_crotchets).toBe(0.25);
  });
});

describe('knowledge-base.ts — grade_scopes["1"] scope is law', () => {
  test('only C, G, D, F major keys are in the G1 scope, and no minor keys', () => {
    expect(KB.grade1.keys_major).toEqual(['C', 'G', 'D', 'F']);
    expect(KB.grade1.keys_minor).toEqual([]);
  });
});

describe('knowledge-base.ts — grade_scopes["2"].adds is reachable (Codex finding #1)', () => {
  test('grade-2 adds carry the additive keys/time-signatures/rhythm-devices the U2 scope table composes from', () => {
    expect(KB.grade2Adds.keys_major).toEqual(['A', 'Bb', 'Eb']);
    expect(KB.grade2Adds.keys_minor).toEqual(['A', 'E', 'D']);
    expect(KB.grade2Adds.minor_forms).toEqual(['harmonic']);
    expect(KB.grade2Adds.time_signatures).toEqual(['2/2', '3/2', '4/2']);
    expect(KB.grade2Adds.rhythm_devices).toEqual(['triplet', 'triplet_with_rests', 'dotted_rests']);
  });
});

describe('knowledge-base.ts — key_signatures is the single fifths-count source (D5)', () => {
  test('majors and minors carry the fifths-count for every G1/G2 tonic', () => {
    expect(KB.keySignatures.majors.C).toBe(0);
    expect(KB.keySignatures.majors.G).toBe(1);
    expect(KB.keySignatures.majors.D).toBe(2);
    expect(KB.keySignatures.majors.F).toBe(-1);
    expect(KB.keySignatures.majors.Bb).toBe(-2);
    expect(KB.keySignatures.majors.Eb).toBe(-3);
    expect(KB.keySignatures.minors.A).toBe(0);
    expect(KB.keySignatures.minors.E).toBe(1);
    expect(KB.keySignatures.minors.D).toBe(-1);
  });

  test('sharp_order and flat_order are present and canonically ordered', () => {
    expect(KB.keySignatures.sharp_order).toEqual(['F#', 'C#', 'G#', 'D#', 'A#', 'E#']);
    expect(KB.keySignatures.flat_order).toEqual(['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);
  });
});

describe('knowledge-base.ts — scale_patterns carries the letter-walkable T/S interval arrays', () => {
  test('major, harmonic_minor, melodic_minor_asc parse as T/S arrays', () => {
    expect(KB.scalePatterns.major).toEqual(['T', 'T', 'S', 'T', 'T', 'T', 'S']);
    expect(KB.scalePatterns.harmonic_minor).toEqual(['T', 'S', 'T', 'T', 'S', 'T+S', 'S']);
    expect(KB.scalePatterns.melodic_minor_asc).toEqual(['T', 'S', 'T', 'T', 'T', 'T', 'S']);
  });

  // melodic_minor_desc's pitch content IS natural minor (the descending
  // melodic form reverts). If someone "corrects" this to the ascending
  // pattern, the descent stops reverting to natural minor and this fails.
  test('melodic_minor_desc equals the natural-minor T/S walk, not the ascending-melodic pattern', () => {
    expect(KB.scalePatterns.melodic_minor_desc).toEqual(['T', 'S', 'T', 'T', 'S', 'T', 'T']);
  });
});

describe('knowledge-base.ts — grade_scopes["3"].adds is reachable', () => {
  // KB.grade3Adds is the single source the U2 scope table is cross-checked
  // against; a drift here silently desyncs the scope table from the KB.
  test('grade-3 adds carry the melodic-minor keys/forms this slice consumes', () => {
    expect(KB.grade3Adds.keys_major).toEqual(['E', 'Ab']);
    expect(KB.grade3Adds.keys_minor).toEqual(['B', 'G', 'F#', 'C', 'C#', 'F']);
    expect(KB.grade3Adds.minor_forms).toEqual(['melodic']);
  });
});
