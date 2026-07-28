import { LESSONS, lessonById } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { MASTERY_THRESHOLD } from './mastery';
import { accountNudgeStats, currentLevel, deriveStars, isLevelUnlocked, strandMastery, unitStates } from './mastery-rollup';
import { initialSrs } from './srs';
import { ProgressStore } from './store';

/** Seed an atom as mastered by writing a state past MASTERY_THRESHOLD directly
 *  — deriveStars only reads MasteryState.mastered, so this is equivalent to
 *  folding real attempts and much less noisy in a table-driven test. */
function masterAtoms(store: ProgressStore, atoms: string[]): void {
  for (const atom of atoms) {
    store.setAtom(atom, { mastery: { streak: MASTERY_THRESHOLD, mastered: true }, srs: initialSrs() });
  }
}

describe('strandMastery — whole-profile per-strand fraction (design 6d radar)', () => {
  test('a fresh profile is 0 across every strand it has lessons for', () => {
    const store = new ProgressStore();
    const m = strandMastery(LESSONS, store);
    for (const { value, mastered } of Object.values(m)) {
      expect(value).toBe(0);
      expect(mastered).toBe(0);
    }
  });

  test('mastering every atom of a strand takes that strand to 1', () => {
    const store = new ProgressStore();
    const rhythm = LESSONS.filter((l) => l.strand === 'rhythm');
    masterAtoms(store, rhythm.flatMap((l) => l.atoms));

    const m = strandMastery(LESSONS, store);
    expect(m.rhythm.value).toBe(1);
    expect(m.rhythm.mastered).toBe(m.rhythm.total);
    // Untouched strands stay at 0 — mastery is per-strand, not shared.
    for (const [strand, { value }] of Object.entries(m)) {
      if (strand !== 'rhythm') expect(value).toBe(0);
    }
  });

  test('partial mastery reads as a fraction between 0 and 1', () => {
    const store = new ProgressStore();
    const rhythm = LESSONS.filter((l) => l.strand === 'rhythm');
    // Master exactly one atom of the strand.
    masterAtoms(store, [rhythm.flatMap((l) => l.atoms)[0]]);

    const { value } = strandMastery(LESSONS, store).rhythm;
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
  });
});

describe('deriveStars — RD3: fraction of atoms mastered, monotone and atom-count-agnostic', () => {
  test('0 of N mastered -> 0 stars', () => {
    const store = new ProgressStore();
    expect(deriveStars(['a', 'b', 'c'], store)).toBe(0);
  });

  test('1 of 3 mastered -> 1 star (below the 2/3 floor)', () => {
    const store = new ProgressStore();
    masterAtoms(store, ['a']);
    expect(deriveStars(['a', 'b', 'c'], store)).toBe(1);
  });

  test('exactly 2/3 mastered -> 2 stars (lower-inclusive edge)', () => {
    const store = new ProgressStore();
    masterAtoms(store, ['a', 'b']);
    expect(deriveStars(['a', 'b', 'c'], store)).toBe(2);
  });

  test('N of N mastered -> 3 stars', () => {
    const store = new ProgressStore();
    masterAtoms(store, ['a', 'b', 'c']);
    expect(deriveStars(['a', 'b', 'c'], store)).toBe(3);
  });

  test('an atom with no recorded progress at all counts as unmastered, not a crash', () => {
    const store = new ProgressStore();
    expect(deriveStars(['never-seen'], store)).toBe(0);
  });
});

describe('deriveStars — a 1-atom unit is 0 or 3 stars only (RD3 corner, not a bug)', () => {
  test('unmastered single atom -> 0 stars', () => {
    const store = new ProgressStore();
    expect(deriveStars(['solo'], store)).toBe(0);
  });

  test('mastered single atom -> 3 stars, never 1 or 2', () => {
    const store = new ProgressStore();
    masterAtoms(store, ['solo']);
    expect(deriveStars(['solo'], store)).toBe(3);
  });
});

describe('deriveStars — per-unit fixture over real Level 1 atom counts (F13)', () => {
  // The RD3 threshold, computed independently of deriveStars' own branches, so
  // this table proves the real content's atom counts (1..30) hit the intended
  // progression through the real store + generator pipeline — not just that
  // deriveStars agrees with itself.
  function expectedStars(masteredCount: number, total: number): 0 | 1 | 2 | 3 {
    if (total === 0 || masteredCount === 0) return 0;
    if (masteredCount === total) return 3;
    return masteredCount / total >= 2 / 3 ? 2 : 1;
  }

  test.each(LESSONS.map((l) => [l.id, l.atoms.length] as const))(
    'unit "%s" (%d atoms) progresses 0 -> first-mastered -> ~2/3 -> all',
    (lessonId, total) => {
      const atoms = lessonById(lessonId)!.atoms;
      expect(atoms).toHaveLength(total);

      const checkpoints = [0, 1, Math.ceil((2 / 3) * total), total];
      for (const masteredCount of checkpoints) {
        const store = new ProgressStore();
        masterAtoms(store, atoms.slice(0, masteredCount));
        expect(deriveStars(atoms, store)).toBe(expectedStars(masteredCount, total));
      }
    },
  );
});

describe('LEVELS — Level 1 units validate against real lessons (F13 companion)', () => {
  test('every Level 1 lesson has at least one atom', () => {
    for (const lesson of LESSONS) {
      expect(lesson.atoms.length).toBeGreaterThan(0);
    }
  });
});

describe('unitStates — per-unit state for the level map', () => {
  // Atom ids are namespaced per unit — mastery is keyed by raw atom string in
  // the store, so reusing bare names like "a"/"b" across units would leak
  // mastery from one unit's fixture into another's.
  const atomsById: Record<string, string[]> = {
    done: ['done:a', 'done:b'],
    active: ['active:a', 'active:b'],
    second: ['second:a', 'second:b'],
    partial: ['partial:a', 'partial:b', 'partial:c'],
  };
  const lessonAtoms = (id: string): string[] => atomsById[id] ?? [];

  // R2 (G6 U3): there is no 'locked' state left to assert — every unit is
  // enterable, so a unit's state is decided by its own mastery and its position
  // among the not-done units, never by a gate.
  test('a unit with every atom mastered is "done"', () => {
    const store = new ProgressStore();
    masterAtoms(store, atomsById.done);
    const [row] = unitStates(['done'], store, lessonAtoms);
    expect(row).toEqual({ unitId: 'done', stars: 3, state: 'done' });
  });

  test('the first not-done unit is "active"; a later 0-star unit is "started", not active', () => {
    const store = new ProgressStore();
    const rows = unitStates(['active', 'second'], store, lessonAtoms);
    expect(rows[0]).toEqual({ unitId: 'active', stars: 0, state: 'active' });
    expect(rows[1]).toEqual({ unitId: 'second', stars: 0, state: 'started' });
  });

  test('a partially mastered unit is "started" even if it is first in list order', () => {
    const store = new ProgressStore();
    masterAtoms(store, ['partial:a']); // 1 of 3 -> 1 star, below "done"
    const [row] = unitStates(['partial'], store, lessonAtoms);
    expect(row).toEqual({ unitId: 'partial', stars: 1, state: 'started' });
  });

  test('a done unit ahead of a 0-star unit does not block the later unit from being active', () => {
    const store = new ProgressStore();
    masterAtoms(store, atomsById.done);
    const rows = unitStates(['done', 'active'], store, lessonAtoms);
    expect(rows[0].state).toBe('done');
    expect(rows[1]).toEqual({ unitId: 'active', stars: 0, state: 'active' });
  });
});

describe('accountNudgeStats — real backed nudge stats (design 6c, 302.9)', () => {
  test('lessons = completed count; stars = summed deriveStars; both from real derivations', () => {
    const store = new ProgressStore();
    const [l1, l2] = LESSONS;
    for (const l of [l1, l2]) {
      store.setLesson(l.id, { completed: true });
      masterAtoms(store, l.atoms);
    }
    const stats = accountNudgeStats(store, LESSONS, 0);
    expect(stats.lessons).toBe(2);
    expect(stats.stars).toBe(6); // two fully-mastered lessons → 3★ each; every other lesson 0
  });

  // Why: the review-queue count must mirror Practice eligibility, which since G6 U3
  // is per-ATOM — every attempted-and-due atom counts, and nothing else. An atom the
  // learner has never touched must not inflate the nudge's number.
  test('dueCount counts every attempted-and-due atom, and no untouched one', () => {
    const store = new ProgressStore();
    const [l1, l2] = LESSONS;
    masterAtoms(store, l1.atoms); // attempted → due at now 0 (initialSrs)
    const untouched = LESSONS[LESSONS.length - 1].atoms;
    const stats = accountNudgeStats(store, LESSONS, 0);
    expect(stats.dueCount).toBe(l1.atoms.length);
    expect(l2.atoms.concat(untouched).some((a) => a in store.toSnapshot().atoms)).toBe(false);
  });
});

// fyu.2/chromaticly-ehp: free grade access removed the exam gate on
// reachability — a level is reachable iff it has content (every grade 1-5
// now, since Grade 5 shipped its slice). There are no content-less levels
// left, so nothing ever fails to "open" onto units.
describe('isLevelUnlocked / currentLevel — level unlock derivation (D5, fyu.2)', () => {
  const [level1, level2, , , level5] = LEVELS;

  test('Level 1 is always unlocked, even on a fresh store', () => {
    const store = new ProgressStore();
    expect(isLevelUnlocked(level1, store)).toBe(true);
  });

  test('Level 2 is reachable on a fresh store — it has content, so no exam gate blocks it', () => {
    const store = new ProgressStore();
    expect(level2.unitIds.length).toBeGreaterThan(0); // guards the premise: content-ful
    expect(isLevelUnlocked(level2, store)).toBe(true);
  });

  test('Level 5 is reachable regardless of exam state — content presence is the only gate, same rule as every other level', () => {
    const fresh = new ProgressStore();
    expect(level5.unitIds.length).toBeGreaterThan(0); // guards the premise: content-ful
    expect(isLevelUnlocked(level5, fresh)).toBe(true);

    const everyExamCleared = new ProgressStore();
    everyExamCleared.recordExamCleared(1);
    everyExamCleared.recordExamCleared(2);
    everyExamCleared.recordExamCleared(3);
    everyExamCleared.recordExamCleared(4);
    expect(isLevelUnlocked(level5, everyExamCleared)).toBe(true);
  });

  test('currentLevel follows the working grade (Profile.grade), not the highest reachable level', () => {
    const store = new ProgressStore();
    expect(currentLevel(LEVELS, store)).toBe(level1); // fresh store, no profile → grade 1 default

    store.setProfile({ grade: 2, onboardedAt: '2026-07-13T00:00:00.000Z' });
    // Level 3 is also reachable (has content) at this point, but currentLevel
    // must still report Level 2 — the learner's chosen working grade.
    expect(isLevelUnlocked(LEVELS[2], store)).toBe(true);
    expect(currentLevel(LEVELS, store)).toBe(level2);
  });
});
