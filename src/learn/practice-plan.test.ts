import { LESSONS, LESSONS_BY_GRADE } from '../content/lessons';
import { nextPracticeTemplate, unlockedAtomSet, unlockedTemplates } from './practice-plan';
import { initialSrs, reviewSrs, type SrsState } from './srs';

const onlyFirst = (id: string) => id === LESSONS[0].id;
const firstLesson = LESSONS[0];
const grade2Lesson = LESSONS_BY_GRADE[2][0];
const onlyGrade2 = (id: string) => id === grade2Lesson.id;

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

  // NOTE: this scenario cannot be exercised against the real curriculum today —
  // the grade-2 unit's only template (`key_signature_id`) is also used by the
  // grade-1 "key-signatures" lesson, so TEMPLATE_LESSON_ATOMS's first-owner-wins
  // map (grade-1 docs load first) always resolves that template id to the
  // grade-1 owner regardless of which lessons are unlocked — a template-id
  // collision the plan's Risk 9 only names for atoms, not templates. Verified
  // with an isolated fixture instead, to prove the threading mechanism itself
  // (map value carries { atoms, grade } together) works for a template that
  // genuinely has no grade-1 collision.
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
