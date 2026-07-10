import type { ExerciseInstance } from './schema';
import { validate } from './validator';

function validNoteNamingInstance(): ExerciseInstance {
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000000',
    template_id: 'note_naming',
    grade: 1,
    strand: 'pitch',
    prompt: 'Write the name of this note.',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: null,
        time_sig: null,
        voices: [{ events: [{ type: 'note', pitch: 'E4', dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: 'E', accepted_alternatives: [] },
    distractors: ['D', 'F', 'G'],
    hints: ['Count the lines and spaces from the treble clef.'],
    feedback: { correct: 'Correct!', incorrect: 'Not quite — check the stave position.' },
    srs_tags: ['note_read:treble:E4'],
    kb_version: 'g1-2026-07-10',
  };
}

function validIntervalNamingInstance(): ExerciseInstance {
  return {
    id: 'b2c3d4e5-0000-0000-0000-000000000000',
    template_id: 'interval_naming',
    grade: 1,
    strand: 'intervals',
    prompt: 'Name this interval (number only).',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: 'C_major',
        time_sig: null,
        voices: [{ events: [{ type: 'chord', pitches: ['C4', 'G4'], dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: 5, accepted_alternatives: [] },
    distractors: [4, 6],
    hints: ['Count the letter names from the lower note up to the higher note, inclusive.'],
    feedback: { correct: 'Correct!', incorrect: 'Not quite — recount inclusively.' },
    srs_tags: ['interval:C_major:5'],
    kb_version: 'g1-2026-07-10',
  };
}

describe('validate — structural check (schema failure is a rejection)', () => {
  test('an instance missing kb_version fails validation with a schema error', () => {
    const instance = validNoteNamingInstance() as unknown as Record<string, unknown>;
    delete instance.kb_version;
    const result = validate(instance as unknown as ExerciseInstance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.startsWith('schema:'))).toBe(true);
  });
});

describe('validate — commandment 1 (scope is law)', () => {
  test('a pitch outside the G1 treble range (B5, above the A5 ceiling) is rejected', () => {
    const instance = validNoteNamingInstance();
    (instance.stimulus.music as any).voices[0].events[0].pitch = 'B5';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('outside the G1 range'))).toBe(true);
  });

  test('a key signature outside G1 (E major is not one of C/G/D/F) is rejected', () => {
    const instance = validNoteNamingInstance();
    (instance.stimulus.music as any).key_sig = 'E_major';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('key signature'))).toBe(true);
  });

  test('a double-sharp pitch is rejected — G1 allows only a natural or single sharp/flat', () => {
    const instance = validNoteNamingInstance();
    (instance.stimulus.music as any).voices[0].events[0].pitch = 'F##4';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('double accidental'))).toBe(true);
  });

  test('a double-flat pitch is rejected — G1 allows only a natural or single sharp/flat', () => {
    const instance = validNoteNamingInstance();
    (instance.stimulus.music as any).voices[0].events[0].pitch = 'Gbb4';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('double accidental'))).toBe(true);
  });
});

describe('validate — commandments 3/4 (diagnostic distractors, one defensible answer)', () => {
  test('a closed item whose distractor deep-equals the canonical answer is rejected', () => {
    const instance = validNoteNamingInstance();
    instance.distractors = ['E', 'F', 'G'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('not exactly one defensible answer'))).toBe(true);
  });

  test('a closed item with duplicate distractors is rejected', () => {
    const instance = validNoteNamingInstance();
    instance.distractors = ['D', 'D', 'G'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate distractors'))).toBe(true);
  });

  test('a closed item with no distractors is rejected', () => {
    const instance = validNoteNamingInstance();
    instance.distractors = [];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('no distractors'))).toBe(true);
  });
});

describe('validate — a valid instance passes clean', () => {
  test('a well-formed, in-scope note_naming instance has ok: true and no errors', () => {
    const result = validate(validNoteNamingInstance());
    expect(result).toEqual({ ok: true, errors: [] });
  });
});

describe('validate — per-template hook: interval_naming', () => {
  test('an interval number outside 1..8 is rejected', () => {
    const instance = validIntervalNamingInstance();
    instance.answer.canonical = 9;
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('interval_naming'))).toBe(true);
  });

  test('a well-formed interval_naming instance passes clean', () => {
    const result = validate(validIntervalNamingInstance());
    expect(result.ok).toBe(true);
  });
});
