import { generate } from '../engine/generators';
import { validate } from '../engine/validator';
import { assertAtomResolves, assertUnlockGraph, LESSONS, lessonById, type Lesson } from './lessons';

describe('grade1 lessons — the bundled doc loads and cross-checks clean', () => {
  test('importing the module did not throw (schema + cross-refs + graph all valid)', () => {
    expect(LESSONS.length).toBeGreaterThan(0);
  });

  test('every atom in every lesson resolves to a real generator atom', () => {
    for (const lesson of LESSONS) {
      for (const atom of lesson.atoms) {
        expect(() => assertAtomResolves(atom)).not.toThrow();
      }
    }
  });

  test('every worked example produces a validator-clean instance', () => {
    for (const lesson of LESSONS) {
      if (!lesson.worked_example) continue;
      const { template_id, grade, seed } = lesson.worked_example;
      const instance = generate(template_id, { grade, seed, atoms: lesson.atoms });
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
    }
  });

  test('each lesson strand matches its worked-example instance strand', () => {
    for (const lesson of LESSONS) {
      if (!lesson.worked_example) continue;
      const { template_id, grade, seed } = lesson.worked_example;
      expect(generate(template_id, { grade, seed, atoms: lesson.atoms }).strand).toBe(lesson.strand);
    }
  });
});

describe('grade1 lessons — atom cross-check rejects dangling references (why: a typo must fail loud, not vanish)', () => {
  test.each([
    'note_read:alto:C4', // clef outside G1 scope
    'note_read:treble:C9', // pitch outside range
    'key_sig:C_minor', // mode outside G1 scope
    'key_sig:E_major', // key outside G1 scope
    'interval:1', // unison — below the above-tonic floor
    'interval:9', // beyond an octave
    'term:not_a_real_term', // unknown term slug
    'note_read:C4', // missing clef segment
    'gremlin:xyz', // unknown kind
  ])('rejects malformed atom "%s"', (atom) => {
    expect(() => assertAtomResolves(atom)).toThrow();
  });
});

describe('grade1 lessons — unlock graph invariants', () => {
  const chain = (...ids: (string | null)[]): Lesson[] =>
    ids.slice(0, -1).map((id, i) => ({
      id: id as string,
      title: id as string,
      strand: 'pitch',
      atoms: ['rhythm_sum'],
      templates: ['rhythm_sum'],
      unlocks: ids[i + 1],
    }));

  test('the real sequence is a single acyclic chain reaching every lesson', () => {
    expect(() => assertUnlockGraph(LESSONS)).not.toThrow();
    const terminal = LESSONS.filter((l) => l.unlocks === null);
    expect(terminal).toHaveLength(1);
  });

  test('rejects a cycle', () => {
    const cyclic: Lesson[] = chain('a', 'b', 'c', null);
    cyclic[2].unlocks = 'b'; // root a -> b -> c -> b (cycle downstream of a valid root)
    expect(() => assertUnlockGraph(cyclic)).toThrow(/cycle/);
  });

  test('rejects an unreachable (stranded) lesson', () => {
    const stranded = [...chain('a', 'b', null), ...chain('orphan', null)];
    expect(() => assertUnlockGraph(stranded)).toThrow();
  });

  test('rejects an unlock pointing at an unknown lesson', () => {
    expect(() => assertUnlockGraph(chain('a', 'ghost', null).slice(0, 1).concat())).toThrow();
  });
});

describe('grade1 lessons — lessonById', () => {
  test('resolves the first lesson and returns undefined for a miss', () => {
    expect(lessonById(LESSONS[0].id)).toBe(LESSONS[0]);
    expect(lessonById('nope')).toBeUndefined();
  });
});
