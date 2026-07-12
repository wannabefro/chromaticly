import { BOX_INTERVALS, DEFAULT_EASE, initialSrs, isDue, reviewSrs, reviewSrsGraded, selectDue, type SrsState } from './srs';

describe('srs — a correct attempt promotes the box and pushes the next-due further out', () => {
  test('box climbs and the interval grows with each correct review', () => {
    let s = initialSrs(0);
    const boxes: number[] = [];
    for (let i = 0; i < 6; i++) {
      s = reviewSrs(s, true, s.nextDue);
      boxes.push(s.box);
    }
    expect(boxes).toEqual([1, 2, 3, 4, 4, 4]); // caps at the top box
    expect(s.nextDue - s.lastReviewed).toBe(BOX_INTERVALS[BOX_INTERVALS.length - 1]);
  });
});

describe('srs — a wrong attempt demotes to box 0 and is due immediately', () => {
  test('a miss resets the box and sets next-due to now', () => {
    let s = initialSrs(0);
    s = reviewSrs(s, true, 0);
    s = reviewSrs(s, true, 1); // box 2
    s = reviewSrs(s, false, 5);
    expect(s.box).toBe(0);
    expect(s.nextDue).toBe(5);
    expect(isDue(s, 5)).toBe(true);
  });
});

describe('srs — due-ness reflects the schedule', () => {
  test('an atom is not due before its nextDue tick and is due at/after it', () => {
    const s = reviewSrs(initialSrs(0), true, 0); // box 1, interval 1 → due at 1
    expect(isDue(s, 0)).toBe(false);
    expect(isDue(s, 1)).toBe(true);
  });
});

describe('srs — Practice ordering: recently-missed atoms come before mastered ones', () => {
  test('selectDue serves a just-missed atom ahead of a well-drilled one (why: weak/overdue first)', () => {
    const now = 20;
    // "mastered": promoted several times, last reviewed long ago but only mildly overdue.
    let strong = initialSrs(0);
    for (let i = 0; i < 4; i++) strong = reviewSrs(strong, true, strong.nextDue);
    strong = { ...strong, nextDue: now }; // just became due
    // "recently missed": box 0, due now.
    const weak: SrsState = reviewSrs(initialSrs(10), false, now);

    const order = selectDue(
      [
        { atom: 'strong', srs: strong },
        { atom: 'weak', srs: weak },
      ],
      now,
      () => true,
    );
    expect(order[0]).toBe('weak');
  });

  test('selectDue excludes not-yet-due atoms and ineligible (locked) atoms', () => {
    const now = 0;
    const dueNow = reviewSrs(initialSrs(0), false, 0); // due at 0
    const notYet = reviewSrs(initialSrs(0), true, 0); // due at 1

    const entries = [
      { atom: 'unlocked-due', srs: dueNow },
      { atom: 'unlocked-future', srs: notYet },
      { atom: 'locked-due', srs: dueNow },
    ];
    const eligible = (a: string) => !a.startsWith('locked');

    expect(selectDue(entries, now, eligible)).toEqual(['unlocked-due']);
  });
});

describe('srs — reviewSrs (binary path) is unchanged by the U6 graded-SRS addition', () => {
  test('regression guard: exact box/nextDue for a fixed correct/wrong sequence', () => {
    let s = initialSrs(0);
    s = reviewSrs(s, true, 0);
    expect(s).toEqual({ box: 1, lastReviewed: 0, nextDue: 1 });
    s = reviewSrs(s, true, 1);
    expect(s).toEqual({ box: 2, lastReviewed: 1, nextDue: 3 });
    s = reviewSrs(s, false, 3);
    expect(s).toEqual({ box: 0, lastReviewed: 3, nextDue: 3 });
  });
});

describe('srs — reviewSrsGraded (U6, AD4): self-graded flashcard scheduling', () => {
  test('AE4: resulting interval is strictly monotonic Again < Hard < Good < Easy from the same starting state', () => {
    const start = initialSrs(0);
    const now = 0;
    const intervalFor = (grade: 'again' | 'hard' | 'good' | 'easy') => {
      const next = reviewSrsGraded(start, grade, now);
      return next.nextDue - now;
    };
    const again = intervalFor('again');
    const hard = intervalFor('hard');
    const good = intervalFor('good');
    const easy = intervalFor('easy');
    expect(again).toBeLessThan(hard);
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThan(easy);
  });

  test('strictly monotonic even from a state already at the ease floor or ceiling (clamp does not collapse the ordering)', () => {
    const now = 100;
    for (const startEase of [1.3, 2.5, 3.5]) {
      const start: SrsState = { box: 2, lastReviewed: 0, nextDue: 0, ease: startEase };
      const again = reviewSrsGraded(start, 'again', now).nextDue - now;
      const hard = reviewSrsGraded(start, 'hard', now).nextDue - now;
      const good = reviewSrsGraded(start, 'good', now).nextDue - now;
      const easy = reviewSrsGraded(start, 'easy', now).nextDue - now;
      expect(again).toBeLessThan(hard);
      expect(hard).toBeLessThan(good);
      expect(good).toBeLessThan(easy);
    }
  });

  test('ease adjusts per grade: easy raises ease, again lowers it, relative to the prior value', () => {
    const start: SrsState = { box: 0, lastReviewed: 0, nextDue: 0, ease: DEFAULT_EASE };
    const afterEasy = reviewSrsGraded(start, 'easy', 0);
    const afterAgain = reviewSrsGraded(start, 'again', 0);
    expect(afterEasy.ease).toBeGreaterThan(DEFAULT_EASE);
    expect(afterAgain.ease).toBeLessThan(DEFAULT_EASE);
    expect(afterAgain.ease).toBeLessThan(afterEasy.ease as number);
  });

  test('a state with no ease yet (pre-U6 snapshot) defaults to DEFAULT_EASE before adjusting', () => {
    const start: SrsState = { box: 0, lastReviewed: 0, nextDue: 0 }; // no `ease`
    const next = reviewSrsGraded(start, 'good', 0);
    expect(next.ease).toBe(DEFAULT_EASE); // 'good' applies a zero delta
  });

  test('"again" reschedules to due now or very soon, never later than a lower grade', () => {
    const start = initialSrs(5);
    const next = reviewSrsGraded(start, 'again', 5);
    expect(next.nextDue).toBe(5); // due immediately, like a Leitner demotion to box 0
    expect(isDue(next, 5)).toBe(true);
  });
});
