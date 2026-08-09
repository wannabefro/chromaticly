// The melody walk (chromaticly-e3o). The properties asserted here are the ones a
// caller relies on: it stays in the pool, it stays in a band, it moves mostly by
// step, and it consumes a fixed number of rng draws.

import { drawMelody } from './melody';

/** A deterministic uniform source. `drawMelody` must never assume more than this. */
function lcg(seed = 1): () => number {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

const POOL = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5'];

/** Adjacent intervals in SCALE STEPS, which is what the pool's indices measure. */
function steps(line: string[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < line.length; i++) out.push(Math.abs(POOL.indexOf(line[i]) - POOL.indexOf(line[i - 1])));
  return out;
}

describe('drawMelody — the line stays inside its pool and its band', () => {
  test('every pitch comes from the pool', () => {
    const line = drawMelody(lcg(), POOL, 64);
    expect(line.every((p) => POOL.includes(p))).toBe(true);
  });

  test('it returns exactly the count asked for', () => {
    expect(drawMelody(lcg(), POOL, 12)).toHaveLength(12);
  });

  // The boundary itself, not a value near it.
  test('a count of 1 is the start note alone, and a count of 0 is empty', () => {
    expect(drawMelody(lcg(), POOL, 1)).toHaveLength(1);
    expect(drawMelody(lcg(), POOL, 0)).toEqual([]);
  });

  test('a count of 0 is empty even on an empty-ish pool of one pitch', () => {
    expect(drawMelody(lcg(), ['C4'], 0)).toEqual([]);
  });

  // A pool of one has no room to move; it must not index off the end.
  test('a single-pitch pool yields that pitch, not an undefined', () => {
    expect(drawMelody(lcg(), ['C4'], 5)).toEqual(['C4', 'C4', 'C4', 'C4', 'C4']);
  });

  test('an empty pool is an error, not a silent empty line', () => {
    expect(() => drawMelody(lcg(), [], 4)).toThrow(/pitch pool is empty/);
  });

  test('the line stays within its tessitura of the start', () => {
    const line = drawMelody(lcg(), POOL, 64, { start: 6, tessitura: 3 });
    const indices = line.map((p) => POOL.indexOf(p));
    expect(Math.max(...indices)).toBeLessThanOrEqual(9);
    expect(Math.min(...indices)).toBeGreaterThanOrEqual(3);
  });

  // The boundary value, not one inside it: tessitura 0 must hold one note.
  test('a tessitura of 0 pins the line to its start note', () => {
    expect(new Set(drawMelody(lcg(), POOL, 8, { start: 4, tessitura: 0 }))).toEqual(new Set([POOL[4]]));
  });
});

describe('drawMelody — the shape is a melody, which is the whole point', () => {
  // Uniform picking over this pool scores about 0.15 here.
  test('most motion is by step', () => {
    const iv = steps(drawMelody(lcg(9), POOL, 600));
    expect(iv.filter((x) => x === 1).length / iv.length).toBeGreaterThan(0.5);
  });

  test('leaps of a sixth or more are rare', () => {
    const iv = steps(drawMelody(lcg(9), POOL, 600));
    expect(iv.filter((x) => x >= 5).length / iv.length).toBeLessThan(0.06);
  });

  // Parking passes "mostly stepwise" trivially and ties every answer.
  test('it does not park — the line visits a real range', () => {
    const line = drawMelody(lcg(9), POOL, 200, { start: 6 });
    expect(new Set(line).size).toBeGreaterThan(5);
  });

  test('direction is not correlated with interval size', () => {
    const line = drawMelody(lcg(3), POOL, 600);
    const rising = line.filter((_, i) => i > 0 && POOL.indexOf(line[i]) > POOL.indexOf(line[i - 1])).length;
    // A strong skew means the sign rides on the interval's own draw.
    expect(rising / line.length).toBeGreaterThan(0.35);
    expect(rising / line.length).toBeLessThan(0.65);
  });
});

describe('drawMelody — rng draws are a contract, because snapshots ride on them', () => {
  test('a supplied start consumes one draw fewer than a derived one', () => {
    let withStart = 0;
    const a = () => {
      withStart += 1;
      return 0.5;
    };
    drawMelody(a, POOL, 10, { start: 4 });

    let derived = 0;
    const b = () => {
      derived += 1;
      return 0.5;
    };
    drawMelody(b, POOL, 10);

    expect(withStart).toBe(9);
    expect(derived).toBe(10);
  });

  test('the same seed gives the same line', () => {
    expect(drawMelody(lcg(42), POOL, 20)).toEqual(drawMelody(lcg(42), POOL, 20));
  });
});
