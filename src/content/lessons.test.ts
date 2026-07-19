import { generate } from '../engine/generators';
import { validate } from '../engine/validator';
import { SET_SIZE } from '../learn/exercise-set';
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

  // D9 — key_sig now accepts minor keys, scoped by scopeForGrade(grade).keysMinor,
  // not just major (a bare minor key is not in G1's syllabus at all).
  test('key_sig:A_minor resolves at grade 2 but not grade 1', () => {
    expect(() => assertAtomResolves('key_sig:A_minor', 2)).not.toThrow();
    expect(() => assertAtomResolves('key_sig:A_minor', 1)).toThrow();
  });

  // D9 — the new `scale:` atom kind: tonic must be in keysMinor AND form in
  // minorForms, so a melodic atom stays invalid until a grade's scope lists
  // that form (structure-only G3 forward compat, not content shipped early).
  test('scale:A_minor_harmonic resolves at grade 2 (tonic in scope, form in scope)', () => {
    expect(() => assertAtomResolves('scale:A_minor_harmonic', 2)).not.toThrow();
  });

  test('scale:B_minor_harmonic rejects an out-of-scope tonic at grade 2', () => {
    expect(() => assertAtomResolves('scale:B_minor_harmonic', 2)).toThrow();
  });

  test('scale:A_minor_melodic rejects a form not yet in grade 2 scope, even for an in-scope tonic', () => {
    expect(() => assertAtomResolves('scale:A_minor_melodic', 2)).toThrow();
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

  // Per grade, not over the merged LESSONS: each grade doc is its own
  // single-root chain (D1) — registering grade-2 adds a second independent
  // root, so asserting one root over the merge would be a false invariant.
  test('the real sequence is a single acyclic chain reaching every lesson, per grade', () => {
    for (const gradeLessons of Object.values(LESSONS_BY_GRADE)) {
      expect(() => assertUnlockGraph(gradeLessons)).not.toThrow();
      const terminal = gradeLessons.filter((l) => l.unlocks === null);
      expect(terminal).toHaveLength(1);
    }
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

// U2 — the grade-2 doc registers alongside grade-1 (see registration in
// lessons.ts); grade-2 content validates against grade-2 scope, the same
// teeth grade-1 content already goes through above.
describe('grade2 lessons — the bundled doc loads and cross-checks clean', () => {
  test('LESSONS_BY_GRADE[2] has the single linear key-signatures-2 -> minor-keys-2 -> minor-scales-2 chain', () => {
    expect(LESSONS_BY_GRADE[2].map((l) => l.id)).toEqual(['key-signatures-2', 'minor-keys-2', 'minor-scales-2']);
  });

  test('lessonById resolves the grade-2 lesson stamped grade 2', () => {
    const lesson = lessonById('key-signatures-2');
    expect(lesson).toBeTruthy();
    expect(lesson!.grade).toBe(2);
  });

  test('the grade-2 units are in the merged LESSONS list, after grade-1', () => {
    expect(LESSONS.map((l) => l.id)).toEqual(expect.arrayContaining(['key-signatures-2', 'minor-keys-2', 'minor-scales-2']));
  });
});

// U5 (grade3-melodic-minor plan, D7) — the grade-3 doc registers alongside
// grade-1/2 (see registration in lessons.ts); grade-3 content validates
// against grade-3 scope, the same teeth grade-1/2 content already goes
// through above.
describe('grade3 lessons — the bundled doc loads and cross-checks clean', () => {
  test('LESSONS_BY_GRADE[3] has the single linear minor-keys-3 -> minor-scales-3 -> melodic-minor-3 chain', () => {
    expect(LESSONS_BY_GRADE[3].map((l) => l.id)).toEqual(['minor-keys-3', 'minor-scales-3', 'melodic-minor-3']);
  });

  test('lessonById resolves the grade-3 lesson stamped grade 3', () => {
    const lesson = lessonById('minor-keys-3');
    expect(lesson).toBeTruthy();
    expect(lesson!.grade).toBe(3);
  });

  test('the grade-3 units are in the merged LESSONS list, after grade-2, ending on the terminal lesson', () => {
    expect(LESSONS.map((l) => l.id)).toEqual(expect.arrayContaining(['minor-keys-3', 'minor-scales-3', 'melodic-minor-3']));
    expect(LESSONS[LESSONS.length - 1].id).toBe('melodic-minor-3');
  });
});

describe('grade3 lessons — assertAtomResolves is scoped to grade 3, not just grade 1/2', () => {
  test('key_sig:F#_minor resolves at grade 3 but not grade 2', () => {
    expect(() => assertAtomResolves('key_sig:F#_minor', 3)).not.toThrow();
    expect(() => assertAtomResolves('key_sig:F#_minor', 2)).toThrow();
  });

  test('scale:C#_minor_melodic resolves at grade 3 but not grade 2', () => {
    expect(() => assertAtomResolves('scale:C#_minor_melodic', 3)).not.toThrow();
    expect(() => assertAtomResolves('scale:C#_minor_melodic', 2)).toThrow();
  });

  // Bb minor is a grade-4 key (not in GRADE_3_SCOPE.keysMinor) — scope is law
  // even for an atom that merely looks like a plausible G3 extension.
  test('scale:Bb_minor_harmonic (a grade-4 key) throws at grade 3', () => {
    expect(() => assertAtomResolves('scale:Bb_minor_harmonic', 3)).toThrow();
  });
});

// Playability sweep, generalized over every grade the map can open (D7 note:
// prefer generalizing this block over duplicating it per grade). SetRunner
// seeds each of a set's SET_SIZE items with itemIndex (0..SET_SIZE-1,
// SetRunner.tsx:57,70) — this is the real seed range a learner hits.
describe.each([...LESSONS_BY_GRADE[2], ...LESSONS_BY_GRADE[3]])('$id playability sweep', (lesson) => {
  for (const templateId of lesson.templates) {
    test(`${templateId} generates across the real per-set seed range without throwing, tagging only this lesson's atoms`, () => {
      for (let seed = 0; seed < SET_SIZE; seed++) {
        const instance = generate(templateId, { grade: lesson.grade, seed, atoms: lesson.atoms });
        expect(lesson.atoms).toContain(instance.srs_tags[0]);
      }
    });
  }
});
