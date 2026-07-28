// The invariant: `now()` is whole days since the epoch and never goes backwards
// while wall-clock time moves forwards. SRS intervals (BOX_INTERVALS) are
// expressed in those units, so a clock that returned fractional or non-monotonic
// values would make "due in 2" mean nothing.

import { clockFrom, daysSinceEpoch, fixedClock, MS_PER_DAY } from './clock';

describe('Clock — whole days since epoch (G6 U1)', () => {
  test('returns an integer day, not a fractional one', () => {
    const clock = clockFrom(() => 1_785_200_000_000);
    expect(Number.isInteger(clock.now())).toBe(true);
  });

  test('two instants within the same day read the same day', () => {
    const midnightish = 20_600 * MS_PER_DAY;
    expect(daysSinceEpoch(midnightish)).toBe(20_600);
    expect(daysSinceEpoch(midnightish + MS_PER_DAY - 1)).toBe(20_600);
  });

  test('the next millisecond after a day boundary is the next day', () => {
    expect(daysSinceEpoch(20_600 * MS_PER_DAY + MS_PER_DAY)).toBe(20_601);
  });

  test('is monotonic across an advancing source', () => {
    let ms = 20_600 * MS_PER_DAY;
    const clock = clockFrom(() => ms);
    const first = clock.now();
    ms += MS_PER_DAY * 3;
    const second = clock.now();
    expect(second).toBeGreaterThan(first);
    expect(second - first).toBe(3);
  });

  test('the test clock advances by whole days', () => {
    const clock = fixedClock(10);
    expect(clock.now()).toBe(10);
    clock.advance(30);
    expect(clock.now()).toBe(40);
    clock.set(0);
    expect(clock.now()).toBe(0);
  });
});
