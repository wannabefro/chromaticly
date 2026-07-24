import { LESSONS, LESSONS_BY_GRADE, lessonById } from '../content/lessons';
import { generate } from '../engine/generators';
import { validate } from '../engine/validator';
import { nextPracticeTemplate, unlockedAtomSet, unlockedTemplates, type PracticePick } from './practice-plan';
import { initialSrs, reviewSrs, type SrsState } from './srs';

const onlyFirst = (id: string) => id === LESSONS[0].id;
const firstLesson = LESSONS[0];
const grade2Lesson = LESSONS_BY_GRADE[2][0];
const onlyGrade2 = (id: string) => id === grade2Lesson.id;

// D12's rotation unit is the (unlocked lesson, template) pair, one per template a
// lesson lists — computed independently here (not by reaching into practice-plan's
// private pair builder) so a full cycle can be walked and asserted on as a black box.
const unlockedPairCount = (isUnlocked: (id: string) => boolean): number =>
  LESSONS.filter((l) => isUnlocked(l.id)).reduce((sum, l) => sum + l.templates.length, 0);

const fullRotationCycle = (isUnlocked: (id: string) => boolean, size: number): PracticePick[] => {
  const picks: PracticePick[] = [];
  for (let step = 0; step < size; step++) {
    const pick = nextPracticeTemplate([], 0, isUnlocked, step);
    if (pick) picks.push(pick);
  }
  return picks;
};

describe('practice-plan — eligibility follows unlock state', () => {
  test('unlockedTemplates and unlockedAtomSet only include unlocked lessons', () => {
    const templates = unlockedTemplates(onlyFirst);
    expect(templates).toEqual(firstLesson.templates);
    const atoms = unlockedAtomSet(onlyFirst);
    expect(atoms.has(firstLesson.atoms[0])).toBe(true);
    // an atom from a later, locked lesson is excluded
    const laterAtom = LESSONS[LESSONS.length - 1].atoms[0];
    expect(atoms.has(laterAtom)).toBe(false);
  });
});

describe('practice-plan — nextPracticeTemplate', () => {
  test('returns null when nothing is unlocked', () => {
    expect(nextPracticeTemplate([], 0, () => false, 0)).toBeNull();
  });

  test('falls back to a rotating unlocked template, scoped to its owning lesson atoms', () => {
    const pick = nextPracticeTemplate([], 0, onlyFirst, 0);
    expect(pick).not.toBeNull();
    expect(firstLesson.templates).toContain(pick!.template);
    // rotation scope is the owning lesson's atoms, never empty or grade-wide
    expect(pick!.atoms.length).toBeGreaterThan(0);
    expect(pick!.atoms).toEqual(firstLesson.atoms);
  });

  test('serves a due unlocked atom scoped to exactly that atom (per-atom review)', () => {
    const dueAtom = firstLesson.atoms[0];
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5); // due at tick 5
    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, onlyFirst, 0);
    expect(pick).not.toBeNull();
    expect(pick!.template).toBe(firstLesson.templates[0]);
    expect(pick!.atoms).toEqual([dueAtom]);
    // a due grade-1 atom must carry grade: 1 — the owning lesson's grade, unchanged
    expect(pick!.grade).toBe(1);
  });

  test('ignores a due atom from a locked lesson', () => {
    const lockedAtom = LESSONS[LESSONS.length - 1].atoms[0];
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);
    // Only the first lesson is unlocked, so the locked atom must not drive selection;
    // it falls back to the unlocked rotation (owning-lesson scope) instead.
    const pick = nextPracticeTemplate([{ atom: lockedAtom, srs: missed }], 5, onlyFirst, 0);
    expect(pick).not.toBeNull();
    expect(firstLesson.templates).toContain(pick!.template);
    expect(pick!.atoms).toEqual(firstLesson.atoms);
  });
});

// U3/D10: practice must generate a review under the same grade scope the atom was
// taught in, or generation fails validation on device (a grade-2-only key like
// B♭ major is out of scope at grade 1). Covers both pick paths.
describe('practice-plan — nextPracticeTemplate threads the owning lesson\'s grade (U3/D10)', () => {
  test('due-path pick for a grade-2-only atom (key_sig:Bb_major) carries grade: 2', () => {
    const dueAtom = 'key_sig:Bb_major';
    expect(grade2Lesson.atoms).toContain(dueAtom); // owned only by the grade-2 unit
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);
    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, onlyGrade2, 0);
    expect(pick).not.toBeNull();
    expect(pick!.atoms).toEqual([dueAtom]);
    expect(pick!.grade).toBe(2);
  });

  // Pre-U7 this scenario could not be exercised against the real curriculum —
  // the grade-2 unit's only template (`key_signature_id`) is also used by the
  // grade-1 "key-signatures" lesson, and the old rotation resolved a shared
  // template to its FIRST owner globally regardless of unlock state, so the
  // grade-2 owner's { atoms, grade } was never reachable. D12/U7 replaced that
  // global first-owner map with per-unlocked-lesson rotation pairs, so the real
  // collision is now covered directly (see the "rotation surfaces every unlocked
  // owner of a shared template" describe block below, incl. bd chromaticly-elb.4).
  // This isolated fixture stays as a minimal, collision-free proof that the grade
  // threading itself (pick carries { atoms, grade } from its owning lesson) works.
  test('rotation-path pick for a template owned only by a grade-2 lesson carries grade: 2', () => {
    jest.isolateModules(() => {
      jest.doMock('../content/lessons', () => ({
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
      const pick = isolated.nextPracticeTemplate([], 0, (id: string) => id === 'g2-fixture-lesson', 0);
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
    const isUnlocked = (id: string) => id === minorKeysLesson.id;
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);

    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, isUnlocked, 0);
    expect(pick).toEqual({ template: 'mode_swap', atoms: [dueAtom], grade: 2 });

    const inst = generate(pick!.template, { grade: pick!.grade, seed: 7, atoms: pick!.atoms });
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  test('due-path pick for scale:D_minor_harmonic is scale_construction/grade 2 scoped to that atom, and generates', () => {
    const dueAtom = 'scale:D_minor_harmonic';
    const minorScalesLesson = lessonById('minor-scales-2')!;
    expect(minorScalesLesson.atoms).toContain(dueAtom);
    const isUnlocked = (id: string) => id === minorScalesLesson.id;
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);

    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, isUnlocked, 0);
    expect(pick).toEqual({ template: 'scale_construction', atoms: [dueAtom], grade: 2 });

    const inst = generate(pick!.template, { grade: pick!.grade, seed: 11, atoms: pick!.atoms });
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  test('rotation path with only the minor lessons unlocked serves both new templates scoped to their owning lesson', () => {
    const minorKeysLesson = lessonById('minor-keys-2')!;
    const minorScalesLesson = lessonById('minor-scales-2')!;
    const isUnlocked = (id: string) => id === minorKeysLesson.id || id === minorScalesLesson.id;

    const templates = unlockedTemplates(isUnlocked);
    expect(new Set(templates)).toEqual(new Set(['mode_swap', 'scale_construction']));

    // walk every rotation step so both templates are actually reached, not just present
    const picksByTemplate = new Map<string, ReturnType<typeof nextPracticeTemplate>>();
    for (let step = 0; step < templates.length; step++) {
      const pick = nextPracticeTemplate([], 0, isUnlocked, step);
      expect(pick).not.toBeNull();
      picksByTemplate.set(pick!.template, pick);
    }
    expect(new Set(picksByTemplate.keys())).toEqual(new Set(['mode_swap', 'scale_construction']));

    const modeSwapPick = picksByTemplate.get('mode_swap')!;
    expect(modeSwapPick!.atoms).toEqual(minorKeysLesson.atoms);
    expect(modeSwapPick!.grade).toBe(2);

    const scaleConstructionPick = picksByTemplate.get('scale_construction')!;
    expect(scaleConstructionPick!.atoms).toEqual(minorScalesLesson.atoms);
    expect(scaleConstructionPick!.grade).toBe(2);
  });
});

// U7/D12 (review finding 1, subsumes bd chromaticly-elb.4): before this fix the
// rotation fallback resolved a shared template to its FIRST owner lesson GLOBALLY
// (grade-1/2 docs load first), so a Level-3 learner's rotation never reached grade-3
// scale_construction/mode_swap content, and a Level-2 learner's rotation never
// reached the grade-2 key_signature_id owner either. The fix: the rotation unit is
// the ordered list of (unlocked lesson, template) pairs, one per template each
// unlocked lesson lists, each scoped to that lesson's own atoms/grade — so every
// unlocked owner of a shared template rotates in, not just the first one.
describe('practice-plan — REGRESSION: rotation reaches every unlocked owner of a shared template, not just the first (review finding 1 / D12)', () => {
  test('grades 1-3 unlocked: scale_construction rotates through minor-scales-3 AND melodic-minor-3 (Level-3 rotation must not starve on grade-2 content)', () => {
    const allUnlocked = () => true;
    const picks = fullRotationCycle(allUnlocked, unlockedPairCount(allUnlocked));

    const minorScales3 = lessonById('minor-scales-3')!;
    const melodicMinor3 = lessonById('melodic-minor-3')!;

    // Pre-fix, TEMPLATE_LESSON_ATOMS resolved scale_construction to its first owner
    // anywhere in LESSONS (minor-scales-2, grade 2) — this pick was unreachable.
    expect(picks).toContainEqual({ template: 'scale_construction', atoms: melodicMinor3.atoms, grade: 3 });
    expect(picks).toContainEqual({ template: 'scale_construction', atoms: minorScales3.atoms, grade: 3 });
  });
});

describe('practice-plan — rotation surfaces every unlocked owner of a shared template (bd chromaticly-elb.4)', () => {
  test('grades 1-2 unlocked: key_signature_id rotates through BOTH the grade-1 and grade-2 owner, neither starves', () => {
    const upToGrade2 = (id: string) => (LESSONS.find((l) => l.id === id)?.grade ?? Infinity) <= 2;
    const picks = fullRotationCycle(upToGrade2, unlockedPairCount(upToGrade2));

    const keySignatures1 = lessonById('key-signatures')!;
    const keySignatures2 = lessonById('key-signatures-2')!;

    expect(picks).toContainEqual({ template: 'key_signature_id', atoms: keySignatures1.atoms, grade: 1 });
    expect(picks).toContainEqual({ template: 'key_signature_id', atoms: keySignatures2.atoms, grade: 2 });
  });
});

describe('practice-plan — grade-1-only rotation (U7 blast radius)', () => {
  const onlyGrade1 = (id: string) => LESSONS.find((l) => l.id === id)?.grade === 1;

  test('every grade-1 template with a single owner: rotation picks are unchanged from the pre-D12 first-owner behavior', () => {
    const picks = fullRotationCycle(onlyGrade1, unlockedPairCount(onlyGrade1));

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

  // NOTE (discovered while implementing U7, flagged for the plan's author): the plan's
  // "single-grade learner: rotation is invisible" scenario assumes atom-scope parity
  // with today's behavior for every grade-1 template. That assumption does not hold for
  // note_naming, which is shared WITHIN grade 1 (treble-notes/bass-notes/accidentals),
  // not just across grades. D12's fix mechanism is unconditional ("each unlocked lesson
  // contributes one pair per template it lists") — it is not scoped to cross-grade
  // sharing — so it also closes this pre-existing gap: pre-fix, a grade-1-only learner's
  // rotation could only ever reach treble-notes' atoms via note_naming (global
  // first-owner-wins); bass-notes'/accidentals' atoms were reachable only via the SRS
  // due path, never via rotation. Post-fix all three are reachable. This is judged an
  // in-scope, desirable side effect of the general reachability fix (consistent with
  // D12's stated goal, "makes every unlocked lesson's content reachable via rotation"),
  // not a regression — but it does mean the fix is not fully "invisible" to a
  // single-grade learner as the plan's test-scenario prose claims.
  test('note_naming (shared by three grade-1 lessons) now rotates through every unlocked owner, not just treble-notes', () => {
    const picks = fullRotationCycle(onlyGrade1, unlockedPairCount(onlyGrade1));

    const trebleNotes = lessonById('treble-notes')!;
    const bassNotes = lessonById('bass-notes')!;
    const accidentals = lessonById('accidentals')!;

    expect(picks).toContainEqual({ template: 'note_naming', atoms: trebleNotes.atoms, grade: 1 });
    expect(picks).toContainEqual({ template: 'note_naming', atoms: bassNotes.atoms, grade: 1 });
    expect(picks).toContainEqual({ template: 'note_naming', atoms: accidentals.atoms, grade: 1 });
  });
});

describe('practice-plan — every rotation pick is generatable, not merely well-shaped (U7)', () => {
  test('grades 1-3 unlocked: every pick in a full rotation cycle generates and validates', () => {
    const allUnlocked = () => true;
    const picks = fullRotationCycle(allUnlocked, unlockedPairCount(allUnlocked));
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
    const minorKeys3 = lessonById('minor-keys-3')!;
    expect(minorKeys3.atoms).toContain(dueAtom);
    const isUnlocked = (id: string) => id === minorKeys3.id;
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);

    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, isUnlocked, 0);
    expect(pick).toEqual({ template: 'mode_swap', atoms: [dueAtom], grade: 3 });

    const inst = generate(pick!.template, { grade: pick!.grade, seed: 13, atoms: pick!.atoms });
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  test('due-path pick for scale:C#_minor_melodic is scale_construction/grade 3 scoped to that atom, and generates', () => {
    const dueAtom = 'scale:C#_minor_melodic';
    const melodicMinor3 = lessonById('melodic-minor-3')!;
    expect(melodicMinor3.atoms).toContain(dueAtom);
    const isUnlocked = (id: string) => id === melodicMinor3.id;
    const missed: SrsState = reviewSrs(initialSrs(0), false, 5);

    const pick = nextPracticeTemplate([{ atom: dueAtom, srs: missed }], 5, isUnlocked, 0);
    expect(pick).toEqual({ template: 'scale_construction', atoms: [dueAtom], grade: 3 });

    const inst = generate(pick!.template, { grade: pick!.grade, seed: 17, atoms: pick!.atoms });
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });
});

describe('practice-plan — locked grade-3 lessons contribute no rotation picks (U7)', () => {
  test('fresh store, grades 1-2 unlocked: the rotation cycle carries no grade-3 pick or atom', () => {
    const upToGrade2 = (id: string) => (LESSONS.find((l) => l.id === id)?.grade ?? Infinity) <= 2;
    const picks = fullRotationCycle(upToGrade2, unlockedPairCount(upToGrade2));

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
