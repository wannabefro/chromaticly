import { SELF_GRADED_INTERACTIONS } from '../engine/schema';
import { contentGradesFor, STRAND_ORDER } from './lane-depth';
import {
  answerPlacement,
  answerWalk,
  currentItem,
  isPlacementComplete,
  LADDER_BUDGET,
  ladderFor,
  MIXED_PASS_BUDGET,
  placeableStrands,
  placementOutcome,
  PLACEMENT_SKIPS,
  SKIPPED_PLACEMENT,
  startPlacement,
  startWalk,
  walkDepth,
  walkItem,
  type StrandWalk,
} from './placement';

/** Drive a walk to the end on a fixed answer script, and report every grade it
 *  asked. Answers past the end of the script are wrong. */
function run(walk: StrandWalk, answers: boolean[]): StrandWalk {
  let current = walk;
  let i = 0;
  while (current.pending !== null) {
    current = answerWalk(current, answers[i] ?? false);
    i += 1;
  }
  return current;
}

describe('placement — the ladder is built whole, then walked', () => {
  test('every ladder grade has content, and the ladder is ascending', () => {
    for (const strand of STRAND_ORDER) {
      const ladder = ladderFor(strand);
      expect(ladder).toEqual([...ladder].sort((a, b) => a - b));
      for (const grade of ladder) expect(contentGradesFor(strand)).toContain(grade);
    }
  });

  // The matrix is sparse by nature and these are the shapes the stepping rule has
  // to survive: a two-grade ladder, a ladder with a hole in it, a single-grade one.
  test('the ladders are ragged — chords is [4, 5], while intervals is now unbroken', () => {
    expect(ladderFor('chords')).toEqual([4, 5]);
    expect(ladderFor('intervals')).toEqual([1, 2, 3, 4, 5]);
    expect(ladderFor('context')).toEqual([1, 2, 3, 4, 5]);
  });

  test('a strand with no markable content is never offered an item', () => {
    for (const strand of STRAND_ORDER) {
      if (ladderFor(strand).length > 0) continue;
      expect(placeableStrands()).not.toContain(strand);
      expect(startWalk(strand, MIXED_PASS_BUDGET).pending).toBeNull();
    }
  });

  // The reason the filter exists. `term_meaning_flashcard` is self-graded and
  // `key_signature_id` throws on two of its own cells; neither may reach a learner.
  test('the load-time probe records why it dropped a template, rather than swallowing it', () => {
    expect(PLACEMENT_SKIPS).toContainEqual({ strand: 'terms_signs', grade: 1, template: 'term_meaning_flashcard', reason: 'self-graded' });
    expect(PLACEMENT_SKIPS.some((s) => s.reason === 'no-instance' && s.template === 'key_signature_id')).toBe(true);
  });

  // The list says what this build cannot mark. Drawing questions must not add to
  // it: unmemoised, the probe re-ran on every draw and appended the same skip again,
  // so a long session turned a three-line fact into an unbounded log.
  test('drawing questions does not grow the skip list, and no cell is recorded twice', () => {
    const before = PLACEMENT_SKIPS.length;
    let session = startPlacement();
    let seed = 0;
    while (!isPlacementComplete(session)) {
      currentItem(session, seed++);
      session = answerPlacement(session, seed % 2 === 0);
    }
    expect(PLACEMENT_SKIPS).toHaveLength(before);

    const keys = PLACEMENT_SKIPS.map((s) => `${s.strand}:${s.grade}:${s.template}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // A cell whose only template is self-graded must still be dropped from the
  // ladder, not merely skipped when the item is drawn — the mid-walk filtering bug
  // this rule exists to prevent. terms_signs grade 1 no longer demonstrates it
  // (`term_meaning` was paired onto those lessons), so the guard is on the rule.
  test('no ladder grade would serve a self-graded item', () => {
    for (const strand of STRAND_ORDER) {
      for (const grade of ladderFor(strand)) {
        const item = walkItem({ ...startWalk(strand, 1), pending: grade }, 3);
        expect(item).not.toBeNull();
        expect(SELF_GRADED_INTERACTIONS.has(item!.instance.interaction.type)).toBe(false);
      }
    }
  });
});

describe('placement — where a walk opens', () => {
  // An even-length ladder has no middle. On the one-item mixed pass the opening
  // grade IS the measurement, so it is pinned rather than left to rounding.
  // Both cases are here on purpose: chords' ladder is even (4, 5) and takes the
  // LOWER of the two middles; scales_keys' is odd (1-5) and takes the true middle.
  test('the mixed pass opens at the lower median — chords at 4, scales_keys at 3', () => {
    expect(ladderFor('chords')).toEqual([4, 5]);
    expect(startWalk('chords', MIXED_PASS_BUDGET).pending).toBe(4);
    expect(ladderFor('scales_keys')).toEqual([1, 2, 3, 4, 5]);
    expect(startWalk('scales_keys', MIXED_PASS_BUDGET).pending).toBe(3);
  });

  // Seed decay subtracts whole grades from a number never required to be a content
  // grade, so a re-test start must snap or it lands on a cell with no question.
  test('a re-test at a depth the strand has no content for snaps down to the nearest grade it does', () => {
    expect(startWalk('chords', LADDER_BUDGET, 4).pending).toBe(4);
    expect(startWalk('chords', LADDER_BUDGET, 2).pending).toBe(4);
  });

  test('a re-test below every content grade opens at the lowest — chords at depth 3 starts at 4', () => {
    expect(startWalk('chords', LADDER_BUDGET, 3).pending).toBe(4);
  });

  test('a re-test at depth 0 opens at the lowest grade, not at nothing', () => {
    expect(startWalk('rhythm', LADDER_BUDGET, 0).pending).toBe(ladderFor('rhythm')[0]);
  });

  test('a re-test at a grade the strand does teach opens exactly there', () => {
    expect(startWalk('intervals', LADDER_BUDGET, 3).pending).toBe(3);
  });
});

describe('placement — the walk steps adaptively and never repeats a grade', () => {
  // The assertion a four-static-question implementation fails.
  test('the second question is higher after a correct answer and lower after a wrong one', () => {
    // scales_keys' ladder is 1-5, so a ladder walk opens at the middle, 3.
    const opened = startWalk('scales_keys', LADDER_BUDGET);
    expect(opened.pending).toBe(3);
    expect(answerWalk(opened, true).pending).toBe(4);
    expect(answerWalk(opened, false).pending).toBe(2);
  });

  test('stepping up from intervals grade 1 lands on 2, now that grade 2 exists', () => {
    expect(answerWalk(startWalk('intervals', LADDER_BUDGET, 1), true).pending).toBe(2);
  });

  // The ragged-ladder rule still has a subject: chords starts at 4, so a step
  // up from its first rung must skip 1-3 rather than walk them.
  test('a ladder that starts above grade 1 still steps within its own rungs', () => {
    expect(answerWalk(startWalk('chords', LADDER_BUDGET, 4), true).pending).toBe(5);
  });

  // chords is the shortest ladder left: [4, 5]. It stops at two, not at four.
  test('a short strand asks its ladder once, not four repeats of it', () => {
    expect(run(startWalk('chords', LADDER_BUDGET), [true, true]).asked.length).toBeLessThanOrEqual(2);
  });

  // The invariant the never-revisit rule buys. A bare budget of 4 lets chords
  // oscillate 4 -> 5 -> 4 -> 5 and spend every question re-asking a known answer.
  test.each([
    ['all right', [true, true, true, true]],
    ['all wrong', [false, false, false, false]],
    ['alternating from right', [true, false, true, false]],
    ['alternating from wrong', [false, true, false, true]],
  ])('under %s, no walk asks a grade twice or exceeds min(budget, ladder length)', (_name, answers) => {
    for (const strand of placeableStrands()) {
      const walk = run(startWalk(strand, LADDER_BUDGET), answers);
      expect(new Set(walk.asked).size).toBe(walk.asked.length);
      expect(walk.asked.length).toBeLessThanOrEqual(Math.min(LADDER_BUDGET, walk.ladder.length));
    }
  });

  test('a two-grade ladder answered right then wrong stops after both grades, not after four', () => {
    expect(run(startWalk('chords', LADDER_BUDGET), [true, false]).asked).toEqual([4, 5]);
  });

  test('the mixed pass budget stops each strand after one question, however it was answered', () => {
    for (const strand of placeableStrands()) {
      expect(run(startWalk(strand, MIXED_PASS_BUDGET), [true, true, true, true]).asked).toHaveLength(1);
    }
  });

  test('answering a finished walk changes nothing', () => {
    const done = run(startWalk('context', LADDER_BUDGET), [true]);
    expect(answerWalk(done, false)).toBe(done);
  });
});

describe('placement — the depth a walk resolves to', () => {
  test('it is the highest grade answered correctly', () => {
    // Opens at 3, right -> 4, right -> 5, wrong. The highest CORRECT grade is 4,
    // and the failed 5 must not raise it.
    expect(walkDepth(run(startWalk('scales_keys', LADDER_BUDGET), [true, true, false]))).toBe(4);
  });

  test('all wrong resolves to 0 — a real measurement, not an absence', () => {
    expect(walkDepth(run(startWalk('rhythm', LADDER_BUDGET), [false, false, false, false]))).toBe(0);
  });

  test('a correct answer never resolves below a wrong one at the same opening grade', () => {
    for (const strand of placeableStrands()) {
      const right = walkDepth(run(startWalk(strand, MIXED_PASS_BUDGET), [true]));
      const wrong = walkDepth(run(startWalk(strand, MIXED_PASS_BUDGET), [false]));
      expect(right).toBeGreaterThanOrEqual(wrong);
    }
  });

  test('a walk never resolves above its strand’s highest content grade', () => {
    for (const strand of placeableStrands()) {
      const grades = contentGradesFor(strand);
      const depth = walkDepth(run(startWalk(strand, LADDER_BUDGET), [true, true, true, true]));
      expect(depth).toBeLessThanOrEqual(grades[grades.length - 1]);
    }
  });
});

describe('placement — the mixed pass', () => {
  test('it covers every content-bearing strand exactly once', () => {
    let session = startPlacement();
    const asked: string[] = [];
    while (!isPlacementComplete(session)) {
      asked.push(session.walks[session.index].strand);
      session = answerPlacement(session, true);
    }
    expect(asked).toEqual(placeableStrands());
  });

  test('every served item belongs to the strand and grade its walk is measuring', () => {
    let session = startPlacement();
    let seed = 0;
    while (!isPlacementComplete(session)) {
      const walk = session.walks[session.index];
      const item = currentItem(session, seed++);
      expect(item).not.toBeNull();
      expect(item!.strand).toBe(walk.strand);
      expect(item!.grade).toBe(walk.pending);
      expect(item!.instance.strand).toBe(walk.strand);
      session = answerPlacement(session, false);
    }
  });

  test('a completed pass has no current item', () => {
    let session = startPlacement();
    while (!isPlacementComplete(session)) session = answerPlacement(session, true);
    expect(currentItem(session, 0)).toBeNull();
  });

  test('answering every item correctly places each strand at its own opening grade', () => {
    let session = startPlacement();
    const openings = Object.fromEntries(session.walks.map((w) => [w.strand, w.pending]));
    while (!isPlacementComplete(session)) session = answerPlacement(session, true);

    const outcome = placementOutcome(session);
    expect(outcome.kind).toBe('placed');
    expect(outcome.kind === 'placed' && outcome.depths).toEqual(openings);
  });

  // The distinction the two variants exist for: a measured 0 and an unmeasured
  // strand must never render as the same thing.
  test('an all-wrong pass is placed with 0 everywhere, and a skip carries no depths at all', () => {
    let session = startPlacement();
    while (!isPlacementComplete(session)) session = answerPlacement(session, false);

    expect(placementOutcome(session)).toEqual({
      kind: 'placed',
      depths: Object.fromEntries(placeableStrands().map((s) => [s, 0])),
    });
    expect(SKIPPED_PLACEMENT).toEqual({ kind: 'skipped' });
  });

  test('a pass abandoned partway reports only the strands it actually asked about', () => {
    let session = answerPlacement(startPlacement(), true);
    const outcome = placementOutcome(session);
    expect(outcome.kind === 'placed' && Object.keys(outcome.depths)).toEqual([placeableStrands()[0]]);
  });

  test('the outcome carries depths only — no day and no seq, which are U11’s to stamp', () => {
    let session = startPlacement();
    while (!isPlacementComplete(session)) session = answerPlacement(session, true);
    const outcome = placementOutcome(session);
    for (const value of Object.values(outcome.kind === 'placed' ? outcome.depths : {})) {
      expect(typeof value).toBe('number');
    }
  });
});
