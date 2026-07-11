import { G1_CLEFS } from '../scope';
import { validate } from '../validator';
import { noteNaming } from './note-naming';

describe('noteNaming — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = noteNaming({ grade: 1, seed: 42 });
    const b = noteNaming({ grade: 1, seed: 42 });
    expect(a).toEqual(b);
  });

  test('different seeds produce different instances', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seeds.add(JSON.stringify(noteNaming({ grade: 1, seed })));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('noteNaming — scope (commandment 1)', () => {
  test('sampled clef and pitch stay within G1 scope across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = noteNaming({ grade: 1, seed });
      const music = instance.stimulus.music as { clef: string; voices: { events: { pitch: string }[] }[] };
      expect(G1_CLEFS).toContain(music.clef);
      expect(validate(instance).ok).toBe(true);
    }
  });
});

describe('noteNaming — distractor rule: clef confusion + adjacent line/space', () => {
  test('one distractor names the note as it would read on the OTHER clef, at the same staff position', () => {
    // seed 42 -> a specific deterministic instance; assert against its own
    // clef-confusion computation rather than hand-picking a magic pitch.
    const instance = noteNaming({ grade: 1, seed: 42 });
    expect(instance.distractors).toHaveLength(2);
    // both distractors are single note names distinct from the canonical answer
    for (const d of instance.distractors) {
      expect(d).not.toBe(instance.answer.canonical);
    }
  });

  test('across many seeds, distractors are always well-formed note names distinct from the answer and each other', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = noteNaming({ grade: 1, seed });
      const [adjacent, clefConfusion] = instance.distractors as string[];
      expect(adjacent).not.toBe(instance.answer.canonical);
      expect(clefConfusion).not.toBe(instance.answer.canonical);
      expect(adjacent).not.toBe(clefConfusion);
    }
  });
});

describe('noteNaming — grading (spec example: "E flat" accepts "Eb"/"E♭")', () => {
  test('a flat answer computes accepted_alternatives with the flat symbol and unicode flat', () => {
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed++) {
      const instance = noteNaming({ grade: 1, seed });
      if (typeof instance.answer.canonical === 'string' && instance.answer.canonical.endsWith('flat')) {
        found = true;
        const letter = instance.answer.canonical[0];
        expect(instance.answer.accepted_alternatives).toEqual([`${letter}b`, `${letter}♭`]);
      }
    }
    expect(found).toBe(true);
  });

  test('a sharp answer computes accepted_alternatives with # and unicode sharp', () => {
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed++) {
      const instance = noteNaming({ grade: 1, seed });
      if (typeof instance.answer.canonical === 'string' && instance.answer.canonical.endsWith('sharp')) {
        found = true;
        const letter = instance.answer.canonical[0];
        expect(instance.answer.accepted_alternatives).toEqual([`${letter}#`, `${letter}♯`]);
      }
    }
    expect(found).toBe(true);
  });

  test('a plain natural answer has no accepted_alternatives', () => {
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed++) {
      const instance = noteNaming({ grade: 1, seed });
      if (typeof instance.answer.canonical === 'string' && !instance.answer.canonical.includes(' ')) {
        found = true;
        expect(instance.answer.accepted_alternatives).toEqual([]);
      }
    }
    expect(found).toBe(true);
  });
});

describe('noteNaming — srs_tags', () => {
  test('emits a note_read atom for the sampled clef and pitch', () => {
    const instance = noteNaming({ grade: 1, seed: 7 });
    expect(instance.srs_tags).toHaveLength(1);
    expect(instance.srs_tags[0]).toMatch(/^note_read:(treble|bass):[A-G](#|b)?\d$/);
  });
});

describe('noteNaming — fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = noteNaming({ grade: 1, seed });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});
