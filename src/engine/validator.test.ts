import type { ExerciseInstance } from './schema';
import { ExerciseInstanceSchema } from './schema';
import { generate } from './generators';
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

function scaleMusic(tonic: string, pitches: string[]) {
  return {
    clef: 'treble',
    key_sig: `${tonic}_minor`,
    time_sig: null,
    voices: [{ events: pitches.map((pitch) => ({ type: 'note', pitch, dur: 'crotchet' })) }],
  };
}

function validScaleConstructionInstance(): ExerciseInstance {
  const trueScale = ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G#5', 'A5'];
  const corruptedScale = [...trueScale];
  corruptedScale[6] = 'G5'; // un-raised 7th
  return {
    id: 'd4e5f6a7-0000-0000-0000-000000000000',
    template_id: 'scale_construction',
    grade: 2,
    strand: 'scales_keys',
    prompt: 'One note of this A harmonic minor scale is wrong — which one?',
    stimulus: { music: scaleMusic('A', corruptedScale), text: null },
    interaction: { type: 'mcq', config: { answer_music: scaleMusic('A', trueScale) } },
    answer: { canonical: '7th note', accepted_alternatives: [] },
    distractors: ['6th note', '3rd note'],
    hints: ['Compare each note against the A harmonic minor scale — only one note is wrong.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Harmonic minor raises the 7th note a semitone above the key signature.',
    },
    srs_tags: ['scale:A_minor_harmonic'],
    kb_version: 'g1-2026-07-10',
  };
}

// D3(c)/D5: a sharp-tonic harmonic instance (F# minor, grade 3) — the raised
// 7th spells E#, never F-natural's enharmonic. Verified against minorScale/
// scale_construction's own generator output (scale-construction.test.ts).
function validScaleConstructionGrade3HarmonicInstance(): ExerciseInstance {
  const trueScale = ['F#4', 'G#4', 'A4', 'B4', 'C#5', 'D5', 'E#5', 'F#5'];
  const corruptedScale = [...trueScale];
  corruptedScale[6] = 'E5'; // un-raised 7th
  return {
    id: 'e5f6a7b8-0000-0000-0000-000000000001',
    template_id: 'scale_construction',
    grade: 3,
    strand: 'scales_keys',
    prompt: 'One note of this F# harmonic minor scale is wrong — which one?',
    stimulus: { music: scaleMusic('F#', corruptedScale), text: null },
    interaction: { type: 'mcq', config: { answer_music: scaleMusic('F#', trueScale) } },
    answer: { canonical: '7th note', accepted_alternatives: [] },
    distractors: ['6th note', '3rd note'],
    hints: ['Compare each note against the F# harmonic minor scale — only one note is wrong.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Harmonic minor raises the 7th note a semitone above the key signature.',
    },
    srs_tags: ['scale:F#_minor_harmonic'],
    kb_version: 'g1-2026-07-10',
  };
}

// D3(c): a DESCENDING melodic instance — 8 notes high->low, ordinals still
// "1st note".."8th note" IN PLAYED ORDER (the 2nd note played is the 7th
// scale degree). The hook itself doesn't care about direction — it just
// counts note events and matches the ordinal regex — so this is the
// "still 8 notes, still 1st..8th" characterization the plan calls for.
function validScaleConstructionGrade3MelodicDescendingInstance(): ExerciseInstance {
  const truePlayed = ['A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4'];
  const corruptedPlayed = ['A5', 'G#5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4']; // raised 7th left in
  return {
    id: 'e5f6a7b8-0000-0000-0000-000000000002',
    template_id: 'scale_construction',
    grade: 3,
    strand: 'scales_keys',
    prompt: 'One note of this A melodic minor scale, descending, is wrong — which one?',
    stimulus: { music: scaleMusic('A', corruptedPlayed), text: null },
    interaction: { type: 'mcq', config: { answer_music: scaleMusic('A', truePlayed) } },
    answer: { canonical: '2nd note', accepted_alternatives: [] },
    distractors: ['3rd note'],
    hints: ['Compare each note against the A melodic minor scale, descending, — only one note is wrong.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Melodic minor lowers the 7th and 6th on the way down — keeping the raised 7th here borrows from the ascending form.',
    },
    srs_tags: ['scale:A_minor_melodic'],
    kb_version: 'g1-2026-07-10',
  };
}

function validIntervalNamingStaveInputInstance(grade: 1 | 2 = 1): ExerciseInstance {
  const key = grade === 1 ? 'G' : 'A';
  const target = grade === 1 ? 'D5' : 'E5';
  return {
    id: 'f6a7b8c9-0000-0000-0000-000000000000',
    template_id: 'interval_naming_stave_input',
    grade,
    strand: 'intervals',
    prompt: 'Write the note a 5th higher than the given note, as a crotchet.',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: `${key}_major`,
        time_sig: null,
        voices: [{ events: [{ type: 'note', pitch: `${key}4`, dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'stave_input', config: {} },
    answer: { canonical: { pitch: target, dur: 'crotchet' }, accepted_alternatives: [] },
    distractors: [],
    hints: ['Count the letter names inclusively from the given note.'],
    feedback: { correct: 'Correct!', incorrect: 'Not quite — recount inclusively.' },
    srs_tags: ['interval:5'],
    kb_version: 'g1-2026-07-10',
  };
}

function validAddTimeSignatureInstance(): ExerciseInstance {
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000001',
    template_id: 'add_time_signature',
    grade: 1,
    strand: 'rhythm',
    prompt: 'Add up the note values in this bar. Which time signature is it in?',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: null,
        time_sig: null,
        voices: [
          {
            events: [
              { type: 'note', pitch: 'C4', dur: 'crotchet' },
              { type: 'note', pitch: 'C4', dur: 'crotchet' },
              { type: 'note', pitch: 'C4', dur: 'crotchet' },
              { type: 'barline', style: 'single' },
            ],
          },
        ],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: '3/4', accepted_alternatives: [] },
    distractors: ['2/4', '4/4'],
    hints: ['Use the note tree to add up the bar, then match the total to a time signature.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — recount the beats in the bar and match the total to a time signature.',
    },
    srs_tags: ['add_time_signature'],
    kb_version: 'g1-2026-07-10',
  };
}

// U5 (D6): a compound instance — hidden signature (D5), family-scoped
// distractors, the parameterized SRS atom (R4).
function validCompoundAddTimeSignatureInstance(): ExerciseInstance {
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000002',
    template_id: 'add_time_signature',
    grade: 3,
    strand: 'rhythm',
    prompt: 'Count the dotted-crotchet beats in this bar. Which time signature is it in?',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: null,
        time_sig: '6/8',
        time_sig_hidden: true,
        voices: [
          {
            events: [
              { type: 'note', pitch: 'C4', dur: 'crotchet', dots: 1 },
              { type: 'note', pitch: 'C4', dur: 'crotchet', dots: 1 },
              { type: 'barline', style: 'single' },
            ],
          },
        ],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: '6/8', accepted_alternatives: [] },
    distractors: ['9/8', '12/8'],
    hints: ['Count the dotted-crotchet beats in the bar, then match the total to a compound time signature.'],
    feedback: {
      correct: 'Correct!',
      incorrect:
        'Not quite — recount the dotted-crotchet beats in the bar and match the total to a compound time signature.',
    },
    srs_tags: ['add_time_signature:6/8'],
    kb_version: 'g1-2026-07-10',
  };
}

// U6 (D7/D8): a metre_classification instance — signature PRINTED (not
// hidden, unlike add_time_signature), combined simple/compound x
// duple/triple/quadruple label as the answer.
function validMetreClassificationInstance(): ExerciseInstance {
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000003',
    template_id: 'metre_classification',
    grade: 3,
    strand: 'rhythm',
    prompt: 'Which describes this time signature?',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: null,
        time_sig: '6/8',
        voices: [
          {
            events: [
              { type: 'note', pitch: 'C4', dur: 'crotchet', dots: 1 },
              { type: 'note', pitch: 'C4', dur: 'crotchet', dots: 1 },
              { type: 'barline', style: 'single' },
            ],
          },
        ],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: 'Compound duple', accepted_alternatives: [] },
    distractors: ['Simple duple', 'Compound triple'],
    hints: ['Check the beaming first: notes grouped in threes are compound, in twos or fours are simple.'],
    feedback: {
      correct: 'Correct!',
      incorrect:
        'Check two things: does each beat split into two (simple) or three (compound), and how many beats are in the bar?',
    },
    srs_tags: ['metre:6/8'],
    kb_version: 'g1-2026-07-10',
  };
}

// U3 (anacrusis slice, D7): a well-formed 3/4 anacrusis instance — a 1-beat
// pickup, two full middle bars, and a 2-beat closing bar (1 + 2 = one whole
// bar, the ABRSM rule). No trailing barline (Codex correction 2).
function validAnacrusisRecognitionInstance(): ExerciseInstance {
  const crotchet = (pitch: string) => ({ type: 'note' as const, pitch, dur: 'crotchet' as const });
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000004',
    template_id: 'anacrusis_recognition',
    grade: 3,
    strand: 'rhythm',
    prompt: 'How many beats are in the upbeat (anacrusis)?',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: null,
        time_sig: '3/4',
        anacrusis: true,
        voices: [
          {
            events: [
              crotchet('C4'),
              { type: 'barline', style: 'single' },
              crotchet('C4'),
              crotchet('C4'),
              crotchet('C4'),
              { type: 'barline', style: 'single' },
              crotchet('C4'),
              crotchet('C4'),
              crotchet('C4'),
              { type: 'barline', style: 'single' },
              crotchet('C4'),
              crotchet('C4'),
            ],
          },
        ],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: '1 beat', accepted_alternatives: [] },
    distractors: ['3 beats', '0 beats'],
    hints: ['Count backwards from the first barline to find how many beats the upbeat takes.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Count the beats before the first barline — the last bar makes up the difference to a full bar.',
    },
    srs_tags: ['anacrusis:3/4'],
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
    // The signature flattens the E the stimulus draws, so the answer must too.
    instance.answer.canonical = 'E flat';

    expect(validate(instance).ok).toBe(false);

    instance.grade = 2;
    expect(validate(instance).ok).toBe(true);
  });

  test('a treble C6 pitch is outside the G1 range but inside the G2 range', () => {
    const instance = validNoteNamingInstance();
    (instance.stimulus.music as any).voices[0].events[0].pitch = 'C6';
    instance.answer.canonical = 'C';

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

  test('a grade above the supported ceiling (6 — grade 5 is now the max, chromaticly-ehp) fails validation cleanly instead of throwing', () => {
    // Grade 5 is now both schema-valid and scope-supported, so the old
    // "schema-valid but scope-unsupported" gap no longer exists. Grade 6 is now
    // rejected at the schema layer (max grade 5) — the invariant that matters is
    // that an out-of-range grade fails cleanly rather than throwing.
    const instance = validNoteNamingInstance();
    instance.grade = 6;

    expect(() => validate(instance)).not.toThrow();
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('grade') && e.includes('5'))).toBe(true);
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

// D6: NEVER_SPELLINGS_THROUGH_G2 splits by grade. B#/E# are C#/F# minor's
// raised-7th spelling (required at Grade 3, D5) and become legal there ONLY —
// grades 1-2 keep rejecting them, byte-identical to the pre-D6 message
// (review finding 3 characterization).
describe('validate — grade-aware never-spellings (D6): B#/E# become legal at grade 3 only', () => {
  test.each(['B#4', 'E#5'])(
    'the pitch %s validates cleanly at grade 3 but fails naming the never-spelling at grade 2, with the message unchanged',
    (pitch) => {
      const instance = validNoteNamingInstance();
      (instance.stimulus.music as any).voices[0].events[0].pitch = pitch;
      instance.answer.canonical = `${pitch[0]} sharp`;

      instance.grade = 3;
      expect(validate(instance)).toEqual({ ok: true, errors: [] });

      instance.grade = 2;
      const g2 = validate(instance);
      expect(g2.ok).toBe(false);
      expect(g2.errors).toContain(`scope: pitch "${pitch}" spells a natural (never used at Grade 1)`);
    },
  );

  test('Cb/Fb stay rejected at grade 3 — only B#/E# were admitted, not the whole never-spellings set', () => {
    for (const pitch of ['Cb4', 'Fb2']) {
      const instance = validNoteNamingInstance();
      instance.grade = 3;
      (instance.stimulus.music as any).voices[0].events[0].pitch = pitch;
      const result = validate(instance);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('spells a natural'))).toBe(true);
    }
  });

  // Cb arrives with the six-flat keys: it is the 4th of Gb major and the 6th of
  // Eb minor. The boundary itself is tested, not a value near it — grade 4 must
  // still reject it, or "admitted at grade 5" is only proven at one end.
  test.each([
    [4, false],
    [5, true],
  ])('Cb is rejected at grade %i: accepted=%s', (grade, accepted) => {
    const instance = validNoteNamingInstance();
    instance.grade = grade;
    (instance.stimulus.music as any).voices[0].events[0].pitch = 'Cb4';
    expect(validate(instance).errors.some((e) => e.includes('spells a natural'))).toBe(!accepted);
  });

  // Fb is the one that never becomes legal. It first appears at seven flats — Cb
  // major and Ab minor — which this course does not reach.
  test.each([1, 3, 5])('Fb stays rejected at grade %i', (grade) => {
    const instance = validNoteNamingInstance();
    instance.grade = grade;
    (instance.stimulus.music as any).voices[0].events[0].pitch = 'Fb2';
    expect(validate(instance).errors.some((e) => e.includes('spells a natural'))).toBe(true);
  });

  test('a double-accidental pitch is still rejected at grade 3 — D6 only touches the never-spellings set', () => {
    const instance = validNoteNamingInstance();
    instance.grade = 3;
    (instance.stimulus.music as any).voices[0].events[0].pitch = 'F##4';
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

// U3 (plan 2026-07-20-002), Codex R6: the grade-3 mcq's canonical is a string
// LABEL, not a bare number — the hook must independently RECOMPUTE
// {number, quality} from the stimulus chord and never trust the label itself,
// or a generator bug that emits a well-formed-but-wrong label would slip
// through unnoticed.
function validIntervalNamingGrade3Instance(): ExerciseInstance {
  return {
    id: 'f1a2b3c4-0000-0000-0000-000000000000',
    template_id: 'interval_naming',
    grade: 3,
    strand: 'intervals',
    prompt: 'Name this interval (number and type).',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: 'C_major',
        time_sig: null,
        voices: [{ events: [{ type: 'chord', pitches: ['C4', 'E4'], dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: 'major 3rd', accepted_alternatives: [] },
    distractors: ['perfect 4th', 'major 6th'],
    hints: ['Count the letter names for the number, then check the key signature for the type.'],
    feedback: { correct: 'Correct!', incorrect: 'Not quite — recheck the number and the type.' },
    srs_tags: ['interval_type:3'],
    kb_version: 'g1-2026-07-10',
  };
}

describe('validate — per-template hook: interval_naming grade 3 (D5/D6, Codex R6 — recompute, never trust the label)', () => {
  test('a well-formed grade-3 interval_naming instance passes clean', () => {
    expect(validate(validIntervalNamingGrade3Instance())).toEqual({ ok: true, errors: [] });
  });

  test('canonical "major 2nd" for a C4->E4 (major 3rd) stimulus is REJECTED — the NUMBER is recomputed from the chord, not trusted from the label', () => {
    const instance = validIntervalNamingGrade3Instance();
    instance.answer.canonical = 'major 2nd';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('interval_naming'))).toBe(true);
  });

  test('canonical "minor 3rd" for a C4->E4 (major 3rd) stimulus is REJECTED — the QUALITY is recomputed, not trusted from the label', () => {
    const instance = validIntervalNamingGrade3Instance();
    instance.answer.canonical = 'minor 3rd';
    const result = validate(instance);
    expect(result.ok).toBe(false);
  });

  test('an out-of-vocabulary canonical "diminished 5th" is REJECTED — no augmented/diminished in grade-3 scope', () => {
    const instance = validIntervalNamingGrade3Instance();
    instance.answer.canonical = 'diminished 5th';
    const result = validate(instance);
    expect(result.ok).toBe(false);
  });

  test('a distractor "major 5th" (an out-of-vocabulary quality/number pairing) is REJECTED', () => {
    const instance = validIntervalNamingGrade3Instance();
    instance.distractors = ['major 5th', 'perfect 4th'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
  });
});

// Review finding 3: checkPitchScope has two call sites — checkScope AND
// intervalNamingHook's stave_input branch. This block characterizes both:
// existing valid grade-1/2 instances (mcq AND stave_input) must still
// validate unchanged after the grade-threading, and the stave_input branch's
// OWN checkPitchScope call must still gate the ≤G2 never-spellings.
describe('validate — per-template hook: interval_naming_stave_input (D6 grade-threading, review finding 3 — the second checkPitchScope call site)', () => {
  test('characterization: well-formed mcq and stave_input interval_naming instances still validate unchanged at grade 1 and grade 2', () => {
    expect(validate(validIntervalNamingInstance())).toEqual({ ok: true, errors: [] });
    expect(validate(validIntervalNamingStaveInputInstance(1))).toEqual({ ok: true, errors: [] });
    expect(validate(validIntervalNamingStaveInputInstance(2))).toEqual({ ok: true, errors: [] });
  });

  test('a stave_input canonical pitch spelling E# is rejected at grade 1 and grade 2 via the hook\'s own checkPitchScope call', () => {
    for (const grade of [1, 2] as const) {
      const instance = validIntervalNamingStaveInputInstance(grade);
      (instance.answer.canonical as { pitch: string; dur: string }).pitch = 'E#5';
      const result = validate(instance);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('spells a natural'))).toBe(true);
    }
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

describe('validate — per-template hook: scale_construction (D7 spot-the-wrong-note MCQ)', () => {
  test('a well-formed scale_construction instance passes clean', () => {
    expect(validate(validScaleConstructionInstance())).toEqual({ ok: true, errors: [] });
  });

  test('a canonical answer that is not an ordinal note-position string is rejected', () => {
    const instance = validScaleConstructionInstance();
    instance.answer.canonical = 'seventh';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('scale_construction') && e.includes('ordinal'))).toBe(true);
  });

  test('a missing interaction.config.answer_music is rejected', () => {
    const instance = validScaleConstructionInstance();
    instance.interaction.config = {};
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('answer_music is required'))).toBe(true);
  });

  test('an answer_music key signature whose tonic is outside the grade\'s keysMinor is rejected', () => {
    const instance = validScaleConstructionInstance();
    (instance.interaction.config.answer_music as any).key_sig = 'B_minor';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('scale_construction') && e.includes('minor key'))).toBe(true);
  });

  test('a stimulus with fewer than 8 note events is rejected', () => {
    const instance = validScaleConstructionInstance();
    (instance.stimulus.music as any).voices[0].events.pop();
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('exactly 8 note events'))).toBe(true);
  });
});

describe('validate — scale_construction hook is UNCHANGED at grade 3 (D3(c)): still 8 notes, 1st..8th ordinals, answer_music key in scope.keysMinor', () => {
  test('a grade-3 sharp-tonic harmonic instance (F# minor, E# raised 7th) passes clean', () => {
    expect(validate(validScaleConstructionGrade3HarmonicInstance())).toEqual({ ok: true, errors: [] });
  });

  test('a grade-3 DESCENDING melodic instance (8 notes high->low) passes clean — the hook counts notes and matches the ordinal regex, direction-blind', () => {
    expect(validate(validScaleConstructionGrade3MelodicDescendingInstance())).toEqual({ ok: true, errors: [] });
  });

  test('a descending instance with fewer than 8 note events is still rejected (the 8-note pin holds regardless of direction)', () => {
    const instance = validScaleConstructionGrade3MelodicDescendingInstance();
    (instance.stimulus.music as any).voices[0].events.pop();
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('exactly 8 note events'))).toBe(true);
  });

  test('an answer_music key signature whose tonic is outside grade 3\'s keysMinor (Bb minor, a grade-4 key) is rejected', () => {
    const instance = validScaleConstructionGrade3HarmonicInstance();
    (instance.interaction.config.answer_music as any).key_sig = 'Bb_minor';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('scale_construction') && e.includes('minor key'))).toBe(true);
  });

  test('a grade-3 canonical answer that is not an ordinal note-position string is still rejected', () => {
    const instance = validScaleConstructionGrade3MelodicDescendingInstance();
    instance.answer.canonical = 'second';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('scale_construction') && e.includes('ordinal'))).toBe(true);
  });
});

describe('validate — per-template hook: add_time_signature (U5, D6: family + hidden-signature agreement)', () => {
  test('a well-formed grade-1 simple instance passes clean', () => {
    expect(validate(validAddTimeSignatureInstance())).toEqual({ ok: true, errors: [] });
  });

  test('a well-formed grade-3 compound instance (hidden signature, family-scoped distractors) passes clean', () => {
    expect(validate(validCompoundAddTimeSignatureInstance())).toEqual({ ok: true, errors: [] });
  });

  test('a cross-family distractor (a simple signature alongside a compound canonical) is rejected', () => {
    const instance = validCompoundAddTimeSignatureInstance();
    instance.distractors = ['9/8', '3/4'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('add_time_signature') && e.includes('family'))).toBe(true);
  });

  test('a hand-built instance labeling a 6/8-grouped hidden bar as 9/8 is rejected (hidden-sig/canonical mismatch)', () => {
    const instance = validCompoundAddTimeSignatureInstance();
    instance.answer.canonical = '9/8';
    instance.distractors = ['6/8', '12/8'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('add_time_signature') && e.includes('does not match'))).toBe(true);
  });
});

describe('validate — per-template hook: metre_classification (U6, D7: canonical must match the rendered signature)', () => {
  test('a well-formed instance passes clean', () => {
    expect(validate(validMetreClassificationInstance())).toEqual({ ok: true, errors: [] });
  });

  test('a mislabeled canonical (6/8-grouped bar labeled Compound triple, its own 9/8 cousin) is rejected', () => {
    const instance = validMetreClassificationInstance();
    instance.answer.canonical = 'Compound triple';
    instance.distractors = ['Simple duple', 'Compound duple'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('metre_classification') && e.includes('does not match'))).toBe(true);
  });

  test('an illegal label string as the canonical answer is rejected', () => {
    const instance = validMetreClassificationInstance();
    instance.answer.canonical = 'Compound duplex';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('metre_classification') && e.includes('not a legal metre label'))).toBe(
      true,
    );
  });

  test('an illegal label string as a distractor is rejected', () => {
    const instance = validMetreClassificationInstance();
    instance.distractors = ['Simple duple', 'Complex triple'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('metre_classification') && e.includes('not a legal metre label'))).toBe(
      true,
    );
  });

  test('a distractor that duplicates the canonical answer is rejected', () => {
    const instance = validMetreClassificationInstance();
    instance.distractors = ['Compound duple', 'Simple duple'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('metre_classification'))).toBe(true);
  });

  test('two duplicate distractors are rejected', () => {
    const instance = validMetreClassificationInstance();
    instance.distractors = ['Simple duple', 'Simple duple'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('metre_classification') && e.includes('duplicates'))).toBe(true);
  });
});

describe('validate — per-template hook: anacrusis_recognition (U3, D7: recomputes the pickup from the stimulus)', () => {
  test('a well-formed instance passes clean', () => {
    expect(validate(validAnacrusisRecognitionInstance())).toEqual({ ok: true, errors: [] });
  });

  test('cannot mislabel the rendered upbeat: a 1-beat pickup labeled "2 beats" is rejected', () => {
    const instance = validAnacrusisRecognitionInstance();
    instance.answer.canonical = '2 beats';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.includes('anacrusis_recognition') && e.includes('does not match')),
    ).toBe(true);
  });

  test('first + last bar must sum to one whole bar: a lengthened final bar is rejected', () => {
    const instance = validAnacrusisRecognitionInstance();
    const events = instance.stimulus.music.voices[0].events;
    events.push({ type: 'note', pitch: 'C4', dur: 'crotchet' });
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.includes('anacrusis_recognition') && e.includes('do not sum to one whole bar')),
    ).toBe(true);
  });

  test('a middle bar that is not full is rejected', () => {
    const instance = validAnacrusisRecognitionInstance();
    const events = instance.stimulus.music.voices[0].events as Array<{ type: string }>;
    // Drop one note from the first middle bar (indices 2..4 are its three crotchets).
    events.splice(2, 1);
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.includes('anacrusis_recognition') && e.includes('not a full bar')),
    ).toBe(true);
  });

  test('the metre must be visible: a hidden time signature is rejected', () => {
    const instance = validAnacrusisRecognitionInstance();
    instance.stimulus.music.time_sig_hidden = true;
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.includes('anacrusis_recognition') && e.includes('must be printed')),
    ).toBe(true);
  });

  test('the metre must be visible: a null time signature is rejected', () => {
    const instance = validAnacrusisRecognitionInstance();
    instance.stimulus.music.time_sig = null;
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('anacrusis_recognition'))).toBe(true);
  });

  test('a stimulus not marked anacrusis: true is rejected', () => {
    const instance = validAnacrusisRecognitionInstance();
    instance.stimulus.music.anacrusis = false;
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.includes('anacrusis_recognition') && e.includes('anacrusis: true')),
    ).toBe(true);
  });

  test('a non-"N beat(s)" distractor is rejected', () => {
    const instance = validAnacrusisRecognitionInstance();
    instance.distractors = ['3 beats', 'one beat'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.includes('anacrusis_recognition') && e.includes('is not an "N beat(s)" label')),
    ).toBe(true);
  });

  test('two duplicate distractors are rejected', () => {
    const instance = validAnacrusisRecognitionInstance();
    instance.distractors = ['3 beats', '3 beats'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.includes('anacrusis_recognition') && e.includes('duplicates')),
    ).toBe(true);
  });

  test('a distractor equal to the canonical answer is rejected', () => {
    const instance = validAnacrusisRecognitionInstance();
    instance.distractors = ['1 beat', '0 beats'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
  });
});

// U8 (chromaticly-*, G5-1 SATB): a grand-staff fixture matching the
// types.test.ts SATB shape (staves + four voices carrying staff/stem/name),
// with grade-5-in-range pitches for each voice's own staff (soprano/alto on
// treble F3..E6, tenor/bass on bass A1..G4 — see scope.ts GRADE_5_SCOPE,
// which mirrors GRADE_3_SCOPE.pitchRanges).
function validSatbGrandStaffInstance(): ExerciseInstance {
  return {
    id: 'e5f6a7b8-0000-0000-0000-000000000000',
    template_id: 'satb_voice_recognition',
    grade: 5,
    strand: 'pitch',
    prompt: 'Which voice is highlighted?',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: 'C_major',
        time_sig: '4/4',
        staves: ['treble', 'bass'],
        voices: [
          { name: 'soprano', staff: 0, stem: 'up', events: [{ type: 'note', pitch: 'C5', dur: 'crotchet', highlight: true }] },
          { name: 'alto', staff: 0, stem: 'down', events: [{ type: 'note', pitch: 'G4', dur: 'crotchet' }] },
          { name: 'tenor', staff: 1, stem: 'up', events: [{ type: 'note', pitch: 'E3', dur: 'crotchet' }] },
          { name: 'bass', staff: 1, stem: 'down', events: [{ type: 'note', pitch: 'C3', dur: 'crotchet' }] },
        ],
      },
      text: null,
    },
    interaction: {
      type: 'voice_options',
      config: {
        options: [
          { name: 'soprano', label: 'Soprano · treble, stem up' },
          { name: 'alto', label: 'Alto · treble, stem down' },
          { name: 'tenor', label: 'Tenor · bass, stem up' },
          { name: 'bass', label: 'Bass · bass, stem down' },
        ],
      },
    },
    answer: { canonical: 'soprano', accepted_alternatives: [] },
    distractors: ['alto', 'tenor', 'bass'],
    hints: ['The highlighted note sits on the treble staff, stem up.'],
    feedback: {
      correct: 'Correct — that is the soprano.',
      incorrect: 'Not quite — check the stave and stem direction of the highlighted note.',
    },
    srs_tags: ['voice:soprano'],
    kb_version: 'g5-2026-07-25',
  };
}

describe('ExerciseInstanceSchema — voice_options (U8: schema gate for G5-1 SATB)', () => {
  test('an instance carrying interaction.type "voice_options" parses, not rejected at the schema gate', () => {
    const result = ExerciseInstanceSchema.safeParse(validSatbGrandStaffInstance());
    expect(result.success).toBe(true);
  });
});

describe('validate — multi-staff scope (U8: each SATB voice checked against its OWN staff clef)', () => {
  test('a valid SATB grand-staff instance (treble S/A, bass T/B, all in range for their own staff) passes clean', () => {
    expect(validate(validSatbGrandStaffInstance())).toEqual({ ok: true, errors: [] });
  });

  test('single-clef Music (no staves) still validates byte-identically to today — no new errors on an existing G1 fixture', () => {
    // Guards R7: the no-staves branch of checkScope must be untouched by the
    // U8 staves-aware rewrite.
    expect(validate(validNoteNamingInstance())).toEqual({ ok: true, errors: [] });
  });

  test('a bass-staff pitch out of the BASS range is flagged, even though the same pitch is in range for treble', () => {
    // A4 is above the bass range ceiling (G4) but well inside the treble
    // range (F3..E6) — this is the case a single shared-clef check would
    // miss: it proves the bass voice is resolved against ITS OWN staff
    // (staves[1] = bass), not against music.clef ('treble').
    const instance = validSatbGrandStaffInstance();
    (instance.stimulus.music as any).voices[3].events[0].pitch = 'A4';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('scope') && e.includes('"A4"'))).toBe(true);
  });

  test('that same out-of-bass-range pitch is NOT flagged when the voice instead routes to the treble staff', () => {
    // Proves per-voice clef resolution rather than a single Music-wide
    // rejection: moving the identical A4 pitch to a treble-routed voice
    // (staff: 0) must clear the scope error.
    const instance = validSatbGrandStaffInstance();
    const bassVoice = (instance.stimulus.music as any).voices[3];
    bassVoice.staff = 0;
    bassVoice.events[0].pitch = 'A4';
    const result = validate(instance);
    expect(result.errors.some((e) => e.includes('scope') && e.includes('"A4"'))).toBe(false);
  });

  test('a voice with no staff field defaults to staff 0 (the top/treble stave)', () => {
    const instance = validSatbGrandStaffInstance();
    const sopranoVoice = (instance.stimulus.music as any).voices[0];
    delete sopranoVoice.staff;
    // C5 is in range for treble (staff 0, the default) but would be flagged
    // against bass (staff 1) — passing here proves the ?? 0 fallback.
    expect(validate(instance)).toEqual({ ok: true, errors: [] });
  });
});

describe('validate — voice_options CLOSED-set distractor integrity (U8 decision: joins CLOSED_INTERACTION_TYPES)', () => {
  test('a voice_options distractor equal to the canonical answer is rejected, same as mcq', () => {
    const instance = validSatbGrandStaffInstance();
    instance.distractors = ['soprano', 'tenor', 'bass'];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('not exactly one defensible answer'))).toBe(true);
  });
});

// The five First steps hooks (chromaticly-dhe). Each one recomputes the answer
// from the material the LEARNER sees, so the test that proves it works is the one
// that corrupts that material and expects a rejection. A hook only asserted
// against valid generator output would pass even if it returned [] unconditionally.
describe('validate — per-template hooks: First steps (recompute-don\'t-trust)', () => {
  const g = (template: string, atoms: string[] = []) => generate(template, { grade: 0, seed: 0, atoms });

  test('pulse_count: a bar whose event count disagrees with the answer is rejected', () => {
    const instance = g('pulse_count');
    instance.answer.canonical = String(Number(instance.answer.canonical) + 1);
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('pulse_count') && e.includes('but the answer says'))).toBe(true);
  });

  test('pulse_count: notation on an aural card is rejected even when the count is right', () => {
    const instance = g('pulse_count');
    instance.stimulus.music = (instance.interaction.config as { played_music: never }).played_music;
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('the card is aural'))).toBe(true);
  });

  test('alphabet_step: an answer that is not the next letter is rejected', () => {
    const instance = g('alphabet_step');
    instance.answer.canonical = instance.distractors[0];
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('alphabet_step') && e.includes('but the answer says'))).toBe(true);
  });

  test('keyboard_find: an answer whose letter is not the atom it credits is rejected', () => {
    const instance = g('keyboard_find');
    const wrong = 'ABCDEFG'.split('').find((l) => l !== String(instance.answer.canonical)[0])!;
    instance.answer.canonical = `${wrong}4`;
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('keyboard_find') && e.includes('credits'))).toBe(true);
  });

  test('stave_position: swapping line for space is rejected', () => {
    const instance = g('stave_position', ['stave_anatomy:line_or_space']);
    instance.answer.canonical = instance.answer.canonical === 'On a line' ? 'In a space' : 'On a line';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('stave_position'))).toBe(true);
  });

  // The bug this hook actually caught during the build: the generator compared
  // pitches as strings, so the note it called higher could sound lower.
  test('stave_position: naming the lower of the two drawn notes as the higher is rejected', () => {
    const instance = g('stave_position', ['stave_anatomy:higher_lower']);
    instance.answer.canonical = instance.answer.canonical === 'The first one' ? 'The second one' : 'The first one';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('stave_position') && e.includes('makes it'))).toBe(true);
  });

  test('note_shape_length: an answer naming a shape the stimulus does not draw is rejected', () => {
    const instance = g('note_shape_length');
    instance.answer.canonical = instance.answer.canonical === 'minim' ? 'crotchet' : 'minim';
    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('note_shape_length') && e.includes('draws a'))).toBe(true);
  });
});
