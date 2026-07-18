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
