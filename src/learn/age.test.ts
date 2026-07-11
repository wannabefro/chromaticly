import { isUnderThirteen } from './age';

describe('isUnderThirteen — birth-year approximation (A11: accepted, not calendar-exact)', () => {
  test('a 2015 birth year in 2026 (age 11) is under 13', () => {
    expect(isUnderThirteen(2015, 2026)).toBe(true);
  });

  test('a 2013 birth year in 2026 (turning 13) is not under 13 — exactly 13 is allowed', () => {
    expect(isUnderThirteen(2013, 2026)).toBe(false);
  });

  test('boundary: 12 years old is under 13, 13 years old is not', () => {
    expect(isUnderThirteen(2014, 2026)).toBe(true); // turning 12
    expect(isUnderThirteen(2013, 2026)).toBe(false); // turning 13
  });
});
