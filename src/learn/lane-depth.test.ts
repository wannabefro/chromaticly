// The lane-depth specification, as a table. This function has four consumers
// (Learn tab, radar, exam readiness, placement result) and a sparse, awkward
// input matrix, so the fixtures below ARE the spec — read them before changing
// anything in lane-depth.ts.
//
// The real curriculum shape these lean on (46 lessons, 262 atom occurrences):
//   rhythm      G1 G3 G4 G5      pitch    G1 G3 G4 G5
//   scales_keys G1 G2 G3 G4      intervals G1 G3 G4
//   chords      G4 G5            terms_signs G1 G4 G5
//   context     G1
// Four of seven strands are stubs. That is the point of most of these tests.

import { atomsFor, contentGradesFor, decayedSeedDepth, laneDepths, SEED_INTERVAL_DAYS, SLACK_FACTOR, writtenLaneDepths } from './lane-depth';
import { ProgressStore } from './store';

const DAY = 20_600;

/** Master every atom of (strand, grade), reviewed on `day` into `box`. */
function master(store: ProgressStore, strand: Parameters<typeof atomsFor>[0], grade: number, day: number, box = 2) {
  for (const atom of atomsFor(strand, grade)) {
    store.setAtom(atom, {
      mastery: { streak: 3, mastered: true },
      srs: { box, lastReviewed: day, nextDue: day + box },
    });
  }
}

describe('the content matrix — sparse, and every consumer must cope', () => {
  test('each strand reports only the grades that actually have lessons', () => {
    expect(contentGradesFor('chords')).toEqual([4, 5]);
    expect(contentGradesFor('context')).toEqual([1, 2, 3, 4, 5]);
    expect(contentGradesFor('intervals')).toEqual([1, 2, 3, 4, 5]);
  });

  test('chords genuinely has nothing below grade 4 — the mock\'s "Chords · grade 2" is unbuildable', () => {
    expect(atomsFor('chords', 1)).toEqual([]);
    expect(atomsFor('chords', 2)).toEqual([]);
    expect(atomsFor('chords', 4).length).toBeGreaterThan(0);
  });
});

describe('laneDepths — evidence path', () => {
  test('an untouched store reads depth 0 everywhere, with content grades still reported', () => {
    // No floor at 1. "Not started" is a real, honest state; a floor would make
    // context (single grade) the one lane that could never visibly drift.
    const lanes = laneDepths(new ProgressStore(), DAY);
    for (const lane of Object.values(lanes)) {
      expect(lane.depth).toBe(0);
      expect(lane.heldGrades).toEqual([]);
      expect(lane.source).toBe('evidence');
    }
    expect(lanes.chords.contentGrades).toEqual([4, 5]);
  });

  test('mastering every content grade reads the strand\'s highest', () => {
    const store = new ProgressStore();
    for (const grade of contentGradesFor('chords')) master(store, 'chords', grade, DAY);

    const chords = laneDepths(store, DAY).chords;
    expect(chords.depth).toBe(5);
    expect(chords.heldGrades).toEqual([4, 5]);
  });

  // chords is the sparse strand: it teaches nothing below grade 4. Requiring the
  // empty grades would cap the lane at 0 instead of reporting the real depth.
  test('a grade with no content is skipped, not failed', () => {
    expect(contentGradesFor('chords')).not.toContain(3);
    const store = new ProgressStore();
    master(store, 'chords', 4, DAY);
    master(store, 'chords', 5, DAY);

    expect(laneDepths(store, DAY).chords.depth).toBe(5);
  });

  test('depth is contiguous, but heldGrades is not — the distinction the radar needs', () => {
    // Holding G5 while G3/G4 are unheld is real knowledge (count it) but not real
    // progress (do not claim depth 5). `depth` alone cannot express both.
    const store = new ProgressStore();
    master(store, 'rhythm', 1, DAY);
    master(store, 'rhythm', 5, DAY);

    const rhythm = laneDepths(store, DAY).rhythm;
    expect(rhythm.depth).toBe(1);
    expect(rhythm.heldGrades).toEqual([1, 5]);
  });

  // This test previously PINNED the opposite: G3 and G4 listed an identical atom
  // set (`interval_type:2..8`), so mastering G3 silently credited G4 and the lane
  // jumped two grades for one lesson's work. It asked to fail loudly when the
  // content was fixed, and chromaticly-6ga fixed it — G4 now owns `interval_any:*`,
  // the between-any-notes widening that makes augmented and diminished reachable.
  test('intervals G3 and G4 teach different atoms, so holding G3 does not hold G4', () => {
    expect(atomsFor('intervals', 3)).not.toEqual(atomsFor('intervals', 4));
    expect(atomsFor('intervals', 2)).not.toEqual(atomsFor('intervals', 3));

    const store = new ProgressStore();
    master(store, 'intervals', 1, DAY);
    master(store, 'intervals', 2, DAY);
    master(store, 'intervals', 3, DAY);

    expect(laneDepths(store, DAY).intervals.depth).toBe(3);

    // ...and mastering G4 as well does move it, which is what proves the depth
    // stopped at 3 for the right reason rather than because G4 became unreachable.
    master(store, 'intervals', 4, DAY);
    expect(laneDepths(store, DAY).intervals.depth).toBe(4);
  });
});

describe('laneDepths — decay (R5)', () => {
  test('a lane read long past its due dates drops, and reports what it was', () => {
    const store = new ProgressStore();
    for (const grade of contentGradesFor('chords')) master(store, 'chords', grade, DAY, 2);

    const fresh = laneDepths(store, DAY).chords;
    expect(fresh.depth).toBe(5);
    expect(fresh.decayedFrom).toBeUndefined();

    const later = laneDepths(store, DAY + 500).chords;
    expect(later.depth).toBe(0);
    expect(later.decayedFrom).toBe(5);
  });

  test('decay is recoverable — re-reviewing at the later day restores the depth', () => {
    const store = new ProgressStore();
    master(store, 'context', 1, DAY);
    expect(laneDepths(store, DAY + 500).context.depth).toBe(0);

    master(store, 'context', 1, DAY + 500);
    expect(laneDepths(store, DAY + 500).context.depth).toBe(1);
  });

  test('a single-grade lane can decay to 0 — context, the case a floor would hide', () => {
    const store = new ProgressStore();
    master(store, 'context', 1, DAY);

    expect(laneDepths(store, DAY).context.depth).toBe(1);
    expect(laneDepths(store, DAY + 500).context.depth).toBe(0);
  });

  test('the stale boundary is strictly greater, so the boundary day still counts', () => {
    const store = new ProgressStore();
    const box = 2;
    master(store, 'context', 1, DAY, box);
    // interval = nextDue - lastReviewed = box; stale when now > nextDue + SLACK*interval
    const boundary = DAY + box + SLACK_FACTOR * box;

    expect(laneDepths(store, boundary).context.depth).toBe(1);
    expect(laneDepths(store, boundary + 1).context.depth).toBe(0);
  });

  test('a box-0 atom is not stale the day it is written', () => {
    // Its interval is 0; without the max(1, …) floor on the WINDOW the slack
    // would collapse and a just-answered atom would read stale immediately.
    const store = new ProgressStore();
    master(store, 'context', 1, DAY, 0);

    expect(laneDepths(store, DAY).context.depth).toBe(1);
  });

  test('a minority of stale atoms holds the cell; a majority drops it', () => {
    // One lapsed atom in six must not cost a whole grade — but four must.
    const atoms = atomsFor('scales_keys', 4);
    expect(atoms.length).toBeGreaterThanOrEqual(4);

    const holdOne = new ProgressStore();
    const dropMost = new ProgressStore();
    for (const grade of [1, 2, 3]) {
      master(holdOne, 'scales_keys', grade, DAY + 400);
      master(dropMost, 'scales_keys', grade, DAY + 400);
    }
    atoms.forEach((atom, i) => {
      const stale = { box: 2, lastReviewed: DAY, nextDue: DAY + 2 };
      const fresh = { box: 2, lastReviewed: DAY + 400, nextDue: DAY + 402 };
      holdOne.setAtom(atom, { mastery: { streak: 3, mastered: true }, srs: i === 0 ? stale : fresh });
      dropMost.setAtom(atom, { mastery: { streak: 3, mastered: true }, srs: i === 0 ? fresh : stale });
    });

    expect(laneDepths(holdOne, DAY + 400).scales_keys.depth).toBe(4);
    expect(laneDepths(dropMost, DAY + 400).scales_keys.depth).toBe(3);
  });
});

describe('laneDepths — seed authority and seed decay (KTD7)', () => {
  test('a seed governs while it is at least as recent as any attempt', () => {
    const store = new ProgressStore();
    store.setSeededDepth('chords', { depth: 5, day: DAY, seq: 10 });

    const chords = laneDepths(store, DAY).chords;
    expect(chords.depth).toBe(5);
    expect(chords.source).toBe('seed');
    expect(chords.heldGrades).toEqual([4, 5]);
  });

  test('evidence wins once it is newer — even when it reads LOWER than the seed', () => {
    // This is why authority is recency, not max(). A seed of 5 must not resurrect
    // itself over an attempt that says otherwise.
    const store = new ProgressStore();
    store.setSeededDepth('chords', { depth: 5, day: DAY, seq: 1 });
    master(store, 'chords', 4, DAY); // advances writeSeq past the seed

    const chords = laneDepths(store, DAY).chords;
    expect(chords.source).toBe('evidence');
    expect(chords.depth).toBe(4);
  });

  test('same-day ordering resolves by seq in both directions — the F1b regression', () => {
    // Whole days cannot separate these. Only the monotonic counter can, and the
    // per-skill re-test is exactly this comparison.
    const seedWins = new ProgressStore();
    master(seedWins, 'chords', 4, DAY);
    seedWins.setSeededDepth('chords', { depth: 5, day: DAY, seq: seedWins.reserveSeq() });
    expect(laneDepths(seedWins, DAY).chords.source).toBe('seed');

    const attemptWins = new ProgressStore();
    attemptWins.setSeededDepth('chords', { depth: 5, day: DAY, seq: attemptWins.reserveSeq() });
    master(attemptWins, 'chords', 4, DAY);
    expect(laneDepths(attemptWins, DAY).chords.source).toBe('evidence');
  });

  test('a re-test takes authority back after practice', () => {
    const store = new ProgressStore();
    store.setSeededDepth('chords', { depth: 5, day: DAY, seq: 1 });
    master(store, 'chords', 4, DAY);
    expect(laneDepths(store, DAY).chords.source).toBe('evidence');

    store.setSeededDepth('chords', { depth: 5, day: DAY, seq: store.reserveSeq() });
    expect(laneDepths(store, DAY).chords.source).toBe('seed');
  });

  test('a seed sheds a grade per interval and eventually says nothing', () => {
    // R5 for a learner who placed and never came back. Without this a lane
    // seeded at 3 reads 3 forever.
    const seed = { depth: 3, day: DAY, seq: 1 };
    expect(decayedSeedDepth(seed, DAY)).toBe(3);
    expect(decayedSeedDepth(seed, DAY + SEED_INTERVAL_DAYS - 1)).toBe(3);
    expect(decayedSeedDepth(seed, DAY + SEED_INTERVAL_DAYS)).toBe(2);
    expect(decayedSeedDepth(seed, DAY + 3 * SEED_INTERVAL_DAYS)).toBe(0);
    expect(decayedSeedDepth(seed, DAY + 99 * SEED_INTERVAL_DAYS)).toBe(0);
  });

  test('a decayed seed keeps seed authority and reports its original depth', () => {
    const store = new ProgressStore();
    store.setSeededDepth('chords', { depth: 5, day: DAY, seq: 10 });

    const later = laneDepths(store, DAY + SEED_INTERVAL_DAYS).chords;
    expect(later.source).toBe('seed');
    expect(later.depth).toBe(4);
    expect(later.decayedFrom).toBe(5);
    expect(later.heldGrades).toEqual([4]);
  });
});

describe('laneDepths — a shared atom is evidence in every cell that lists it (KTD9)', () => {
  test('rest:semibreve is in both rhythm G1 and rhythm G4, and counts for both', () => {
    expect(atomsFor('rhythm', 1)).toContain('rest:semibreve');
    expect(atomsFor('rhythm', 4)).toContain('rest:semibreve');

    const store = new ProgressStore();
    master(store, 'rhythm', 1, DAY);
    // The G1 pass alone already covers the shared id inside G4's cell; G4 is not
    // held because its OTHER atoms are untouched, which is the correct reading.
    expect(store.getAtom('rest:semibreve').mastery.mastered).toBe(true);
    expect(laneDepths(store, DAY).rhythm.depth).toBe(1);
  });
});

describe('laneDepths — never writes', () => {
  test('deriving depths leaves the snapshot byte-identical', () => {
    // Decay is a reading, not a mutation. If this ever fails, `mastered` is being
    // written and stars/lesson-completion are about to start lying.
    const store = new ProgressStore();
    master(store, 'context', 1, DAY);
    store.setSeededDepth('chords', { depth: 4, day: DAY, seq: 9 });
    const before = JSON.stringify(store.toSnapshot());

    laneDepths(store, DAY + 5_000);

    expect(JSON.stringify(store.toSnapshot())).toEqual(before);
  });
});

// R10/AE4/AE5: a by-ear atom must never move readiness.
describe('written-only depth keeps by-ear credit out of exam readiness', () => {
  const BY_EAR = 'rest:crotchet:by_ear';

  /** A strand cell plus one by-ear atom the learner has NOT answered. */
  function storeWithUnansweredByEar() {
    const store = new ProgressStore();
    master(store, 'rhythm', 1, DAY);
    return store;
  }

  // U8 populates the by-ear atoms. Until then these are equal-not-fewer, so the
  // count is stated rather than assumed.
  test('every written-only atom list excludes by-ear atoms, at every populated cell', () => {
    let byEarSeen = 0;
    for (const strand of ['rhythm', 'pitch', 'scales_keys', 'intervals', 'chords', 'terms_signs', 'context'] as const) {
      for (const grade of contentGradesFor(strand)) {
        const all = atomsFor(strand, grade);
        const written = atomsFor(strand, grade, true);
        byEarSeen += all.length - written.length;
        expect(written.every((a) => !a.endsWith(':by_ear'))).toBe(true);
        expect(all.filter((a) => !a.endsWith(':by_ear'))).toEqual(written);
      }
    }
    // U8 makes this positive. Dropping back to 0 means the atoms went missing.
    expect(byEarSeen).toBe(0);
  });

  test('AE4: every written atom mastered and no by-ear atom attempted still reads ready', () => {
    const store = storeWithUnansweredByEar();
    expect(writtenLaneDepths(store, DAY).rhythm.depth).toBe(1);
  });

  test('AE5: the full vector is never HIGHER than the written-only one', () => {
    const store = storeWithUnansweredByEar();
    for (const strand of Object.keys(writtenLaneDepths(store, DAY)) as (keyof ReturnType<typeof laneDepths>)[]) {
      expect(laneDepths(store, DAY)[strand].depth).toBeLessThanOrEqual(writtenLaneDepths(store, DAY)[strand].depth);
    }
  });

  test('a strand with no by-ear atoms reads identically through both derivations', () => {
    const store = new ProgressStore();
    master(store, 'intervals', 1, DAY);
    expect(laneDepths(store, DAY).intervals).toEqual(writtenLaneDepths(store, DAY).intervals);
  });

  test('a by-ear atom alone never raises the written-only depth', () => {
    const store = new ProgressStore();
    store.setAtom(BY_EAR, { mastery: { streak: 3, mastered: true }, srs: { box: 2, lastReviewed: DAY, nextDue: DAY + 2 } });
    expect(writtenLaneDepths(store, DAY).rhythm.depth).toBe(0);
  });
});
