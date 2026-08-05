import { creditedAtoms, LESSONS, LESSONS_BY_GRADE, lessonById, type Lesson } from '../content/lessons';
import { isByEarAtom } from '../engine/atoms';
import { generate } from '../engine/generators';
import { validate } from '../engine/validator';
import { attemptedAtomSet, attemptedTemplates, nextPracticeTemplate, type PracticePick } from './practice-plan';
import { ProgressStore } from './store';
import { initialSrs, reviewSrs, type SrsState } from './srs';

const firstLesson = LESSONS[0];
const grade2Lesson = LESSONS_BY_GRADE[2][0];

/** Every atom of `lessons`, attempted and NOT due — so selection falls through to
 *  the rotation path, which is what these fixtures are exercising. Since G6 U3 the
 *  entries ARE the eligibility set: there is no unlock predicate to pass. */
const attempted = (lessons: Lesson[], now = 0): { atom: string; srs: SrsState }[] => {
  const seen = new Set<string>();
  const entries: { atom: string; srs: SrsState }[] = [];
  for (const lesson of lessons) {
    for (const atom of lesson.atoms) {
      if (seen.has(atom)) continue; // an atom shared across lessons is one attempt, not two
      seen.add(atom);
      entries.push({ atom, srs: reviewSrs(initialSrs(now), true, now) }); // box 1 → due tomorrow
    }
  }
  return entries;
};

// D12's rotation unit is the (lesson, template) pair — one per template a lesson
// with an attempted atom lists. Computed independently here (not by reaching into
// practice-plan's private pair builder) so a full cycle can be walked as a black box.
const pairCount = (entries: { atom: string }[]): number => {
  const set = attemptedAtomSet(entries);
  return LESSONS.filter((l) => l.atoms.some((a) => set.has(a))).reduce((sum, l) => sum + l.templates.length, 0);
};

const fullRotationCycle = (entries: { atom: string; srs: SrsState }[]): PracticePick[] => {
  const picks: PracticePick[] = [];
  for (let step = 0; step < pairCount(entries); step++) {
    const pick = nextPracticeTemplate(entries, 0, step);
    if (pick) picks.push(pick);
  }
  return picks;
};

describe('practice-plan — eligibility is per-atom, not per-lesson (R4)', () => {
  test('attemptedTemplates and attemptedAtomSet follow what has been attempted', () => {
    const entries = attempted([firstLesson]);
    expect(attemptedTemplates(attemptedAtomSet(entries))).toEqual(firstLesson.templates);
    const atoms = attemptedAtomSet(entries);
    expect(atoms.has(firstLesson.atoms[0])).toBe(true);
    // an atom from a lesson the learner has never touched is excluded
    const untouched = LESSONS[LESSONS.length - 1].atoms[0];
    expect(atoms.has(untouched)).toBe(false);
  });
});

describe('practice-plan — nextPracticeTemplate', () => {
  test('returns null when nothing has been attempted — Practice is retention, and there is nothing to retain', () => {
    expect(nextPracticeTemplate([], 0, 0)).toBeNull();
  });

  test('falls back to a rotating template, scoped to the ATTEMPTED atoms of its owning lesson', () => {
    const pick = nextPracticeTemplate(attempted([firstLesson]), 0, 0);
    expect(pick).not.toBeNull();
    expect(firstLesson.templates).toContain(pick!.template);
    expect(pick!.atoms.length).toBeGreaterThan(0);
    expect(pick!.atoms).toEqual(firstLesson.atoms);
  });

  test('serves a due atom scoped to exactly that atom (per-atom review)', () => {
    const dueAtom = firstLesson.atoms[0];
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5); // due on day 5
    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, 0);
    expect(pick).not.toBeNull();
    expect(pick!.template).toBe(firstLesson.templates[0]);
    expect(pick!.atoms).toEqual([dueAtom]);
    // a due grade-1 atom must carry grade: 1 — the owning lesson's grade, unchanged
    expect(pick!.grade).toBe(1);
  });

  // R4/R2: an atom attempted inside a lesson that would once have been LOCKED is
  // served like any other. Nothing is gated, so "have you met this atom" is the
  // whole eligibility question.
  test('an atom attempted in a never-completed later-grade lesson is served when due', () => {
    const deep = LESSONS_BY_GRADE[4][LESSONS_BY_GRADE[4].length - 1];
    const dueAtom = deep.atoms[0];
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);
    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, 0);
    expect(pick).not.toBeNull();
    expect(pick!.atoms).toEqual([dueAtom]);
  });

  // The invariant, stated once: the learner is never shown material they have not
  // met. `store.atomEntries()` only ever holds attempted atoms, so this holds for
  // both pick paths — but only because rotation intersects rather than takes the
  // whole lesson (see the F5a regression below).
  test('no pick, on either path, ever carries an atom outside the attempted set', () => {
    const store = new ProgressStore();
    const met = firstLesson.atoms[0];
    store.setAtom(met, { mastery: { streak: 1, mastered: false }, srs: initialSrs(0) });

    for (const now of [0, 1, 9]) {
      for (let step = 0; step < 12; step++) {
        const pick = nextPracticeTemplate(store.atomEntries(), now, step);
        expect(pick!.atoms).toEqual([met]);
      }
    }
  });
});

// F5a, the trap this unit exists to avoid: 11 atom ids appear in two grades of one
// strand. `rest:semibreve` is in both the grade-1 rests lesson and the grade-4 one.
// A "lessons with an attempted atom" scope would make the grade-4 lesson eligible
// off a grade-1 answer, and rotation would then generate its UNATTEMPTED grade-4
// siblings — material the learner has never seen. The pair's atoms are therefore
// the intersection of the lesson's atoms with the attempted set.
describe('practice-plan — REGRESSION: a shared atom does not drag its unattempted siblings in (F5a)', () => {
  const SHARED = 'rest:semibreve';

  test('the fixture is real: rest:semibreve is listed by both a grade-1 and a grade-4 lesson', () => {
    const owners = LESSONS.filter((l) => l.atoms.includes(SHARED));
    expect(owners.map((l) => l.grade)).toEqual(expect.arrayContaining([1, 4]));
  });

  test('attempting only the grade-1 shared atom never emits a grade-4 sibling atom', () => {
    const entries = [{ atom: SHARED, srs: reviewSrs(initialSrs(0), true, 0) }];
    const grade4Owner = LESSONS.find((l) => l.grade === 4 && l.atoms.includes(SHARED))!;
    const siblings = grade4Owner.atoms.filter((a) => a !== SHARED);
    expect(siblings.length).toBeGreaterThan(0); // otherwise this test proves nothing

    for (let step = 0; step < 12; step++) {
      const pick = nextPracticeTemplate(entries, 0, step);
      expect(pick).not.toBeNull();
      expect(pick!.atoms).toEqual([SHARED]);
      for (const sibling of siblings) expect(pick!.atoms).not.toContain(sibling);
    }
  });

  // The other half of the F5a fix: intersecting with the attempted set alone would
  // still let the grade-4 owner emit a pair for the SHARED atom at grade 4, so a
  // learner who has only met it at grade 1 gets a grade-4 stimulus around it.
  // Rotation therefore scopes to the atoms a lesson OWNS (first-owner, the same rule
  // the due path uses), so a shared atom is always reviewed at the grade that taught it.
  test('a shared atom is only ever rotated by its FIRST owner, at that owner’s grade', () => {
    const entries = [{ atom: SHARED, srs: reviewSrs(initialSrs(0), true, 0) }];
    for (let step = 0; step < 12; step++) {
      expect(nextPracticeTemplate(entries, 0, step)!.grade).toBe(1);
    }
  });

  test('fallback scoping: every emitted pair is a subset of the attempted set', () => {
    const entries = attempted([...LESSONS_BY_GRADE[1], ...LESSONS_BY_GRADE[2]]);
    const set = attemptedAtomSet(entries);
    const picks = fullRotationCycle(entries);
    expect(picks.length).toBeGreaterThan(0);
    for (const pick of picks) {
      expect(pick.atoms.length).toBeGreaterThan(0); // an empty intersection is not emitted at all
      for (const atom of pick.atoms) expect(set.has(atom)).toBe(true);
    }
  });
});

// R9: Practice can narrow to one lane. Cross-lane stays the DEFAULT, because
// interleaving strands is the retention benefit — the filter is a deliberate act.
describe('practice-plan — per-lane filter (R9)', () => {
  const everything = attempted([...LESSONS_BY_GRADE[1], ...LESSONS_BY_GRADE[2]]);
  const strandOf = (atom: string) => LESSONS.find((l) => l.atoms.includes(atom))!.strand;

  test('with a strand set, every pick belongs to that lane', () => {
    for (let step = 0; step < 12; step++) {
      const pick = nextPracticeTemplate(everything, 0, step, 'rhythm');
      expect(pick).not.toBeNull();
      for (const atom of pick!.atoms) expect(strandOf(atom)).toBe('rhythm');
    }
  });

  test('the due path honours the filter — an overdue atom in another lane is skipped', () => {
    const rhythmAtom = LESSONS.find((l) => l.strand === 'rhythm')!.atoms[0];
    const pitchAtom = LESSONS.find((l) => l.strand === 'pitch')!.atoms[0];
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);
    const entries = [
      { atom: pitchAtom, srs: missed },
      { atom: rhythmAtom, srs: reviewSrs(initialSrs(5), true, 5) }, // attempted, not due
    ];

    const pick = nextPracticeTemplate(entries, 5, 0, 'rhythm');
    expect(pick).not.toBeNull();
    expect(pick!.atoms).not.toContain(pitchAtom);
  });

  test('without a strand, picks span more than one lane', () => {
    const strands = new Set<string>();
    for (let step = 0; step < pairCount(everything); step++) {
      const pick = nextPracticeTemplate(everything, 0, step);
      if (pick) for (const atom of pick.atoms) strands.add(strandOf(atom));
    }
    expect(strands.size).toBeGreaterThan(1);
  });
});

// U3/D10: practice must generate a review under the same grade scope the atom was
// taught in, or generation fails validation on device (a grade-2-only key like
// B♭ major is out of scope at grade 1). Covers both pick paths.
describe("practice-plan — nextPracticeTemplate threads the owning lesson's grade (U3/D10)", () => {
  test('due-path pick for a grade-2-only atom (key_sig:Bb_major) carries grade: 2', () => {
    const dueAtom = 'key_sig:Bb_major';
    expect(grade2Lesson.atoms).toContain(dueAtom); // owned only by the grade-2 unit
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);
    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, 0);
    expect(pick).not.toBeNull();
    expect(pick!.atoms).toEqual([dueAtom]);
    expect(pick!.grade).toBe(2);
  });

  // An isolated, collision-free fixture proving the grade threading itself (a pick
  // carries { atoms, grade } from its owning lesson). The real cross-grade template
  // collision is covered directly by the shared-template describe blocks below.
  test('rotation-path pick for a template owned only by a grade-2 lesson carries grade: 2', () => {
    jest.isolateModules(() => {
      jest.doMock('../content/lessons', () => ({
        creditedAtoms: (l: { atoms: string[]; by_ear_atoms?: string[] }) => [...l.atoms, ...(l.by_ear_atoms ?? [])],
        LESSONS: [
          {
            id: 'g1-fixture-lesson',
            title: 'G1 fixture',
            strand: 'pitch',
            atoms: ['g1-fixture-atom'],
            templates: ['fixture_template_g1'],
            worked_example: null,
            unlocks: null,
            grade: 1,
          },
          {
            id: 'g2-fixture-lesson',
            title: 'G2 fixture',
            strand: 'pitch',
            atoms: ['g2-fixture-atom'],
            templates: ['fixture_template_g2'],
            worked_example: null,
            unlocks: null,
            grade: 2,
          },
        ],
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const isolated = require('./practice-plan');
      const entries = [{ atom: 'g2-fixture-atom', srs: reviewSrs(initialSrs(0), true, 0) }];
      const pick = isolated.nextPracticeTemplate(entries, 0, 0);
      expect(pick).toEqual({ template: 'fixture_template_g2', atoms: ['g2-fixture-atom'], grade: 2 });
    });
  });
});

// U7: proves picks are generatable, not merely well-shaped — the assertion
// key_signature_id's due path lacks (Risk 2), which is why a due key_sig atom
// served singly to key_signature_id crashes on device (separately filed bug).
// mode_swap/scale_construction are single-atom-safe by design (U3/U4); these
// tests exercise that guarantee through the real Practice pick path, mirroring
// how the Practice screen consumes a pick: generate(pick.template, { grade,
// seed, atoms: pick.atoms }).
describe('practice-plan — grade-2 minor picks are generatable (U7)', () => {
  test('due-path pick for key_sig:E_minor is mode_swap/grade 2 scoped to that atom, and generates', () => {
    const dueAtom = 'key_sig:E_minor';
    const minorKeysLesson = lessonById('minor-keys-2')!;
    expect(minorKeysLesson.atoms).toContain(dueAtom);
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);

    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, 0);
    expect(pick).toEqual({ template: 'mode_swap', atoms: [dueAtom], grade: 2 });

    const inst = generate(pick!.template, { grade: pick!.grade, seed: 7, atoms: pick!.atoms });
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  test('due-path pick for scale:D_minor_harmonic is scale_construction/grade 2 scoped to that atom, and generates', () => {
    const dueAtom = 'scale:D_minor_harmonic';
    const minorScalesLesson = lessonById('minor-scales-2')!;
    expect(minorScalesLesson.atoms).toContain(dueAtom);
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);

    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, 0);
    expect(pick).toEqual({ template: 'scale_construction', atoms: [dueAtom], grade: 2 });

    const inst = generate(pick!.template, { grade: pick!.grade, seed: 11, atoms: pick!.atoms });
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  test('rotation with only the minor lessons attempted serves both new templates scoped to their owning lesson', () => {
    const minorKeysLesson = lessonById('minor-keys-2')!;
    const minorScalesLesson = lessonById('minor-scales-2')!;
    const entries = attempted([minorKeysLesson, minorScalesLesson]);

    const templates = attemptedTemplates(attemptedAtomSet(entries));
    expect(new Set(templates)).toEqual(new Set(['mode_swap', 'scale_construction']));

    // walk every rotation step so both templates are actually reached, not just present
    const picksByTemplate = new Map<string, PracticePick>();
    for (const pick of fullRotationCycle(entries)) picksByTemplate.set(pick.template, pick);
    expect(new Set(picksByTemplate.keys())).toEqual(new Set(['mode_swap', 'scale_construction']));

    expect(picksByTemplate.get('mode_swap')!.atoms).toEqual(minorKeysLesson.atoms);
    expect(picksByTemplate.get('mode_swap')!.grade).toBe(2);
    expect(picksByTemplate.get('scale_construction')!.atoms).toEqual(minorScalesLesson.atoms);
    expect(picksByTemplate.get('scale_construction')!.grade).toBe(2);
  });
});

// U7/D12 (review finding 1, subsumes bd chromaticly-elb.4): before this fix the
// rotation fallback resolved a shared template to its FIRST owner lesson GLOBALLY
// (grade-1/2 docs load first), so a Level-3 learner's rotation never reached grade-3
// scale_construction/mode_swap content. The fix: the rotation unit is the ordered
// list of (lesson, template) pairs, one per template each ELIGIBLE lesson lists,
// each scoped to that lesson's own attempted atoms and grade.
describe('practice-plan — REGRESSION: rotation reaches every owner of a shared template, not just the first (review finding 1 / D12)', () => {
  test('grades 1-3 attempted: scale_construction rotates through minor-scales-3 AND melodic-minor-3', () => {
    const entries = attempted([...LESSONS_BY_GRADE[1], ...LESSONS_BY_GRADE[2], ...LESSONS_BY_GRADE[3]]);
    const picks = fullRotationCycle(entries);

    const minorScales3 = lessonById('minor-scales-3')!;
    const melodicMinor3 = lessonById('melodic-minor-3')!;

    expect(picks).toContainEqual({ template: 'scale_construction', atoms: melodicMinor3.atoms, grade: 3 });
    expect(picks).toContainEqual({ template: 'scale_construction', atoms: minorScales3.atoms, grade: 3 });
  });
});

describe('practice-plan — rotation surfaces every owner of a shared template (bd chromaticly-elb.4)', () => {
  test('grades 1-2 attempted: key_signature_id rotates through BOTH the grade-1 and grade-2 owner, neither starves', () => {
    const entries = attempted([...LESSONS_BY_GRADE[1], ...LESSONS_BY_GRADE[2]]);
    const picks = fullRotationCycle(entries);

    expect(picks).toContainEqual({
      template: 'key_signature_id',
      atoms: lessonById('key-signatures')!.atoms,
      grade: 1,
    });
    expect(picks).toContainEqual({
      template: 'key_signature_id',
      atoms: lessonById('key-signatures-2')!.atoms,
      grade: 2,
    });
  });
});

describe('practice-plan — grade-1-only rotation (U7 blast radius)', () => {
  const grade1 = () => attempted(LESSONS_BY_GRADE[1]);

  test('every grade-1 template with a single owner: rotation picks are unchanged from the pre-D12 first-owner behavior', () => {
    const picks = fullRotationCycle(grade1());

    // note_naming is the one grade-1 template with more than one owner (treble-notes/
    // bass-notes/accidentals); every other grade-1 template has exactly one owning
    // lesson, so D12's per-lesson pairs produce the same single pick as before.
    const singleOwnerLessons = LESSONS_BY_GRADE[1].filter((l) => !l.templates.includes('note_naming'));
    for (const lesson of singleOwnerLessons) {
      for (const template of lesson.templates) {
        expect(picks).toContainEqual({ template, atoms: lesson.atoms, grade: 1 });
      }
    }
  });

  test('note_naming (shared by three grade-1 lessons) rotates through every owner, not just treble-notes', () => {
    const picks = fullRotationCycle(grade1());

    for (const id of ['treble-notes', 'bass-notes', 'accidentals']) {
      expect(picks).toContainEqual({ template: 'note_naming', atoms: lessonById(id)!.atoms, grade: 1 });
    }
  });
});

describe('practice-plan — every rotation pick is generatable, not merely well-shaped (U7)', () => {
  test('grades 1-3 attempted: every pick in a full rotation cycle generates and validates', () => {
    const picks = fullRotationCycle(attempted([...LESSONS_BY_GRADE[1], ...LESSONS_BY_GRADE[2], ...LESSONS_BY_GRADE[3]]));
    expect(picks.length).toBeGreaterThan(0);

    for (const pick of picks) {
      const inst = generate(pick.template, { grade: pick.grade, seed: 42, atoms: pick.atoms });
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('practice-plan — grade-3 minor picks are generatable (U7)', () => {
  test('due-path pick for key_sig:F#_minor is mode_swap/grade 3 scoped to that atom, and generates', () => {
    const dueAtom = 'key_sig:F#_minor';
    expect(lessonById('minor-keys-3')!.atoms).toContain(dueAtom);
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);

    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, 0);
    expect(pick).toEqual({ template: 'mode_swap', atoms: [dueAtom], grade: 3 });

    const inst = generate(pick!.template, { grade: pick!.grade, seed: 13, atoms: pick!.atoms });
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  test('due-path pick for scale:C#_minor_melodic is scale_construction/grade 3 scoped to that atom, and generates', () => {
    const dueAtom = 'scale:C#_minor_melodic';
    expect(lessonById('melodic-minor-3')!.atoms).toContain(dueAtom);
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);

    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, 0);
    expect(pick).toEqual({ template: 'scale_construction', atoms: [dueAtom], grade: 3 });

    const inst = generate(pick!.template, { grade: pick!.grade, seed: 17, atoms: pick!.atoms });
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });
});

describe('practice-plan — unattempted grade-3 lessons contribute no rotation picks', () => {
  test('grades 1-2 attempted: the rotation cycle carries no grade-3 pick or atom', () => {
    const entries = attempted([...LESSONS_BY_GRADE[1], ...LESSONS_BY_GRADE[2]]);
    const picks = fullRotationCycle(entries);

    expect(picks.every((p) => p.grade <= 2)).toBe(true);
    // Grade-3-EXCLUSIVE atoms only: a grade-3 lesson may legitimately reuse a
    // lower-grade atom (chromaticly-gni — rests-3 shares rest:quaver/rest:semiquaver
    // with the grade-1 rests-1), so "atom appears in a grade-3 lesson" is not the
    // same as "grade-3 content leaked". Subtract the grade-1/2 atoms first.
    const lowerAtoms = new Set([...LESSONS_BY_GRADE[1], ...LESSONS_BY_GRADE[2]].flatMap((l) => l.atoms));
    const grade3Atoms = new Set(LESSONS_BY_GRADE[3].flatMap((l) => l.atoms).filter((a) => !lowerAtoms.has(a)));
    expect(picks.some((p) => p.atoms.some((a) => grade3Atoms.has(a)))).toBe(false);
  });
});

// KTD7: every atom mapped to templates[0], and 56 of 91 lessons list more.
describe('practice routing resolves an atom to a template that actually emits it', () => {
  function pickFor(atom: string) {
    const entries = [{ atom, srs: reviewSrs(initialSrs(0), false, 0) }];
    return nextPracticeTemplate(entries, 10_000_000_000, 0);
  }

  test('a due bar_validity atom is served as bar_validity, not as its lesson’s first template', () => {
    const pick = pickFor('bar_validity');
    expect(pick).not.toBeNull();
    expect(pick!.template).toBe('bar_validity');
  });

  test('a due add_time_signature atom is served as add_time_signature', () => {
    expect(pickFor('add_time_signature')!.template).toBe('add_time_signature');
  });

  /** Review-only companions: not in `templates`, but the same material. A new
   *  entry needs a stated reason. */
  const REVIEW_COMPANION = new Map([
    ['context_question', 'music_in_context'], // one sub-question of the same 8d passage
  ]);

  test('every atom resolves to a template its own lesson lists', () => {
    const wrong: string[] = [];
    for (const lesson of LESSONS) {
      for (const atom of lesson.atoms) {
        const pick = pickFor(atom);
        if (!pick || pick.grade !== lesson.grade) continue;
        const served = REVIEW_COMPANION.get(pick.template) ?? pick.template;
        if (!lesson.templates.includes(served)) wrong.push(`${atom} -> ${pick.template}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test('a review companion only stands in for a template the lesson does list', () => {
    for (const [companion, parent] of REVIEW_COMPANION) {
      expect(companion).not.toBe(parent);
      expect(LESSONS.some((l) => l.templates.includes(parent))).toBe(true);
    }
  });

  // Three pre-existing NON-routing bugs, named so a regression cannot hide:
  // key_sig (chromaticly-elb.7), context (passage path), interval (scope-gated).
  const UNGENERATABLE = /^(key_sig:|context:|interval:6|interval:7|interval_any:)/;

  test('every atom that CAN generate on the due path is tagged by the template it routed to', () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const lesson of LESSONS) {
      for (const atom of lesson.atoms) {
        if (UNGENERATABLE.test(atom)) continue;
        const pick = pickFor(atom);
        if (!pick) continue;
        let tagged = false;
        for (let seed = 0; seed < 6 && !tagged; seed++) {
          try {
            const inst = generate(pick.template, { grade: pick.grade, seed, atoms: pick.atoms, source: pick.source });
            if (inst.srs_tags.includes(atom)) tagged = true;
          } catch {
            continue;
          }
        }
        checked++;
        if (!tagged) wrong.push(`${atom} -> ${pick.template}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(checked).toBeGreaterThan(200); // the exclusions must not swallow the suite
  });
});

// Every loop above walks `lesson.atoms`, which excludes `by_ear_atoms`.
describe('practice routing serves a due by-ear atom without throwing', () => {
  const byEarAtoms = [...new Set(LESSONS.flatMap((l) => creditedAtoms(l).filter(isByEarAtom)))];

  function pickFor(atom: string) {
    return nextPracticeTemplate([{ atom, srs: reviewSrs(initialSrs(0), false, 0) }], 10_000_000_000, 0);
  }

  test('the curriculum declares by-ear atoms, so the loops below are not vacuous', () => {
    expect(byEarAtoms.length).toBeGreaterThan(100);
  });

  test('every due by-ear atom resolves to a pick carrying its written source', () => {
    const unresolved = byEarAtoms.filter((a) => !pickFor(a)?.source);
    expect(unresolved).toEqual([]);
  });

  // Practice generates in a render useMemo and src/ has no ErrorBoundary.
  test('every due by-ear atom generates, and tags the atom that was asked for', () => {
    const broken: string[] = [];
    for (const atom of byEarAtoms) {
      const pick = pickFor(atom)!;
      try {
        const inst = generate(pick.template, { grade: pick.grade, seed: 0, atoms: pick.atoms, source: pick.source });
        if (!inst.srs_tags.includes(atom)) broken.push(`${atom} -> mis-tagged ${inst.srs_tags[0]}`);
      } catch (err) {
        broken.push(`${atom} -> threw ${(err as Error).message}`);
      }
    }
    expect(broken).toEqual([]);
  });
});

// The due-atom path hardcoded by_ear_match. No real lesson wires Group A yet, so this fixture proves the routing.
describe('practice routing — a due Group A by-ear atom resolves to by_ear_verify, not by_ear_match', () => {
  test('note_read:treble:C4:by_ear routes to by_ear_verify by name', () => {
    jest.isolateModules(() => {
      jest.doMock('../content/lessons', () => ({
        creditedAtoms: (l: { atoms: string[]; by_ear_atoms?: string[] }) => [...l.atoms, ...(l.by_ear_atoms ?? [])],
        LESSONS: [
          {
            id: 'note-read-fixture',
            title: 'Note read fixture',
            strand: 'pitch',
            atoms: ['note_read:treble:C4'],
            templates: ['note_naming'],
            by_ear_source: 'note_naming',
            by_ear_atoms: ['note_read:treble:C4:by_ear'],
            worked_example: null,
            unlocks: null,
            grade: 1,
          },
        ],
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const isolated = require('./practice-plan');
      const entries = [{ atom: 'note_read:treble:C4:by_ear', srs: reviewSrs(initialSrs(0), false, 0) }];
      const pick = isolated.nextPracticeTemplate(entries, 10_000_000_000, 0);
      expect(pick?.template).toBe('by_ear_verify');
    });
  });
});

// A context:* atom is earned inside the 8d passage, which only the set phase runs.
describe('practice routing serves a due context atom', () => {
  const contextAtoms = [...new Set(LESSONS.flatMap(creditedAtoms))].filter((a) => a.startsWith('context:'));

  test('the curriculum declares context atoms, so this is not vacuous', () => {
    expect(contextAtoms.length).toBeGreaterThan(10);
  });

  test('every due context atom generates and tags the atom that was asked for', () => {
    const broken: string[] = [];
    for (const atom of contextAtoms) {
      const pick = nextPracticeTemplate([{ atom, srs: reviewSrs(initialSrs(0), false, 0) }], 10_000_000_000, 0);
      if (!pick) { broken.push(`${atom} UNROUTABLE`); continue; }
      let ok = false;
      for (let seed = 0; seed < 6 && !ok; seed++) {
        try {
          if (generate(pick.template, { grade: pick.grade, seed, atoms: pick.atoms }).srs_tags.includes(atom)) ok = true;
        } catch { continue; }
      }
      if (!ok) broken.push(`${atom} -> ${pick.template}`);
    }
    expect(broken).toEqual([]);
  });

  test('the served question still carries the passage it asks about', () => {
    const pick = nextPracticeTemplate(
      [{ atom: 'context:highest_note', srs: reviewSrs(initialSrs(0), false, 0) }], 10_000_000_000, 0,
    )!;
    const inst = generate(pick.template, { grade: pick.grade, seed: 0, atoms: pick.atoms });
    expect(inst.stimulus.music).not.toBeNull();
  });
});
