import { LESSONS } from '../content/lessons';
import { nextPracticeTemplate, unlockedAtomSet, unlockedTemplates } from './practice-plan';
import { initialSrs, reviewSrs, type SrsState } from './srs';

const onlyFirst = (id: string) => id === LESSONS[0].id;
const firstLesson = LESSONS[0];

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
