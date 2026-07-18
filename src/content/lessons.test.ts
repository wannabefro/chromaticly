import { generate } from '../engine/generators';
import { validate } from '../engine/validator';
import {
  assertAtomResolves,
  assertNoCrossDocDuplicateIds,
  assertUnlockGraph,
  loadDoc,
  LESSONS,
  LESSONS_BY_GRADE,
  lessonById,
  type Lesson,
} from './lessons';
import { assertRhythmFillsBars, beatGrid } from './teach-rhythm';

describe('grade1 lessons — the bundled doc loads and cross-checks clean', () => {
  test('importing the module did not throw (schema + cross-refs + graph all valid)', () => {
    expect(LESSONS.length).toBeGreaterThan(0);
  });

  test('every atom in every lesson resolves to a real generator atom', () => {
    for (const lesson of LESSONS) {
      for (const atom of lesson.atoms) {
        expect(() => assertAtomResolves(atom, lesson.grade)).not.toThrow();
      }
    }
  });

  test('every loaded grade-1 lesson is stamped grade 1', () => {
    for (const lesson of LESSONS_BY_GRADE[1]) {
      expect(lesson.grade).toBe(1);
    }
    for (const lesson of LESSONS) {
      expect(lesson.grade).toBe(1);
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

  // The teach phase (design 4a/4b) is content, so it must be as trustworthy as
  // the exercises: every lesson carries one, and every notation it references
  // comes from a real, validator-clean generator call — a stale template id or
  // seed must fail loud here, not render a blank card on device.
  test('every Grade 1 lesson carries a teach phase with objectives and a concept', () => {
    for (const lesson of LESSONS) {
      expect(lesson.teach).toBeTruthy();
      expect(lesson.teach!.objectives.length).toBeGreaterThan(0);
      expect(lesson.teach!.concept.title.length).toBeGreaterThan(0);
      expect(lesson.teach!.concept.body.length).toBeGreaterThan(0);
    }
  });

  test('every teach concept example is validator-clean', () => {
    for (const lesson of LESSONS) {
      const ex = lesson.teach?.concept.example;
      if (!ex) continue;
      const instance = generate(ex.template_id, { grade: ex.grade, seed: ex.seed, atoms: lesson.atoms });
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
    }
  });

  // The by-ear rhythm is authored, not generated — so the thing that guarantees it
  // plays in metre is this check, not a generator's validator (302.3.5).
  test('every authored theory-in-sound rhythm fills whole bars', () => {
    for (const lesson of LESSONS) {
      const rhythm = lesson.teach?.theoryInSound;
      if (!rhythm) continue;
      expect(() => assertRhythmFillsBars(rhythm)).not.toThrow();
      expect(beatGrid(rhythm).some((cell) => cell.strong)).toBe(true);
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
    expect(() => assertAtomResolves(atom, 1)).toThrow();
  });
});

describe('grade1 lessons — assertAtomResolves is scoped per grade, not hardcoded to G1', () => {
  // A G2-only key: in scope at grade 2, out of scope at grade 1.
  test('key_sig:Bb_major resolves at grade 2 but not grade 1', () => {
    expect(() => assertAtomResolves('key_sig:Bb_major', 2)).not.toThrow();
    expect(() => assertAtomResolves('key_sig:Bb_major', 1)).toThrow();
  });

  // B3 sits inside G2's treble range (A3..C6) but below G1's floor (C4).
  test('note_read:treble:B3 resolves at grade 2 but not grade 1', () => {
    expect(() => assertAtomResolves('note_read:treble:B3', 2)).not.toThrow();
    expect(() => assertAtomResolves('note_read:treble:B3', 1)).toThrow();
  });
});

describe('lessons — a lesson id reused across two grade docs fails loud at load time', () => {
  test('assertNoCrossDocDuplicateIds throws when a synthetic second doc reuses a grade-1 id', () => {
    const duplicateId = LESSONS_BY_GRADE[1][0].id;
    const syntheticDoc = loadDoc({
      grade: 2,
      version: 'synthetic-test-doc',
      lessons: [
        {
          id: duplicateId,
          title: 'Synthetic duplicate',
          strand: 'pitch',
          atoms: ['rhythm_sum'],
          templates: ['rhythm_sum'],
          unlocks: null,
        },
      ],
    });
    expect(() => assertNoCrossDocDuplicateIds([{ grade: 1, version: 'g1', lessons: LESSONS_BY_GRADE[1] }, syntheticDoc])).toThrow(
      new RegExp(`"${duplicateId}".*more than one grade doc`),
    );
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
      grade: 1,
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
