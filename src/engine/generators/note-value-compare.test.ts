// registry.tsx pulls in NotationCard -> MusicSurface -> react-native-webview,
// which has no native module in the jest environment — mocked here exactly
// as registry.test.ts does.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: React.forwardRef((_props: Record<string, unknown>, _ref: unknown) => null),
  };
});

import { lookupInteraction } from '../../ui/interactions/registry';
import { ExerciseInstanceSchema } from '../schema';
import { validate } from '../validator';
import { NOTE_VALUE_LABELS, UNITS, noteValueCompare } from './note-value-compare';

const LABEL_TO_DURATION = new Map(
  (Object.entries(NOTE_VALUE_LABELS) as [keyof typeof NOTE_VALUE_LABELS, string][]).map(([dur, label]) => [
    label,
    dur,
  ]),
);

function durationOf(label: unknown): keyof typeof NOTE_VALUE_LABELS {
  const dur = LABEL_TO_DURATION.get(label as string);
  if (!dur) throw new Error(`not a known note_value_compare label: ${String(label)}`);
  return dur;
}

describe('noteValueCompare — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = noteValueCompare({ grade: 1, seed: 7, atoms: ['note_value_compare'] });
    const b = noteValueCompare({ grade: 1, seed: 7, atoms: ['note_value_compare'] });
    expect(a).toEqual(b);
  });

  test('seeds 0, 1, 2 (the warm-up items) yield 3 distinct duration comparisons', () => {
    const pairs = [0, 1, 2].map((seed) => {
      const instance = noteValueCompare({ grade: 1, seed, atoms: ['note_value_compare'] });
      const longer = durationOf(instance.answer.canonical);
      const shorter = durationOf(instance.distractors[0]);
      return `${longer}>${shorter}`;
    });
    expect(new Set(pairs).size).toBe(3);
  });
});

describe('noteValueCompare — invariant: the correct answer is the strictly-longer duration', () => {
  test('canonical duration has more UNITS than the distractor duration, for seeds 0..29', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = noteValueCompare({ grade: 1, seed, atoms: ['note_value_compare'] });
      const longer = durationOf(instance.answer.canonical);
      const shorter = durationOf(instance.distractors[0]);
      expect(UNITS[longer]).toBeGreaterThan(UNITS[shorter]);
    }
  });

  test('never compares a duration against itself', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = noteValueCompare({ grade: 1, seed, atoms: ['note_value_compare'] });
      const longer = durationOf(instance.answer.canonical);
      const shorter = durationOf(instance.distractors[0]);
      expect(longer).not.toBe(shorter);
    }
  });
});

describe('noteValueCompare — shape: 2-option MCQ, G1 durations, design-voice labels, no hint', () => {
  test('exactly one distractor (2 options total), both a known G1 duration label', () => {
    for (let seed = 0; seed < 10; seed++) {
      const instance = noteValueCompare({ grade: 1, seed, atoms: ['note_value_compare'] });
      expect(instance.distractors).toHaveLength(1);
      expect(() => durationOf(instance.answer.canonical)).not.toThrow();
      expect(() => durationOf(instance.distractors[0])).not.toThrow();
    }
  });

  test('minim vs crotchet reads exactly as the design step-4 mock: "The open one (minim)" / "The filled one (crotchet)"', () => {
    expect(NOTE_VALUE_LABELS.minim).toBe('The open one (minim)');
    expect(NOTE_VALUE_LABELS.crotchet).toBe('The filled one (crotchet)');
  });

  test('hints is empty — trivially-easy question, no hint (KTD2)', () => {
    for (let seed = 0; seed < 5; seed++) {
      const instance = noteValueCompare({ grade: 1, seed, atoms: ['note_value_compare'] });
      expect(instance.hints).toEqual([]);
    }
  });

  test('strand is rhythm', () => {
    const instance = noteValueCompare({ grade: 1, seed: 0, atoms: ['note_value_compare'] });
    expect(instance.strand).toBe('rhythm');
  });

  test('srs_tags is exactly the bare note_value_compare atom', () => {
    const instance = noteValueCompare({ grade: 1, seed: 0, atoms: ['note_value_compare'] });
    expect(instance.srs_tags).toEqual(['note_value_compare']);
  });
});

describe('noteValueCompare — resolves against the schema and the mcq interaction', () => {
  test('validates against ExerciseInstanceSchema', () => {
    const instance = noteValueCompare({ grade: 1, seed: 0, atoms: ['note_value_compare'] });
    expect(ExerciseInstanceSchema.safeParse(instance).success).toBe(true);
  });

  test('lookupInteraction("mcq") resolves without throwing', () => {
    expect(() => lookupInteraction('mcq')).not.toThrow();
  });
});

describe('noteValueCompare — fuzz gate: 50 generated items are all validator-clean (scope, closed-item)', () => {
  test('seeds 0..49 all produce a passing instance', () => {
    for (let seed = 0; seed < 50; seed++) {
      const instance = noteValueCompare({ grade: 1, seed, atoms: ['note_value_compare'] });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('noteValueCompare — D9 hardening: grade-3 scope (with demisemiquaver) never hits an undefined UNITS/label lookup', () => {
  test('seeds 0..99 at grade 3 all produce a passing, well-formed instance — the cast `scope.noteValues as G1Duration[]` is total, not a latent undefined-lookup', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = noteValueCompare({ grade: 3, seed, atoms: ['note_value_compare'] });
      expect(() => durationOf(instance.answer.canonical)).not.toThrow();
      expect(() => durationOf(instance.distractors[0])).not.toThrow();
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });

  test('demisemiquaver is reachable as a compared duration at grade 3 (its UNITS/label rows are live, not dead code)', () => {
    let sawDemisemiquaver = false;
    for (let seed = 0; seed < 200; seed++) {
      const instance = noteValueCompare({ grade: 3, seed, atoms: ['note_value_compare'] });
      const longer = durationOf(instance.answer.canonical);
      const shorter = durationOf(instance.distractors[0]);
      if (longer === 'demisemiquaver' || shorter === 'demisemiquaver') sawDemisemiquaver = true;
    }
    expect(sawDemisemiquaver).toBe(true);
  });
});

describe('noteValueCompare — Grade 4 breve: never exceeds bar-filling scope, and always the strictly-longer note', () => {
  test('seeds 0..99 at grade 4 all produce a passing, well-formed instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = noteValueCompare({ grade: 4, seed, atoms: ['note_value_compare'] });
      expect(() => durationOf(instance.answer.canonical)).not.toThrow();
      expect(() => durationOf(instance.distractors[0])).not.toThrow();
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });

  test('breve is reachable as a compared duration at grade 4 and is always the longer note (breve exceeds every bar, so it can only ever be the "longer" side of a comparison)', () => {
    let sawBreve = false;
    for (let seed = 0; seed < 200; seed++) {
      const instance = noteValueCompare({ grade: 4, seed, atoms: ['note_value_compare'] });
      const longer = durationOf(instance.answer.canonical);
      const shorter = durationOf(instance.distractors[0]);
      if (longer === 'breve' || shorter === 'breve') {
        sawBreve = true;
        expect(longer).toBe('breve');
      }
    }
    expect(sawBreve).toBe(true);
  });

  test('breve is never drawn at grades 1-3 (it is outside their scope)', () => {
    for (const grade of [1, 2, 3] as const) {
      for (let seed = 0; seed < 100; seed++) {
        const instance = noteValueCompare({ grade, seed, atoms: ['note_value_compare'] });
        const longer = durationOf(instance.answer.canonical);
        const shorter = durationOf(instance.distractors[0]);
        expect(longer).not.toBe('breve');
        expect(shorter).not.toBe('breve');
      }
    }
  });
});
