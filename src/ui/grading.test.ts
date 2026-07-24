import { generate } from '../engine/generators';
import { atomsForTemplate } from '../engine/generators/test-helpers';
import type { ExerciseInstance } from '../engine/schema';
import {
  assembleOptions,
  gradeMcq,
  gradeStaveInput,
  gradeText,
  gradeTransposition,
  gradeTrueFalse,
  optionLabel,
  toResult,
  transpositionBeginFix,
  transpositionCheckLabel,
  transpositionSummary,
  transpositionVerdicts,
  type TranspositionResponse,
} from './grading';

describe('optionLabel — every G1 answer shape gets a readable label', () => {
  test.each([
    ['C sharp', 'C sharp'],
    ['D major', 'D major'],
  ])('string %s renders as-is', (input, expected) => {
    expect(optionLabel(input)).toBe(expected);
  });

  test('interval number renders as a string', () => {
    expect(optionLabel(5)).toBe('5');
  });

  test('rhythm value renders with the dotted prefix only when dotted', () => {
    expect(optionLabel({ dur: 'crotchet', dots: 0 })).toBe('crotchet');
    expect(optionLabel({ dur: 'crotchet', dots: 1 })).toBe('dotted crotchet');
    // chromaticly-2fc: a double dot reads "double-dotted", the standard term
    // (and matching rhythm-sum.ts's own prompt), not the generic "2-dotted".
    expect(optionLabel({ dur: 'minim', dots: 2 })).toBe('double-dotted minim');
  });

  test('term value renders its value, not the category', () => {
    expect(optionLabel({ value: 'gradually getting quicker', category: 'tempo' })).toBe('gradually getting quicker');
  });
});

describe('assembleOptions — answer + distractors, deterministic order', () => {
  test('includes exactly one correct option and all distractors', () => {
    const instance = generate('note_naming', { grade: 1, seed: 4, atoms: ['note_read:treble:C4', 'note_read:treble:E4', 'note_read:treble:G4'] });
    const options = assembleOptions(instance);
    expect(options).toHaveLength(instance.distractors.length + 1);
    expect(options.filter((o) => o.correct)).toHaveLength(1);
  });

  test('the same instance shuffles the same way (reproducible presentation)', () => {
    const instance = generate('interval_naming', { grade: 1, seed: 4, atoms: [] });
    const a = assembleOptions(instance).map((o) => o.label);
    const b = assembleOptions(instance).map((o) => o.label);
    expect(a).toEqual(b);
  });
});

describe('assembleOptions — notation-answer render payload (U4/AD5)', () => {
  test('key_signature_id options carry the generator\'s per-key stave, addressed by the semantic value', () => {
    const instance = generate('key_signature_id', { grade: 1, seed: 5, atoms: atomsForTemplate('key_signature_id') });
    const options = assembleOptions(instance);
    for (const option of options) {
      expect(option.music).toBeDefined();
      expect(option.value).toBe(optionLabel(option.value)); // key names format as-is
    }
  });

  // Invariant: when an option renders notation, its text label is never computed —
  // optionLabel's dur/term formatting is irrelevant once a stave replaces the text.
  test('a notation option gets an empty label — optionLabel formatting is skipped, not just unused', () => {
    const instance = generate('key_signature_id', { grade: 1, seed: 5, atoms: atomsForTemplate('key_signature_id') });
    for (const option of assembleOptions(instance)) {
      expect(option.label).toBe('');
    }
  });

  test('a text-only template (no option_music) keeps formatted labels and no music field', () => {
    const instance = generate('rhythm_sum', { grade: 1, seed: 5, atoms: [] });
    for (const option of assembleOptions(instance)) {
      expect(option.music).toBeUndefined();
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});

describe('gradeMcq — correctness is deep-equality with the canonical answer', () => {
  test('the correct option grades true; every distractor grades false, across all templates', () => {
    for (const template of ['note_naming', 'interval_naming', 'rhythm_sum', 'key_signature_id', 'term_meaning']) {
      for (let seed = 0; seed < 20; seed++) {
        const instance = generate(template, { grade: 1, seed, atoms: atomsForTemplate(template) });
        expect(gradeMcq(instance, instance.answer.canonical)).toBe(true);
        for (const d of instance.distractors) {
          expect(gradeMcq(instance, d)).toBe(false);
        }
      }
    }
  });

  test('an object answer (rhythm) is matched structurally, not by reference', () => {
    const instance = generate('rhythm_sum', { grade: 1, seed: 2, atoms: [] });
    const canonical = instance.answer.canonical as { dur: string; dots: number };
    expect(gradeMcq(instance, { ...canonical })).toBe(true);
  });
});

describe('gradeText — case/space-insensitive, honors accepted alternatives', () => {
  // Build a note_naming instance with a known accidental answer to exercise "Eb" for "E flat".
  const eFlat: ExerciseInstance = {
    ...generate('note_naming', { grade: 1, seed: 0, atoms: ['note_read:treble:C4', 'note_read:treble:E4', 'note_read:treble:G4'] }),
    answer: { canonical: 'E flat', accepted_alternatives: ['Eb', 'E♭'] },
  };

  test.each(['E flat', 'e flat', '  E   FLAT ', 'Eb', 'E♭'])('accepts "%s"', (input) => {
    expect(gradeText(eFlat, input)).toBe(true);
  });

  test.each(['E', 'E sharp', 'F flat'])('rejects "%s"', (input) => {
    expect(gradeText(eFlat, input)).toBe(false);
  });
});

describe('gradeTrueFalse — correct only when EVERY per-bar verdict matches (no partial credit)', () => {
  test('an attempt matching every per_item verdict grades correct, across many generated bar_validity instances', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = generate('bar_validity', { grade: 1, seed, atoms: [] });
      const perItem = instance.answer.per_item as boolean[];
      expect(gradeTrueFalse(instance, perItem)).toBe(true);
    }
  });

  test('a single wrong bar grades the whole attempt incorrect', () => {
    const instance = generate('bar_validity', { grade: 1, seed: 6, atoms: [] });
    const perItem = instance.answer.per_item as boolean[];
    const oneWrong = perItem.map((v, i) => (i === 0 ? !v : v));
    expect(gradeTrueFalse(instance, oneWrong)).toBe(false);
  });

  test('every bar wrong grades incorrect', () => {
    const instance = generate('bar_validity', { grade: 1, seed: 6, atoms: [] });
    const perItem = instance.answer.per_item as boolean[];
    expect(gradeTrueFalse(instance, perItem.map((v) => !v))).toBe(false);
  });

  test('a response of mismatched length never grades correct', () => {
    const instance = generate('bar_validity', { grade: 1, seed: 6, atoms: [] });
    const perItem = instance.answer.per_item as boolean[];
    expect(gradeTrueFalse(instance, perItem.slice(0, -1))).toBe(false);
  });
});

// U8/AE5: "a wrong pitch or wrong duration grades incorrect" — the invariant
// under test is that BOTH fields must match; either one alone is not enough.
describe('gradeStaveInput — correct only when BOTH pitch and duration match (AE5, no partial credit)', () => {
  test('the generated canonical placement grades correct, across many generated instances', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = generate('interval_naming_stave_input', { grade: 1, seed, atoms: [] });
      const canonical = instance.answer.canonical as { pitch: string; dur: string };
      expect(gradeStaveInput(instance, { pitch: canonical.pitch, dur: canonical.dur })).toBe(true);
    }
  });

  test('the right pitch at the wrong duration grades incorrect', () => {
    const instance = generate('interval_naming_stave_input', { grade: 1, seed: 3, atoms: [] });
    const canonical = instance.answer.canonical as { pitch: string; dur: string };
    const wrongDur = canonical.dur === 'crotchet' ? 'minim' : 'crotchet';
    expect(gradeStaveInput(instance, { pitch: canonical.pitch, dur: wrongDur })).toBe(false);
  });

  test('the right duration at the wrong pitch grades incorrect', () => {
    const instance = generate('interval_naming_stave_input', { grade: 1, seed: 3, atoms: [] });
    const canonical = instance.answer.canonical as { pitch: string; dur: string };
    expect(gradeStaveInput(instance, { pitch: 'Z9', dur: canonical.dur })).toBe(false);
  });

  test('no placement (null response) never grades correct', () => {
    const instance = generate('interval_naming_stave_input', { grade: 1, seed: 3, atoms: [] });
    expect(gradeStaveInput(instance, null)).toBe(false);
  });
});

// U5/D4/D5: octave transposition's per-note grading, exercised against a
// hand-built instance (direction/misconception cases need precise control
// over source/target/placed values that a generated seed can't guarantee).
describe('transposition grading (Grade 3 octave transposition, D4/D5)', () => {
  const downInstance: ExerciseInstance = {
    id: 'test-transposition-down',
    template_id: 'octave_transposition',
    grade: 3,
    strand: 'pitch',
    prompt: 'Rewrite this melody one octave lower, in the bass clef.',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: 'C_major',
        time_sig: '4/4',
        voices: [
          {
            events: [
              { type: 'note', pitch: 'C5', dur: 'crotchet' },
              { type: 'note', pitch: 'E5', dur: 'crotchet' },
              { type: 'note', pitch: 'G5', dur: 'minim' },
              { type: 'barline', style: 'double' },
            ],
          },
        ],
      },
      text: null,
    },
    interaction: { type: 'transposition_input', config: { answerClef: 'bass', direction: 'down' } },
    answer: {
      canonical: [
        { pitch: 'C4', dur: 'crotchet' },
        { pitch: 'E4', dur: 'crotchet' },
        { pitch: 'G4', dur: 'minim' },
      ],
      accepted_alternatives: [],
      per_item: [
        { pitch: 'C4', dur: 'crotchet' },
        { pitch: 'E4', dur: 'crotchet' },
        { pitch: 'G4', dur: 'minim' },
      ],
    },
    distractors: [],
    hints: [],
    feedback: { correct: 'Correct!', incorrect: 'Not quite — check each note is the SAME letter name, one octave away, on the new clef.' },
    srs_tags: ['transpose:octave'],
    kb_version: 'test',
  };

  test('exact pitch match, spelling included — an enharmonic respelling does not satisfy the target', () => {
    const exact: TranspositionResponse = { placements: ['C4', 'E4', 'G4'], locked: [] };
    expect(gradeTransposition(downInstance, exact)).toBe(true);

    const respelled: TranspositionResponse = { placements: ['B#3', 'E4', 'G4'], locked: [] };
    expect(gradeTransposition(downInstance, respelled)).toBe(false);
  });

  test('one wrong note fails the whole item but yields a partial summary (grade !== feedback register)', () => {
    const oneWrong: TranspositionResponse = { placements: ['C4', 'F4', 'G4'], locked: [] }; // E4 -> F4
    expect(gradeTransposition(downInstance, oneWrong)).toBe(false);
    expect(transpositionSummary(downInstance, oneWrong)).toMatchObject({ correct: 2, total: 3 });
  });

  // Rule 5 (name-the-misconception): asserts the substring, not just a non-empty
  // message — this must fail if the "a 7th" logic is deleted or genericized.
  test('an off-by-one-diatonic-step placement below the octave is named "a 7th, not an octave"', () => {
    const nearMiss: TranspositionResponse = { placements: ['D4', 'E4', 'G4'], locked: [] }; // a 7th below C5, not the octave
    const summary = transpositionSummary(downInstance, nearMiss);
    expect(summary?.message).toContain('a 7th');
    expect(summary?.message).toContain('Note 1');
  });

  test('a wrong letter entirely (not an off-by-one-step) gets the generic message, not "a 7th"', () => {
    const wrongLetter: TranspositionResponse = { placements: ['A4', 'E4', 'G4'], locked: [] }; // far from C4, not a near-miss
    const summary = transpositionSummary(downInstance, wrongLetter);
    expect(summary?.message).not.toContain('a 7th');
    expect(summary?.message).toContain('right letter name');
  });

  test('all-correct and all-wrong both yield no partial summary (only some-right-some-wrong)', () => {
    const allCorrect: TranspositionResponse = { placements: ['C4', 'E4', 'G4'], locked: [] };
    expect(transpositionSummary(downInstance, allCorrect)).toBeNull();

    const allWrong: TranspositionResponse = { placements: ['D4', 'F4', 'A4'], locked: [] };
    expect(transpositionSummary(downInstance, allWrong)).toBeNull();
  });

  test('transpositionVerdicts reports one boolean per slot, matching gradeTransposition\'s "every" semantics', () => {
    const oneWrong: TranspositionResponse = { placements: ['C4', 'F4', 'G4'], locked: [] };
    expect(transpositionVerdicts(downInstance, oneWrong)).toEqual([true, false, true]);
  });

  test('transpositionBeginFix keeps and locks correct slots, clears the wrong ones', () => {
    const oneWrong: TranspositionResponse = { placements: ['C4', 'F4', 'G4'], locked: [] };
    expect(transpositionBeginFix(downInstance, oneWrong)).toEqual({
      placements: ['C4', null, 'G4'],
      locked: [true, false, true],
    });
  });

  // Mirrored wording for the 'up' direction (bass-given -> treble): a 7th-higher
  // near-miss is "too low", not "too high".
  test('the mirrored "up" direction names a 7th-higher near-miss as one position too low', () => {
    const upInstance: ExerciseInstance = {
      ...downInstance,
      id: 'test-transposition-up',
      interaction: { type: 'transposition_input', config: { answerClef: 'treble', direction: 'up' } },
      answer: {
        canonical: [{ pitch: 'G4', dur: 'crotchet' }, { pitch: 'C5', dur: 'minim' }],
        accepted_alternatives: [],
        per_item: [{ pitch: 'G4', dur: 'crotchet' }, { pitch: 'C5', dur: 'minim' }],
      },
    };
    const nearMiss: TranspositionResponse = { placements: ['F4', 'C5'], locked: [] }; // a 7th above G3, not the octave
    const summary = transpositionSummary(upInstance, nearMiss);
    expect(summary?.message).toContain('a 7th');
    expect(summary?.message).toContain('too low');
  });

  describe('length guard (Codex finding 7): every transposition function fails closed on a malformed response', () => {
    test('gradeTransposition returns false when placements.length !== per_item.length', () => {
      expect(gradeTransposition(downInstance, { placements: ['C4', 'E4'], locked: [] })).toBe(false);
    });

    test('transpositionSummary returns null on the same mismatch', () => {
      expect(transpositionSummary(downInstance, { placements: ['C4', 'E4'], locked: [] })).toBeNull();
    });

    test('transpositionVerdicts returns [] on the same mismatch', () => {
      expect(transpositionVerdicts(downInstance, { placements: ['C4', 'E4'], locked: [] })).toEqual([]);
    });

    test('transpositionBeginFix no-ops (returns the response unchanged) on the same mismatch', () => {
      const malformed: TranspositionResponse = { placements: ['C4', 'E4'], locked: [] };
      expect(transpositionBeginFix(downInstance, malformed)).toBe(malformed);
    });

    test('a locked array of the wrong non-zero length also fails closed', () => {
      const malformed: TranspositionResponse = { placements: ['C4', 'E4', 'G4'], locked: [true] };
      expect(gradeTransposition(downInstance, malformed)).toBe(false);
    });
  });

  describe('transpositionCheckLabel — counts remaining unplaced notes', () => {
    test('drives the disabled Check copy, falling back to plain "Check" once every slot is filled', () => {
      expect(transpositionCheckLabel(downInstance, { placements: [null, null, null], locked: [] })).toBe('Check — 3 notes left');
      expect(transpositionCheckLabel(downInstance, { placements: ['C4', null, null], locked: [] })).toBe('Check — 2 notes left');
      expect(transpositionCheckLabel(downInstance, { placements: ['C4', 'E4', null], locked: [] })).toBe('Check — 1 note left');
      expect(transpositionCheckLabel(downInstance, { placements: ['C4', 'E4', 'G4'], locked: [] })).toBe('Check');
    });
  });
});

describe('toResult — mastery signal carries the atom and hint use', () => {
  test('a hint-free correct reports the atom, correct, zero hints', () => {
    const instance = generate('note_naming', { grade: 1, seed: 5, atoms: ['note_read:treble:C4', 'note_read:treble:E4', 'note_read:treble:G4'] });
    expect(toResult(instance, true, 0)).toEqual({ atom: instance.srs_tags[0], correct: true, hintsUsed: 0 });
  });

  test('a hint-assisted attempt records the hint count (why: KTD10 must not count it as mastery)', () => {
    const instance = generate('note_naming', { grade: 1, seed: 5, atoms: ['note_read:treble:C4', 'note_read:treble:E4', 'note_read:treble:G4'] });
    expect(toResult(instance, true, 2).hintsUsed).toBe(2);
  });
});
