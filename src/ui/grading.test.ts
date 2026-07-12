import { generate } from '../engine/generators';
import { atomsForTemplate } from '../engine/generators/test-helpers';
import type { ExerciseInstance } from '../engine/schema';
import { assembleOptions, gradeMcq, gradeStaveInput, gradeText, gradeTrueFalse, optionLabel, toResult } from './grading';

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
