import { LESSONS, lessonById } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { atomsFor, contentGradesFor, laneDepths, SLACK_FACTOR } from './lane-depth';
import { MASTERY_THRESHOLD } from './mastery';
import { accountNudgeStats, currentLevel, deriveStars, examReadiness, isLevelUnlocked, strandMastery, unitStates } from './mastery-rollup';
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

// R3 made structural (G6 U4): the radar is a PROJECTION of `laneDepths`, not a
// second derivation, so the Learn tab, the radar, exam readiness and the placement
// result cannot drift apart. What the projection must get right is the RATIO —
// held content-bearing grades over content-bearing grades — under a matrix that is
// deliberately sparse.
const DAY = 20_600;

/** Master every atom of (strand, grade), reviewed on `day` — the same fixture
 *  lane-depth.test.ts uses, since this reads the same derivation. */
function masterCell(store: ProgressStore, strand: Parameters<typeof atomsFor>[0], grade: number, day = DAY, box = 2) {
  for (const atom of atomsFor(strand, grade)) {
    store.setAtom(atom, {
      mastery: { streak: MASTERY_THRESHOLD, mastered: true },
      srs: { box, lastReviewed: day, nextDue: day + box },
    });
  }
}

describe('strandMastery — a projection of laneDepths, not a second derivation (R3, KTD10)', () => {
  test('a fresh profile is 0 across every strand, with a NON-ZERO total — an empty that is distinguishable from an absent strand', () => {
    const m = strandMastery(new ProgressStore(), DAY);
    for (const [strand, { value, mastered, total }] of Object.entries(m)) {
      expect(value).toBe(0);
      expect(mastered).toBe(0);
      expect(total).toBe(contentGradesFor(strand as Parameters<typeof atomsFor>[0]).length);
      expect(total).toBeGreaterThan(0);
    }
  });

  test('the denominator is CONTENT grades, not 5: chords holds G4 of its two content grades and reads exactly 0.5', () => {
    // chords has content only at grades 4-5. depth/5 would read 0.8 and
    // depth/highestGrade 1.0; both would be wrong about a half-known strand.
    expect(contentGradesFor('chords')).toEqual([4, 5]);
    const store = new ProgressStore();
    masterCell(store, 'chords', 4);

    const { mastered, total, value } = strandMastery(store, DAY).chords;
    expect(mastered).toBe(1);
    expect(total).toBe(2);
    expect(value).toBe(0.5);
  });

  test('it counts heldGrades, not depth: a strand holding G1 and G4 but not G3 reads 2/n, which depth alone would under-report', () => {
    // The KTD5 guard. `depth` is contiguous progress — holding G4 over an unheld
    // G3 reads depth 1 by design — but the radar answers "how much do you know".
    const store = new ProgressStore();
    masterCell(store, 'rhythm', 1);
    masterCell(store, 'rhythm', 4);

    const content = contentGradesFor('rhythm');
    expect(content).toContain(3); // otherwise the sparse case is not exercised
    const { mastered, total, value } = strandMastery(store, DAY).rhythm;
    expect(mastered).toBe(2);
    expect(total).toBe(content.length);
    expect(value).toBe(2 / content.length);
  });

  test('a fully-held strand reads 1.0', () => {
    const store = new ProgressStore();
    for (const grade of contentGradesFor('context')) masterCell(store, 'context', grade);
    expect(strandMastery(store, DAY).context.value).toBe(1);
  });

  test('a strand decayed out of its top cell drops below 1.0 — the radar tracks retention, not a high-water mark', () => {
    const store = new ProgressStore();
    const content = contentGradesFor('rhythm');
    for (const grade of content) masterCell(store, 'rhythm', grade);
    expect(strandMastery(store, DAY).rhythm.value).toBe(1);

    // Re-review the top cell long ago, so `now` is past its slack window while
    // every other cell stays fresh.
    const top = content[content.length - 1];
    masterCell(store, 'rhythm', top, DAY - 500);

    const decayed = strandMastery(store, DAY).rhythm;
    expect(DAY).toBeGreaterThan(DAY - 500 + 2 + SLACK_FACTOR * 2); // the fixture really is stale
    expect(decayed.value).toBeLessThan(1);
    expect(decayed.mastered).toBe(content.length - 1);
  });

  // The structural guarantee, asserted directly: if someone ever re-derives the
  // radar from atoms instead of reading the lanes, this fails — which is the only
  // way R3 can regress back into two derivations that quietly disagree.
  test('every strand equals the laneDepths projection exactly, on a mixed store', () => {
    const store = new ProgressStore();
    masterCell(store, 'rhythm', 1);
    masterCell(store, 'rhythm', 4);
    masterCell(store, 'chords', 4);
    masterCell(store, 'context', 1);
    masterCell(store, 'pitch', 1, DAY - 500); // stale enough to have decayed

    const lanes = laneDepths(store, DAY);
    const radar = strandMastery(store, DAY);
    for (const [strand, lane] of Object.entries(lanes)) {
      expect(radar[strand].mastered).toBe(lane.heldGrades.length);
      expect(radar[strand].total).toBe(lane.contentGrades.length);
    }
  });

  test('mastered never exceeds total, on any strand, in any state', () => {
    const store = new ProgressStore();
    for (const lesson of LESSONS) masterCell(store, lesson.strand, lesson.grade);
    for (const { mastered, total } of Object.values(strandMastery(store, DAY))) {
      expect(mastered).toBeLessThanOrEqual(total);
    }
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

// G6 U8 (R6 as amended). Readiness moved from a stars fraction to a vector
// comparison, and the tests are written against the two things the fraction could
// not do: say WHICH skill is short, and say what being short of it costs.
describe('examReadiness — a vector comparison over the paper’s own sections (7d)', () => {
  const SECTIONS = [
    { strand: 'rhythm', title: 'Rhythm & Metre' },
    { strand: 'pitch', title: 'Pitch & Notation' },
    { strand: 'scales_keys', title: 'Keys & Scales' },
    { strand: 'intervals', title: 'Intervals' },
    { strand: 'terms_signs', title: 'Terms & Signs' },
  ];
  const MARKS = 4;

  /** Depths as a plain record — readiness takes the derivation's OUTPUT, not the
   *  store, so it can be exercised at any vector without seeding a profile. */
  function depths(overrides: Record<string, number>): Record<string, { depth: number }> {
    const out: Record<string, { depth: number }> = {};
    for (const strand of ['rhythm', 'pitch', 'scales_keys', 'intervals', 'chords', 'terms_signs', 'context']) {
      out[strand] = { depth: overrides[strand] ?? 0 };
    }
    return out;
  }

  const allAtOne = depths({ rhythm: 1, pitch: 1, scales_keys: 1, intervals: 1, terms_signs: 1 });

  test('every examined strand at or above the grade is ready, with nothing named', () => {
    const r = examReadiness(1, SECTIONS, allAtOne, MARKS);
    expect(r.ready).toBe(true);
    expect(r.shortfalls).toEqual([]);
    expect(r.marksAtRisk).toBe(0);
  });

  test('two examined strands below the grade are both named, weakest first, with their marks', () => {
    const r = examReadiness(2, SECTIONS, depths({ rhythm: 1, pitch: 0, scales_keys: 2, intervals: 2, terms_signs: 2 }), MARKS);
    expect(r.shortfalls.map((s) => s.strand)).toEqual(['pitch', 'rhythm']);
    expect(r.shortfalls.map((s) => s.marks)).toEqual([MARKS, MARKS]);
    expect(r.marksAtRisk).toBe(2 * MARKS);
  });

  // KTD8, the false-shortfall regression this shape exists to prevent. Chords
  // teaches nothing below grade 4 and the Grade 1 paper has no chords section, so a
  // fresh learner at chords depth 0 is not short of anything — the old
  // all-seven-strands derivation reported two phantom gaps to every Grade 1 learner
  // and sent them to repair material that does not exist yet.
  test('a strand the paper does not examine is never a shortfall, however low its depth', () => {
    const r = examReadiness(1, SECTIONS, allAtOne, MARKS);
    expect(r.shortfalls.map((s) => s.strand)).not.toContain('chords');
    expect(r.shortfalls.map((s) => s.strand)).not.toContain('context');
    expect(r.ready).toBe(true);
  });

  test('an unexamined strand is still REPORTED, so a five-section paper never reads as a seven-strand one', () => {
    const r = examReadiness(1, SECTIONS, allAtOne, MARKS);
    const unexamined = r.rows.filter((row) => !row.examined).map((row) => row.strand);
    expect(unexamined).toEqual(['chords', 'context']);
    for (const row of r.rows.filter((x) => !x.examined)) expect(row.marks).toBe(0);
  });

  // R6: readiness informs, it never gates. There is deliberately no field to
  // consult — asserted as an absence so re-adding one has to be a decision.
  test('there is no blocking state at any depth — readiness carries no gate', () => {
    for (const depth of [0, 1, 2, 3]) {
      const r = examReadiness(2, SECTIONS, depths({ rhythm: depth, pitch: depth, scales_keys: depth, intervals: depth, terms_signs: depth }), MARKS);
      expect(r).not.toHaveProperty('gateOpen');
      expect(r.totalMarks).toBe(SECTIONS.length * MARKS);
    }
  });

  test('total marks come from the paper, not from the seven strands', () => {
    expect(examReadiness(1, SECTIONS, allAtOne, MARKS).totalMarks).toBe(20);
  });

  // R3: readiness and the lane list must never disagree. Both read `laneDepths`,
  // so a decayed lane has to surface here too — this runs the real derivation
  // rather than the hand-built vector above, which is the point.
  test('a strand decayed below the grade is named — readiness and lane depth agree', () => {
    const store = new ProgressStore();
    const stale = DAY - 400 * SLACK_FACTOR;
    masterCell(store, 'rhythm', 1, stale, 200);
    masterCell(store, 'pitch', 1);
    const lanes = laneDepths(store, DAY);

    const r = examReadiness(1, SECTIONS, lanes, MARKS);
    expect(lanes.rhythm.depth).toBe(0);
    expect(r.shortfalls.map((s) => s.strand)).toContain('rhythm');
  });

  test('depth 0 and depth 1 are different readings at grade 1 — there is no floor at 1 (R7)', () => {
    const r = examReadiness(1, SECTIONS, depths({ pitch: 1, scales_keys: 1, intervals: 1, terms_signs: 1 }), MARKS);
    expect(r.shortfalls.map((s) => s.strand)).toEqual(['rhythm']);
    expect(r.rows.find((row) => row.strand === 'rhythm')!.depth).toBe(0);
  });
});
