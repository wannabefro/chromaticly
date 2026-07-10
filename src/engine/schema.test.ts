import { ExerciseInstanceSchema } from './schema';

function wellFormedInstance() {
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000000',
    template_id: 'note_naming_treble_v1',
    grade: 1,
    strand: 'pitch' as const,
    unit: '1.2',
    prompt: 'Name this note.',
    stimulus: {
      music: { clef: 'treble', key_sig: null, voices: [] },
      text: null,
    },
    interaction: {
      type: 'mcq' as const,
      config: { choices: ['C4', 'D4', 'E4'] },
    },
    answer: {
      canonical: 'C4',
      accepted_alternatives: ['middle_c'],
      per_item: [],
    },
    distractors: ['D4', 'E4'],
    hints: ['It sits on a ledger line below the treble stave.'],
    feedback: {
      correct: 'Correct — that is middle C.',
      incorrect: 'Not quite — count the ledger lines from the stave.',
    },
    srs_tags: ['note_read:treble:C4'],
    kb_version: 'g1-2026-07-10',
  };
}

describe('ExerciseInstanceSchema — well-formed instances', () => {
  test('a fully-populated note-naming instance parses successfully', () => {
    const result = ExerciseInstanceSchema.safeParse(wellFormedInstance());
    expect(result.success).toBe(true);
  });

  test('.parse() does not throw on a well-formed instance', () => {
    expect(() => ExerciseInstanceSchema.parse(wellFormedInstance())).not.toThrow();
  });
});

describe('ExerciseInstanceSchema — required fields reject malformed instances', () => {
  test('omitting the answer.canonical key entirely fails validation (canonical is required, not optional)', () => {
    const instance = wellFormedInstance() as any;
    delete instance.answer.canonical;
    const result = ExerciseInstanceSchema.safeParse(instance);
    expect(result.success).toBe(false);
  });

  test('omitting kb_version entirely fails validation', () => {
    const instance = wellFormedInstance() as any;
    delete instance.kb_version;
    const result = ExerciseInstanceSchema.safeParse(instance);
    expect(result.success).toBe(false);
  });
});
