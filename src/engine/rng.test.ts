import { deriveSeed, int, mulberry32, pick, weighted } from './rng';

describe('mulberry32 — determinism', () => {
  test('the same seed produces the identical sequence across independent instances', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  test('different seeds produce differing sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  test('outputs stay within [0, 1)', () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('deriveSeed — pure hash for reject-and-regenerate reproducibility', () => {
  test('the same (seed, attempt) pair always yields the same derived seed', () => {
    expect(deriveSeed(42, 3)).toBe(deriveSeed(42, 3));
  });

  test('calling it twice does not drift (no hidden mutable state)', () => {
    const first = deriveSeed(7, 1);
    deriveSeed(7, 1);
    deriveSeed(7, 1);
    const again = deriveSeed(7, 1);
    expect(again).toBe(first);
  });

  test('a different attempt number yields a different derived seed for the same seed', () => {
    expect(deriveSeed(42, 0)).not.toBe(deriveSeed(42, 1));
  });

  test('a different seed yields a different derived seed for the same attempt', () => {
    expect(deriveSeed(1, 0)).not.toBe(deriveSeed(2, 0));
  });
});

describe('pick — uniform selection stays in-bounds and is deterministic', () => {
  test('every draw is one of the supplied items across many draws', () => {
    const rng = mulberry32(5);
    const items = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 200; i++) {
      expect(items).toContain(pick(rng, items));
    }
  });

  test('the same seed picks the same sequence of items', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const rngA = mulberry32(77);
    const rngB = mulberry32(77);
    const seqA = Array.from({ length: 20 }, () => pick(rngA, items));
    const seqB = Array.from({ length: 20 }, () => pick(rngB, items));
    expect(seqA).toEqual(seqB);
  });
});

describe('int — inclusive bounds', () => {
  test('every draw falls within [min, max] inclusive across many draws, including at the bounds', () => {
    const rng = mulberry32(11);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = int(rng, 1, 3);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([1, 2, 3]));
  });

  test('the same seed produces the same sequence of draws', () => {
    const rngA = mulberry32(21);
    const rngB = mulberry32(21);
    const seqA = Array.from({ length: 20 }, () => int(rngA, 0, 100));
    const seqB = Array.from({ length: 20 }, () => int(rngB, 0, 100));
    expect(seqA).toEqual(seqB);
  });
});

describe('weighted — respects weights and stays deterministic', () => {
  test('every draw is one of the declared values across many draws', () => {
    const rng = mulberry32(3);
    const items = [
      { value: 'rare', weight: 1 },
      { value: 'common', weight: 9 },
    ];
    const values = new Set<string>();
    for (let i = 0; i < 200; i++) {
      values.add(weighted(rng, items));
    }
    expect(values).toEqual(new Set(['rare', 'common']));
  });

  test('a zero-weight item is never drawn', () => {
    const rng = mulberry32(4);
    const items = [
      { value: 'never', weight: 0 },
      { value: 'always', weight: 1 },
    ];
    for (let i = 0; i < 200; i++) {
      expect(weighted(rng, items)).toBe('always');
    }
  });

  test('the same seed produces the same sequence of weighted draws', () => {
    const items = [
      { value: 'a', weight: 2 },
      { value: 'b', weight: 3 },
      { value: 'c', weight: 5 },
    ];
    const rngA = mulberry32(55);
    const rngB = mulberry32(55);
    const seqA = Array.from({ length: 20 }, () => weighted(rngA, items));
    const seqB = Array.from({ length: 20 }, () => weighted(rngB, items));
    expect(seqA).toEqual(seqB);
  });
});
