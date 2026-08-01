import { generate } from '../engine/generators';
import { validate } from '../engine/validator';
import { musicToAbc } from '../music/abc-emitter';
import { SET_SIZE } from '../learn/exercise-set';
import {
  assertAtomResolves,
  assertNoCrossDocDuplicateIds,
  assertUnlockGraph,
  loadDoc,
  LESSONS,
  LESSONS_BY_GRADE,
  lessonById,
  lessonsForGrade,
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

  // fyu.5 — alto clef opens at grade 4 only; grades 1-3 must keep rejecting it
  // (grade 1's rejection is already covered above by the malformed-atom table).
  test('note_read:alto:C4 resolves at grade 4 but not grades 1-3', () => {
    expect(() => assertAtomResolves('note_read:alto:C4', 4)).not.toThrow();
    expect(() => assertAtomResolves('note_read:alto:C4', 1)).toThrow();
    expect(() => assertAtomResolves('note_read:alto:C4', 2)).toThrow();
    expect(() => assertAtomResolves('note_read:alto:C4', 3)).toThrow();
  });

  // fyu.5 — octave_transposition widens from grade-3-only to grades 3 and 4
  // (grade 4 always involves alto); grades 1/2 and 5 must still reject it.
  // The atom's gate mirrors octave-transposition.ts's own build() lock, so both
  // ends of the supported band are pinned: grades 1 and 2 have no clef pair to
  // transpose between, and grade 6 does not exist.
  test('transpose:octave resolves at grades 3 to 5, but not grade 1 or 2', () => {
    for (const grade of [3, 4, 5]) expect(() => assertAtomResolves('transpose:octave', grade)).not.toThrow();
    expect(() => assertAtomResolves('transpose:octave', 1)).toThrow();
    expect(() => assertAtomResolves('transpose:octave', 2)).toThrow();
  });

  // 570.U3 — the metre gate accepts the nine new metres at grade 4 (metre-scoped
  // renderable path); grade 3 still rejects them.
  test.each(['metre:2/8', 'metre:6/16', 'metre:6/4', 'metre:12/16'])(
    '%s resolves at grade 4 but not grade 3',
    (atom) => {
      expect(() => assertAtomResolves(atom, 4)).not.toThrow();
      expect(() => assertAtomResolves(atom, 3)).toThrow();
    },
  );

  // 570.U3 (Codex C2/C9) — the metre-scoped path must NOT leak the new metres
  // into the duplet/anacrusis gates, which still check the global renderable set.
  test('the new metres stay OUT of the duplet and anacrusis gates at grade 4', () => {
    expect(() => assertAtomResolves('duplet:6/16', 4)).toThrow();
    expect(() => assertAtomResolves('duplet:6/4', 4)).toThrow();
    expect(() => assertAtomResolves('anacrusis:2/8', 4)).toThrow();
    expect(() => assertAtomResolves('anacrusis:4/8', 4)).toThrow();
  });

  // chromaticly-9ig — a double-accidental note_read atom RESOLVES at the loader
  // (its accidental strip is now global, so F##4 reduces to natural F, which is
  // in range). The grade-4-only gate for double accidentals lives in the
  // validator, not atom-resolution — proven in note-naming.test.ts.
  test('double-accidental note_read atoms resolve (loader strips both accidentals)', () => {
    expect(() => assertAtomResolves('note_read:treble:F##4', 4)).not.toThrow();
    expect(() => assertAtomResolves('note_read:bass:Bbb3', 4)).not.toThrow();
    // A single-accidental atom still resolves identically (no regression).
    expect(() => assertAtomResolves('note_read:treble:F#4', 4)).not.toThrow();
  });

  // chromaticly-gni — rest:<duration> atoms are grade-gated on scope.rests,
  // cumulative like note values: basic rests at grade 1, demisemiquaver at
  // grade 3, breve at grade 4.
  test('rest:crotchet resolves at grade 1; rest:demisemiquaver and rest:breve do not', () => {
    expect(() => assertAtomResolves('rest:crotchet', 1)).not.toThrow();
    expect(() => assertAtomResolves('rest:semibreve', 1)).not.toThrow();
    expect(() => assertAtomResolves('rest:demisemiquaver', 1)).toThrow();
    expect(() => assertAtomResolves('rest:breve', 1)).toThrow();
  });

  test('rest:demisemiquaver resolves at grade 3 but not grade 2; rest:breve still throws at grade 3', () => {
    expect(() => assertAtomResolves('rest:demisemiquaver', 3)).not.toThrow();
    expect(() => assertAtomResolves('rest:demisemiquaver', 2)).toThrow();
    expect(() => assertAtomResolves('rest:breve', 3)).toThrow();
  });

  test('rest:breve resolves at grade 4 only', () => {
    expect(() => assertAtomResolves('rest:breve', 4)).not.toThrow();
    expect(() => assertAtomResolves('rest:breve', 3)).toThrow();
  });

  test('a malformed rest atom (unknown or missing duration) throws', () => {
    expect(() => assertAtomResolves('rest:wibble', 4)).toThrow();
    expect(() => assertAtomResolves('rest:crotchet:x', 4)).toThrow();
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
  test('LESSONS_BY_GRADE[2] has the single linear key-signatures-2 -> ... -> music-in-context-2 chain', () => {
    expect(LESSONS_BY_GRADE[2].map((l) => l.id)).toEqual([
      'key-signatures-2',
      'minor-keys-2',
      'minor-scales-2',
      'degrees-2',
      'tonic-triads-2',
      'ledger-lines-2',
      'intervals-2',
      'time-signatures-2',
      'triplets-2',
      'grouping-2',
      'tempo-2',
      'expression-2',
      'signs-2',
      'music-in-context-2',
    ]);
  });

  test('lessonById resolves the grade-2 lesson stamped grade 2', () => {
    const lesson = lessonById('key-signatures-2');
    expect(lesson).toBeTruthy();
    expect(lesson!.grade).toBe(2);
  });

  test('the grade-2 units are in the merged LESSONS list, after grade-1', () => {
    expect(LESSONS.map((l) => l.id)).toEqual(expect.arrayContaining(['key-signatures-2', 'minor-keys-2', 'minor-scales-2', 'degrees-2', 'tonic-triads-2']));
  });
});

// U5 (grade3-melodic-minor plan, D7) — the grade-3 doc registers alongside
// grade-1/2 (see registration in lessons.ts); grade-3 content validates
// against grade-3 scope, the same teeth grade-1/2 content already goes
// through above.
describe('grade3 lessons — the bundled doc loads and cross-checks clean', () => {
  // major-keys-3 leads the chain (chromaticly-e3z.1): the ABRSM Grade 3 syllabus
  // requires ALL keys to four sharps and flats, and grade 3 previously taught only
  // minors — A major sat a grade early in grade 2, E and A♭ major a grade late in
  // grade 4. Majors before minors, since a minor key is taught as the relative of
  // a major one.
  test('LESSONS_BY_GRADE[3] chain: major-keys-3 -> minor-keys-3 -> ... -> rests-3 -> intervals-3 ...', () => {
    expect(LESSONS_BY_GRADE[3].map((l) => l.id)).toEqual([
      'major-keys-3',
      'minor-keys-3',
      'degrees-3',
      'tonic-triads-3',
      'character-3',
      'expression-3',
      'directions-3',
      'minor-scales-3',
      'melodic-minor-3',
      'compound-time-3',
      'compound-bars-3',
      'rests-3',
      'grouping-3',
      'intervals-3',
      'ledger-lines-3',
      'music-in-context-3',
      'anacrusis-3',
      'transposition-3',
    ]);
  });

  test('lessonById resolves the grade-3 lesson stamped grade 3', () => {
    const lesson = lessonById('minor-keys-3');
    expect(lesson).toBeTruthy();
    expect(lesson!.grade).toBe(3);
  });

  test('the grade-3 units are in the merged LESSONS list, after grade-2, ending on the terminal lesson', () => {
    expect(LESSONS.map((l) => l.id)).toEqual(
      expect.arrayContaining([
        'minor-keys-3',
        'minor-scales-3',
        'melodic-minor-3',
        'compound-time-3',
        'compound-bars-3',
        'intervals-3',
        'ledger-lines-3',
        'anacrusis-3',
        'transposition-3',
      ]),
    );
    // The merged list ends on the highest registered grade's terminal lesson.
    // Grade 5 now appends after grade 4 (chromaticly-ehp), so the tail is grade
    // 5's terminal (unlocks: null) — asserted structurally, not by a hardcoded
    // id that would churn as grade-5 slices extend the chain.
    const last = LESSONS[LESSONS.length - 1];
    expect(last.grade).toBe(5);
    expect(last.unlocks).toBeNull();
  });
});

// chromaticly-1v5.6 — the new grade-3 note-reading lesson: single-template
// discipline (mirrors intervals-3, D7) and grade-gated ledger-line atoms
// (the pitches only resolve once GRADE_3_SCOPE.pitchRanges widens past grade 2).
describe('ledger-lines-3 lesson (chromaticly-1v5.6)', () => {
  test('strand is pitch, and both note-reading shapes are served (chromaticly-lgi)', () => {
    const lesson = lessonById('ledger-lines-3');
    expect(lesson).toBeTruthy();
    expect(lesson!.strand).toBe('pitch');
    expect(lesson!.templates).toEqual(['note_naming', 'note_naming_stave_input']);
  });

  test('every ledger-lines-3 atom resolves at grade 3', () => {
    const lesson = lessonById('ledger-lines-3')!;
    for (const atom of lesson.atoms) {
      expect(() => assertAtomResolves(atom, 3)).not.toThrow();
    }
  });

  // Every declared atom pitch sits beyond grade 2's A3-C6/C2-E4 range by
  // construction (that's the point of the lesson) — so every one of them
  // must throw at grade 2, not just a hand-picked example.
  test('every ledger-lines-3 atom pitch is outside the grade-2 range and throws at grade 2', () => {
    const lesson = lessonById('ledger-lines-3')!;
    for (const atom of lesson.atoms) {
      expect(() => assertAtomResolves(atom, 2)).toThrow();
    }
  });
});

// The Grade 3 anacrusis slice: single-template discipline (mirrors
// intervals-3/ledger-lines-3, D7).
describe('anacrusis-3 lesson (chromaticly-1v5.3)', () => {
  // Counting the upbeat and completing the closing bar are the two halves of
  // the same ABRSM rule (chromaticly-lgi), so the lesson now alternates them.
  test('strand is rhythm and it pairs both halves of the anacrusis rule, unlocking transposition-3 (D10 merge rule)', () => {
    const lesson = lessonById('anacrusis-3');
    expect(lesson).toBeTruthy();
    expect(lesson!.strand).toBe('rhythm');
    expect(lesson!.templates).toEqual(['anacrusis_recognition', 'anacrusis_final_bar']);
    expect(lesson!.unlocks).toBe('transposition-3');
  });

  test('every anacrusis-3 atom resolves at grade 3 and throws at grades 1/2 (rhythmDevices gate, D6)', () => {
    const lesson = lessonById('anacrusis-3')!;
    for (const atom of lesson.atoms) {
      expect(() => assertAtomResolves(atom, 3)).not.toThrow();
      expect(() => assertAtomResolves(atom, 1)).toThrow();
      expect(() => assertAtomResolves(atom, 2)).toThrow();
    }
  });
});

// U8 (octave-transposition slice, D10): the new grade-3 terminal lesson —
// single-template discipline (mirrors anacrusis-3/intervals-3, D7) and the
// transpose:octave atom, which resolves at grades 3 and 4 (the generator's
// own grade gate, octave-transposition.ts's build()) — grade 4 is exercised
// separately above (assertAtomResolves scoping describe block).
describe('transposition-3 lesson (U8)', () => {
  test('strand is pitch and it carries the single template octave_transposition, unlocking nothing (the new grade-3 terminal)', () => {
    const lesson = lessonById('transposition-3');
    expect(lesson).toBeTruthy();
    expect(lesson!.strand).toBe('pitch');
    expect(lesson!.templates).toEqual(['octave_transposition']);
    expect(lesson!.unlocks).toBeNull();
  });

  test('every transposition-3 atom resolves at grade 3 and throws at grades 1/2 (generator-grade lock, not just a scope flag)', () => {
    const lesson = lessonById('transposition-3')!;
    for (const atom of lesson.atoms) {
      expect(() => assertAtomResolves(atom, 3)).not.toThrow();
      expect(() => assertAtomResolves(atom, 1)).toThrow();
      expect(() => assertAtomResolves(atom, 2)).toThrow();
    }
  });
});

// U4 (plan 2026-07-20-002, D8) — the new grade-3 interval-quality lesson:
// single-template discipline (D7 — the stave-input variant stays number-only
// and is deliberately not bundled in) and grade-gated atoms (D4).
describe('intervals-3 lesson (U4, D8)', () => {
  // The write-the-note shape reads intervals-3's own interval_type atoms
  // (chromaticly-lgi), so naming and writing an interval now alternate.
  test('strand is intervals and it pairs naming with writing', () => {
    const lesson = lessonById('intervals-3');
    expect(lesson).toBeTruthy();
    expect(lesson!.strand).toBe('intervals');
    expect(lesson!.templates).toEqual(['interval_naming', 'interval_naming_stave_input']);
  });

  test('every intervals-3 atom resolves at grade 3 and throws at grade 2 (D4 namingStyle gate)', () => {
    const lesson = lessonById('intervals-3')!;
    for (const atom of lesson.atoms) {
      expect(() => assertAtomResolves(atom, 3)).not.toThrow();
      expect(() => assertAtomResolves(atom, 2)).toThrow();
    }
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

  // U5 (D6): the parameterized add_time_signature:<sig> grammar — resolves
  // only where the signature is both in scope AND renderable at that grade.
  test('add_time_signature:6/8 resolves at grade 3 but not grade 2 (not in scope/renderable)', () => {
    expect(() => assertAtomResolves('add_time_signature:6/8', 3)).not.toThrow();
    expect(() => assertAtomResolves('add_time_signature:6/8', 2)).toThrow();
  });

  // 2/2 is in scope from grade 2 (GRADE_2_SCOPE.timeSignatures) but never
  // renderable at any grade (D2) — scope membership alone isn't enough.
  // The minim-beat metres and 3/8 are renderable from grade 2 up (e3z.9).
  test('add_time_signature:2/2 resolves at grade 2 and 3, and 2/8 still throws', () => {
    expect(() => assertAtomResolves('add_time_signature:2/2', 2)).not.toThrow();
    expect(() => assertAtomResolves('add_time_signature:2/2', 3)).not.toThrow();
    expect(() => assertAtomResolves('add_time_signature:3/8', 2)).not.toThrow();
    expect(() => assertAtomResolves('add_time_signature:2/2', 1)).toThrow();
    expect(() => assertAtomResolves('add_time_signature:2/8', 3)).toThrow();
  });

  test('the bare add_time_signature atom still resolves at grade 1 (the legacy grammar untouched)', () => {
    expect(() => assertAtomResolves('add_time_signature', 1)).not.toThrow();
  });

  // U6 (D7): the metre:<sig> grammar — resolves only where the signature is
  // both in scope AND renderable at that grade (mirrors add_time_signature's
  // parameterized-atom discipline).
  test('metre:6/8 resolves at grade 3 but not grade 2 (not in scope/renderable)', () => {
    expect(() => assertAtomResolves('metre:6/8', 3)).not.toThrow();
    expect(() => assertAtomResolves('metre:6/8', 2)).toThrow();
  });

  test('metre:2/2 resolves at grade 2 and 3, and the grade-4 metres still throw', () => {
    expect(() => assertAtomResolves('metre:2/2', 2)).not.toThrow();
    expect(() => assertAtomResolves('metre:2/2', 3)).not.toThrow();
    expect(() => assertAtomResolves('metre:2/2', 1)).toThrow();
    expect(() => assertAtomResolves('metre:6/16', 3)).toThrow();
  });

  // U3 (plan 2026-07-20-002), D4: the number+type interval atom is gated on
  // namingStyle, not a hardcoded grade — resolves at grade 3+ and throws at
  // grade 1/2, where the bare `interval:<n>` atom is still the correct grammar.
  test('interval_type:5 resolves at grade 3 but throws at grade 2 (namingStyle-gated, not just number-in-range)', () => {
    expect(() => assertAtomResolves('interval_type:5', 3)).not.toThrow();
    expect(() => assertAtomResolves('interval_type:5', 2)).toThrow();
  });

  test('a bare interval:5 atom still resolves at grade 1 — the legacy grammar is untouched by D4', () => {
    expect(() => assertAtomResolves('interval:5', 1)).not.toThrow();
  });

  // U2 (anacrusis slice, D5/D6): the anacrusis:<sig> grammar resolves only
  // where the grade scopes 'anacrusis' as a rhythm device AND the signature
  // is a simple, renderable one — a Grade 3-only device with no compound form.
  test('anacrusis:3/4 resolves at grade 3 but throws at grades 1/2 (rhythmDevices gate, not just renderability)', () => {
    expect(() => assertAtomResolves('anacrusis:3/4', 3)).not.toThrow();
    expect(() => assertAtomResolves('anacrusis:3/4', 1)).toThrow();
    expect(() => assertAtomResolves('anacrusis:3/4', 2)).toThrow();
  });

  test('anacrusis:6/8 throws at grade 3 — compound anacrusis is out of scope (D3)', () => {
    expect(() => assertAtomResolves('anacrusis:6/8', 3)).toThrow();
  });

  test('a malformed anacrusis atom (extra colon-part) throws', () => {
    expect(() => assertAtomResolves('anacrusis:3/4:x', 3)).toThrow();
  });
});

// chromaticly-gni — rests-1: rests are introduced at Grade 1 via rest_completion
// ("which rest completes this bar?"), inserted between note-values and
// key-signatures. First rest content in the course.
describe('rests-1 lesson (chromaticly-gni)', () => {
  const lesson = () => lessonById('rests-1')!;

  test('exists, strand rhythm, both rest shapes (chromaticly-lgi)', () => {
    expect(lesson()).toBeTruthy();
    expect(lesson().grade).toBe(1);
    expect(lesson().strand).toBe('rhythm');
    expect(lesson().templates).toEqual(['rest_completion', 'rest_value_id']);
  });

  // The Grade 1 chain was INTERLEAVED by strand (pedagogy audit, 2026-07-29): a
  // learner used to meet 24 note-naming questions before a single note value. The
  // invariant that survives the reorder is not a fixed pair of neighbours, it is
  // that rests-1 comes after the lesson that teaches note values — you cannot
  // complete a bar you cannot count.
  test('rests-1 comes after note-values, the lesson it depends on', () => {
    const order = lessonsForGrade(1).map((l) => l.id);
    expect(order.indexOf('rests-1')).toBeGreaterThan(order.indexOf('note-values'));
  });

  test('no two consecutive Grade 1 lessons share a strand', () => {
    const strands = lessonsForGrade(1).map((l) => l.strand);
    const runs = strands.filter((s, i) => i > 0 && s === strands[i - 1]);
    expect(runs).toEqual([]);
  });

  test('every atom resolves at grade 1; the later-grade rests are not present', () => {
    for (const atom of lesson().atoms) {
      expect(() => assertAtomResolves(atom, 1)).not.toThrow();
    }
    expect(lesson().atoms).not.toContain('rest:demisemiquaver');
    expect(lesson().atoms).not.toContain('rest:breve');
  });

  // Every generated item in a set is validator-clean and asks a rest from the
  // lesson's own atoms; the set is non-degenerate (several distinct rests asked).
  test('a set is validator-clean, tags only this lesson\'s rests, and shows variety', () => {
    const asked = new Set<string>();
    for (let seed = 0; seed < SET_SIZE; seed++) {
      const inst = generate('rest_completion', { grade: 1, seed, atoms: lesson().atoms });
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
      expect(lesson().atoms).toContain(inst.srs_tags[0]);
      asked.add(inst.answer.canonical);
    }
    expect(asked.size).toBeGreaterThanOrEqual(3);
  });
});

// chromaticly-gni — rests-3: the smaller rests (demisemiquaver added at G3),
// inserted after compound-bars-3.
describe('rests-3 lesson (chromaticly-gni)', () => {
  const lesson = () => lessonById('rests-3')!;

  test('exists, strand rhythm, both rest shapes (chromaticly-lgi)', () => {
    expect(lesson()).toBeTruthy();
    expect(lesson().grade).toBe(3);
    expect(lesson().strand).toBe('rhythm');
    expect(lesson().templates).toEqual(['rest_completion', 'rest_value_id']);
  });

  test('the chain splices compound-bars-3 -> rests-3 -> grouping-3', () => {
    expect(lessonById('compound-bars-3')!.unlocks).toBe('rests-3');
    expect(lesson().unlocks).toBe('grouping-3');
    expect(lessonById('grouping-3')!.unlocks).toBe('intervals-3');
  });

  test('the demisemiquaver rest resolves at grade 3 but not grade 2', () => {
    expect(lesson().atoms).toContain('rest:demisemiquaver');
    for (const atom of lesson().atoms) expect(() => assertAtomResolves(atom, 3)).not.toThrow();
    expect(() => assertAtomResolves('rest:demisemiquaver', 2)).toThrow();
  });

  test('a set is validator-clean and tags only this lesson\'s rests', () => {
    for (let seed = 0; seed < SET_SIZE; seed++) {
      const inst = generate('rest_completion', { grade: 3, seed, atoms: lesson().atoms });
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
      expect(lesson().atoms).toContain(inst.srs_tags[0]);
    }
  });
});

// chromaticly-gni — rests-4: the breve rest, the Grade-4 capstone of the rests
// arc, inserted after rhythm-breve-4 (the breve note).
describe('rests-4 lesson (chromaticly-gni)', () => {
  const lesson = () => lessonById('rests-4')!;

  test('exists, strand rhythm, both rest shapes (chromaticly-lgi)', () => {
    expect(lesson()).toBeTruthy();
    expect(lesson().grade).toBe(4);
    expect(lesson().strand).toBe('rhythm');
    expect(lesson().templates).toEqual(['rest_completion', 'rest_value_id']);
  });

  test('the chain splices rhythm-breve-4 -> rests-4 -> rhythm-doubledot-4', () => {
    expect(lessonById('rhythm-breve-4')!.unlocks).toBe('rests-4');
    expect(lesson().unlocks).toBe('rhythm-doubledot-4');
  });

  test('rest:breve resolves at grade 4 only', () => {
    expect(lesson().atoms).toContain('rest:breve');
    for (const atom of lesson().atoms) expect(() => assertAtomResolves(atom, 4)).not.toThrow();
    expect(() => assertAtomResolves('rest:breve', 3)).toThrow();
  });

  // The breve rest (8 beats) must be reachable in a set and validator-clean — it
  // is hostable only in the generator's big bars (9/4, 12/4), so this exercises
  // the KTD7 units table + time-signature policy end to end.
  test('the breve rest is asked within a set, in a big bar, validator-clean', () => {
    const asked = new Set<string>();
    let sawBreveBar = false;
    for (let seed = 0; seed < SET_SIZE; seed++) {
      const inst = generate('rest_completion', { grade: 4, seed, atoms: lesson().atoms });
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
      expect(lesson().atoms).toContain(inst.srs_tags[0]);
      asked.add(inst.answer.canonical);
      if (inst.answer.canonical === 'breve rest') {
        sawBreveBar = true;
        expect(['9/4', '12/4']).toContain((inst.stimulus.music as { time_sig: string }).time_sig);
      }
    }
    expect(asked.has('breve rest')).toBe(true);
    expect(sawBreveBar).toBe(true);
  });
});

// chromaticly-2fc — rhythm-doubledot-4 must actually ASSESS double-dotted
// rhythms. Uniform target selection left the deterministic 8-item set with zero
// double-dotted items; the lesson now scopes rhythm_sum via a `double_dot` atom.
describe('rhythm-doubledot-4 lesson (chromaticly-2fc)', () => {
  const lesson = () => lessonById('rhythm-doubledot-4')!;

  test('scopes rhythm_sum to the double-dot atom (grade-4 only)', () => {
    expect(lesson().atoms).toEqual(['rhythm_sum:double_dot']);
    expect(() => assertAtomResolves('rhythm_sum:double_dot', 4)).not.toThrow();
    expect(() => assertAtomResolves('rhythm_sum:double_dot', 3)).toThrow();
    // A bare rhythm_sum atom still resolves at every grade (grade-1 note-values).
    expect(() => assertAtomResolves('rhythm_sum', 1)).not.toThrow();
  });

  // The whole point of the lesson: EVERY item in the real per-set seed range
  // targets a double-dotted value — the regression this fixes was zero of them.
  test('every item in the deterministic set targets a double-dotted rhythm', () => {
    for (let seed = 0; seed < SET_SIZE; seed++) {
      const inst = generate('rhythm_sum', { grade: 4, seed, atoms: lesson().atoms });
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
      expect((inst.answer.canonical as { dots: number }).dots).toBe(2);
      expect(inst.srs_tags[0]).toBe('rhythm_sum:double_dot');
    }
  });
});

// chromaticly-ra3 — clef-equivalence-4: the same sounding pitch reads at a
// different staff position in each clef. Spliced after alto-transposition-4,
// reusing the new clef_equivalence generator (delta-0 clef rewrite).
describe('clef-equivalence-4 lesson (chromaticly-ra3)', () => {
  const lesson = () => lessonById('clef-equivalence-4')!;

  test('exists, strand pitch, single template clef_equivalence', () => {
    expect(lesson()).toBeTruthy();
    expect(lesson().grade).toBe(4);
    expect(lesson().strand).toBe('pitch');
    expect(lesson().templates).toEqual(['clef_equivalence']);
  });

  test('the chain splices alto-transposition-4 -> clef-equivalence-4 -> chords-4', () => {
    expect(lessonById('alto-transposition-4')!.unlocks).toBe('clef-equivalence-4');
    expect(lesson().unlocks).toBe('chords-4');
  });

  test('atom clef_equiv:cross resolves at grade 4 only', () => {
    expect(lesson().atoms).toEqual(['clef_equiv:cross']);
    expect(() => assertAtomResolves('clef_equiv:cross', 4)).not.toThrow();
    expect(() => assertAtomResolves('clef_equiv:cross', 3)).toThrow();
  });

  // The generated set stays a valid, same-octave clef rewrite: answer pitches
  // match the source pitches note-for-note, on a different clef.
  test('every set item is a validator-clean, same-pitch rewrite on a different clef', () => {
    for (let seed = 0; seed < SET_SIZE; seed++) {
      const inst = generate('clef_equivalence', { grade: 4, seed, atoms: lesson().atoms });
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
      const music = inst.stimulus.music as { clef: string };
      const answerClef = (inst.interaction.config as { answerClef: string }).answerClef;
      expect(answerClef).not.toBe(music.clef);
      expect(inst.srs_tags[0]).toBe('clef_equiv:cross');
    }
  });
});

// chromaticly-9ig — double-accidentals-4: naming F𝄪 / B𝄫 head-on, reusing
// note_naming. Inserted as the new Grade-4 tail after enharmonics-4. The
// double-accidental scope gate lives in the validator, so the atoms resolve at
// the loader for every grade but only GENERATE clean at grade 4.
describe('double-accidentals-4 lesson (chromaticly-9ig)', () => {
  const lesson = () => lessonById('double-accidentals-4')!;

  // Naming a double accidental and knowing what it sounds like are different
  // skills (chromaticly-lgi), so the lesson alternates the two.
  test('exists, strand pitch, pairs naming with sounds-as, is the chain tail', () => {
    expect(lesson()).toBeTruthy();
    expect(lesson().grade).toBe(4);
    expect(lesson().strand).toBe('pitch');
    expect(lesson().templates).toEqual(['note_naming', 'note_sounds_as']);
    expect(lessonById('enharmonics-4')!.unlocks).toBe('double-accidentals-4');
    expect(lesson().unlocks).toBeNull();
  });

  test('atoms are double-accidental note_read pitches, resolving at the loader', () => {
    expect(lesson().atoms).toEqual([
      'note_read:treble:F##4',
      'note_read:treble:G##4',
      'note_read:bass:Bbb3',
      'note_read:bass:Ebb3',
    ]);
    for (const atom of lesson().atoms) expect(() => assertAtomResolves(atom, 4)).not.toThrow();
  });

  // The double accidental is in scope only at Grade 4 — a below-grade generate
  // must throw (the validator gate, not atom resolution, is what enforces it).
  test('names spell out the accidental, validate clean, and are grade-4-gated', () => {
    const canon = new Set<string>();
    for (let seed = 0; seed < SET_SIZE; seed++) {
      const inst = generate('note_naming', { grade: 4, seed, atoms: lesson().atoms });
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
      expect(inst.answer.canonical).toMatch(/^[A-G] double (sharp|flat)$/);
      canon.add(inst.answer.canonical);
    }
    expect([...canon].some((c) => c.endsWith('double sharp'))).toBe(true);
    expect([...canon].some((c) => c.endsWith('double flat'))).toBe(true);
    expect(() => generate('note_naming', { grade: 3, seed: 0, atoms: ['note_read:treble:F##4'] })).toThrow();
  });
});

// chromaticly-fm9 — major-keys-4: B major (5 sharps) and D♭ major (5 flats)
// become named, ASSESSED major keys, reusing the existing key_signature_id
// template. keys-4 teach copy already names them; this lesson is the first to
// ask them as the answer to a key-signature MCQ. Contrast keys E major (4#) and
// A♭ major (4b) sit in the pool so telling the keys apart requires counting the
// signature, not just reading sharps-vs-flats.
describe('major-keys-4 lesson (chromaticly-fm9)', () => {
  const lesson = () => lessonById('major-keys-4')!;

  test('exists, strand scales_keys, single template key_signature_id', () => {
    expect(lesson()).toBeTruthy();
    expect(lesson().grade).toBe(4);
    expect(lesson().strand).toBe('scales_keys');
    expect(lesson().templates).toEqual(['key_signature_id']);
  });

  test('the chain rethreads keys-4 -> major-keys-4 -> minor-scales-4', () => {
    expect(lessonById('keys-4')!.unlocks).toBe('major-keys-4');
    expect(lesson().unlocks).toBe('minor-scales-4');
  });

  test('every atom resolves at grade 4; the new major keys throw at grade 3', () => {
    for (const atom of lesson().atoms) {
      expect(() => assertAtomResolves(atom, 4)).not.toThrow();
    }
    expect(() => assertAtomResolves('key_sig:B_major', 3)).toThrow();
    expect(() => assertAtomResolves('key_sig:Db_major', 3)).toThrow();
  });

  // C2 — THE invariant the atom ORDER is chosen to satisfy. key_signature_id
  // picks the asked key with one rng draw per item (key-signature-id.ts:69);
  // over the deterministic per-set seed range (0..SET_SIZE-1, SetRunner.tsx:70)
  // the draw never lands the pool's index-0 key, so both focus keys must sit on
  // drawn indices. If a future edit reorders atoms and drops a focus key from
  // the set, this fails loud — the learner would complete the set never seeing
  // one of the two keys the lesson exists to teach.
  test('both B major and D♭ major are asked within one set (seeds 0..SET_SIZE-1)', () => {
    const asked = Array.from({ length: SET_SIZE }, (_, seed) =>
      generate('key_signature_id', { grade: 4, seed, atoms: lesson().atoms }).answer.canonical,
    );
    expect(asked).toContain('B major');
    expect(asked).toContain('Db major');
  });

  // C3 — the generator's canonical answer is ASCII ("Db major"), even though
  // teach copy renders it "D♭ major". Grading is a plain string equal, so the
  // canonical must stay ASCII or every D♭ item would grade as wrong.
  test('the D♭ canonical answer is ASCII "Db major", not "D♭ major"', () => {
    const asked = Array.from({ length: SET_SIZE }, (_, seed) =>
      generate('key_signature_id', { grade: 4, seed, atoms: lesson().atoms }).answer.canonical,
    );
    const db = asked.filter((k) => k.startsWith('D'));
    expect(db.length).toBeGreaterThan(0);
    for (const k of db) expect(k).toBe('Db major');
  });

  // C4 (R-alto) — grade 4 opens the alto clef, so a 5-accidental signature can
  // render on it. Prove the emitter handles alto + 5 sharps: the ABC K-line must
  // carry both the key and clef=alto. abcjs's on-device render is the U2 gate;
  // this pins that the ABC we hand it is well-formed.
  test('a 5-sharp signature emits valid alto-clef ABC (K:B clef=alto)', () => {
    const abc = musicToAbc({
      clef: 'alto',
      key_sig: 'B_major',
      time_sig: null,
      voices: [{ events: [{ type: 'note', pitch: 'B3', dur: 'semibreve' }] }],
    });
    expect(abc).toContain('K:B clef=alto');
  });

  // C5 — a Practice due-path can scope a single atom; key_signature_id needs >=2
  // key atoms for a closed MCQ and throws below that (key-signature-id.ts:37).
  // Adding B/D♭ atoms widens the set that can hit this PRE-EXISTING boundary
  // (mirrors practice-plan.test.ts:134). Pinned here so the throw stays loud and
  // is not mistaken for a regression this slice introduced.
  test('a single-atom scope throws (pre-existing closed-MCQ boundary, not new debt)', () => {
    expect(() => generate('key_signature_id', { grade: 4, seed: 0, atoms: ['key_sig:B_major'] })).toThrow();
  });
});

// U6 (SATB "name the voice" plan, chromaticly-0iy) — the new Grade-5 terminal
// lesson: reuses the U4 satb_voice_recognition generator + U5 voice_options
// interaction, atoms gated by the new 'satb_voice' case in assertAtomResolves.
describe('satb-voice-5 lesson (U6, chromaticly-0iy)', () => {
  const lesson = () => lessonById('satb-voice-5')!;

  test('exists, strand pitch, single template satb_voice_recognition, unlocks the voices lesson', () => {
    expect(lesson()).toBeTruthy();
    expect(lesson().grade).toBe(5);
    expect(lesson().strand).toBe('pitch');
    expect(lesson().templates).toEqual(['satb_voice_recognition']);
    expect(lessonById('irregular-divisions-5')!.unlocks).toBe('satb-voice-5');
    // instruments-5 sits between it and the tail (chromaticly-e3z.16).
    expect(lesson().unlocks).toBe('instruments-5');
    expect(lessonById('instruments-5')!.unlocks).toBe('music-in-context-5');
  });

  test('carries the four satb_voice:* atoms, resolving at grade 5 only', () => {
    expect(lesson().atoms).toEqual(['satb_voice:soprano', 'satb_voice:alto', 'satb_voice:tenor', 'satb_voice:bass']);
    for (const atom of lesson().atoms) {
      expect(() => assertAtomResolves(atom, 5)).not.toThrow();
      expect(() => assertAtomResolves(atom, 4)).toThrow();
    }
  });

  // The atom<->generator mismatch guard (per the plan's Execution note): scope
  // generation to ONE atom at a time so the generator is forced to target that
  // exact voice — if any of the four voice atoms didn't resolve into a
  // generator-servable exercise, this is where it would surface, not just "some
  // atom in the set generates something."
  test('each of the four satb_voice:* atoms alone resolves to a servable, validator-clean exercise naming that voice', () => {
    for (const atom of lesson().atoms) {
      const voice = atom.split(':')[1];
      const inst = generate('satb_voice_recognition', { grade: 5, seed: 0, atoms: [atom] });
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
      expect(inst.answer.canonical).toBe(voice);
      expect(inst.strand).toBe('pitch');
    }
  });

  test('the lesson is reachable from the G5 entry via the unlock chain', () => {
    expect(() => assertUnlockGraph(LESSONS_BY_GRADE[5])).not.toThrow();
    expect(LESSONS_BY_GRADE[5].map((l) => l.id)).toContain('satb-voice-5');
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
