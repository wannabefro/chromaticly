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

function validKeySignatureIdInstance(grade: 1 | 2 = 1): ExerciseInstance {
  const key = grade === 1 ? 'G' : 'A';
  const distractors = grade === 1 ? ['C major', 'D major'] : ['C major', 'Bb major'];
  const musicFor = (k: string) => ({
    clef: 'treble',
    key_sig: `${k}_major`,
    time_sig: null,
    voices: [{ events: [{ type: 'note', pitch: `${k}4`, dur: 'semibreve' }] }],
  });
  return {
    id: 'c3d4e5f6-0000-0000-0000-000000000000',
    template_id: 'key_signature_id',
    grade,
    strand: 'scales_keys',
    prompt: 'Name this key.',
    stimulus: { music: musicFor(key), text: null },
    interaction: { type: 'mcq', config: { option_music: { [`${key} major`]: musicFor(key) } } },
    answer: { canonical: `${key} major`, accepted_alternatives: [] },
    distractors,
    hints: ['Count the sharps or flats on the stave and match them to a key you know.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — recount the sharps or flats and their order on the stave.',
    },
    srs_tags: [`key_sig:${key}_major`],
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

  test.each(['Cb4', 'Fb2', 'B#4', 'E#5'])(
    'the never-Grade-1 spelling %s (enharmonic of a natural) is rejected',
    (pitch) => {
      const instance = validNoteNamingInstance();
      (instance.stimulus.music as any).voices[0].events[0].pitch = pitch;
      const result = validate(instance);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('spells a natural'))).toBe(true);
    },
  );

  test('the guard is narrow: valid enharmonic spellings outside the G1 atom set (Eb4, Ab3) are NOT rejected by it', () => {
    // Eb/Ab are legitimate note spellings, just not Grade 1 curriculum content;
    // a full per-pitch allowlist is deferred, so the narrow guard must not flag them.
    for (const pitch of ['Eb4', 'Ab3']) {
      const instance = validNoteNamingInstance();
      (instance.stimulus.music as any).voices[0].events[0].pitch = pitch;
      const errors = validate(instance).errors;
      expect(errors.some((e) => e.includes('spells a natural'))).toBe(false);
    }
  });

  test('the real Grade 1 curriculum accidentals (F#5, C#5, Bb4) pass the guard', () => {
    for (const pitch of ['F#5', 'C#5', 'Bb4']) {
      const instance = validNoteNamingInstance();
      (instance.stimulus.music as any).voices[0].events[0].pitch = pitch;
      const errors = validate(instance).errors;
      expect(errors.some((e) => e.includes('spells a natural'))).toBe(false);
    }
  });
});

describe('validate — grade-aware scope (D5: scope is law, per grade)', () => {
  test('time_sig 2/2 is outside G1 scope but inside G2 scope', () => {
    const instance = validNoteNamingInstance();
    (instance.stimulus.music as any).time_sig = '2/2';

    expect(validate(instance).ok).toBe(false);

    instance.grade = 2;
    expect(validate(instance).ok).toBe(true);
  });

  test('key_sig A_major is outside G1 scope but inside G2 scope', () => {
    const instance = validNoteNamingInstance();
    (instance.stimulus.music as any).key_sig = 'A_major';

    expect(validate(instance).ok).toBe(false);

    instance.grade = 2;
    expect(validate(instance).ok).toBe(true);
  });

  test('key_sig Eb_major is outside G1 scope but inside G2 scope', () => {
    const instance = validNoteNamingInstance();
    (instance.stimulus.music as any).key_sig = 'Eb_major';

    expect(validate(instance).ok).toBe(false);

    instance.grade = 2;
    expect(validate(instance).ok).toBe(true);
  });

  test('a treble C6 pitch is outside the G1 range but inside the G2 range', () => {
    const instance = validNoteNamingInstance();
    (instance.stimulus.music as any).voices[0].events[0].pitch = 'C6';

    expect(validate(instance).ok).toBe(false);

    instance.grade = 2;
    expect(validate(instance).ok).toBe(true);
  });

  test('key_sig A_minor is rejected at G1 (no minors in scope) but accepted at G2', () => {
    const instance = validNoteNamingInstance();
    (instance.stimulus.music as any).key_sig = 'A_minor';

    expect(validate(instance).ok).toBe(false);

    instance.grade = 2;
    expect(validate(instance).ok).toBe(true);
  });

  test('key_sig B_minor is rejected at both G1 and G2 — B is not a G2 minor tonic', () => {
    const instance = validNoteNamingInstance();
    (instance.stimulus.music as any).key_sig = 'B_minor';

    expect(validate(instance).ok).toBe(false);

    instance.grade = 2;
    expect(validate(instance).ok).toBe(false);
  });

  test('a G2 instance with a dur outside the (unchanged) note-value list is still rejected', () => {
    const instance = validNoteNamingInstance();
    instance.grade = 2;
    (instance.stimulus.music as any).voices[0].events[0].dur = 'hemidemisemiquaver';

    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('note value'))).toBe(true);
  });

  test('an unsupported grade (3) fails validation cleanly instead of throwing', () => {
    const instance = validNoteNamingInstance();
    instance.grade = 3;

    expect(() => validate(instance)).not.toThrow();
    expect(validate(instance)).toEqual({ ok: false, errors: ['scope: grade 3 is not supported'] });
  });

  test('a Cb-spelled pitch (spells a natural) is still rejected at G2', () => {
    const instance = validNoteNamingInstance();
    instance.grade = 2;
    (instance.stimulus.music as any).voices[0].events[0].pitch = 'Cb4';

    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('spells a natural'))).toBe(true);
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

// D10 (review finding 2): a bare key signature is ambiguous between its
// relative major and minor (A minor and C major share one signature), so
// key_signature_id must refuse a minor canonical/distractor at the validator
// layer too — defence in depth alongside the generator's own atom guard
// (key-signature-id.test.ts).
describe('validate — per-template hook: key_signature_id (D10 minor-key rejection)', () => {
  test('a canonical answer naming a minor key ("A minor") is rejected at grade 2, with an error naming the minor-key rejection', () => {
    const instance = validKeySignatureIdInstance(2);
    instance.answer.canonical = 'A minor';
    // The scope-is-law pitch/key-sig check only inspects stimulus.music, which
    // still names A major here — this assertion is purely about the semantic
    // canonical string the hook reads, so leave stimulus.music untouched.
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('key_signature_id') && /minor/i.test(e))).toBe(true);
  });

  test('a distractor naming a minor key is rejected even when the canonical is a valid major key', () => {
    const instance = validKeySignatureIdInstance(2);
    instance.distractors = ['C major', 'D minor'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('key_signature_id') && /minor/i.test(e))).toBe(true);
  });

  test('characterization: existing valid MAJOR key_signature_id instances at grade 1 and grade 2 still validate — the tightening removes only the ambiguous minor case', () => {
    expect(validate(validKeySignatureIdInstance(1))).toEqual({ ok: true, errors: [] });
    expect(validate(validKeySignatureIdInstance(2))).toEqual({ ok: true, errors: [] });
  });
});
