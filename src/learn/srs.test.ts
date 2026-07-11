import { BOX_INTERVALS, initialSrs, isDue, reviewSrs, selectDue, type SrsState } from './srs';

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
