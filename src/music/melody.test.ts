// One test per rule in melody.ts. A rule with no test here is a rule the next
// edit can delete silently.

import { drawMelody } from './melody';

function lcg(seed = 1): () => number {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

/** Two octaves of C major, so index % 7 is a scale degree. */
const POOL = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'];

const at = (p: string) => POOL.indexOf(p);
const degrees = (line: string[]) => line.map((p) => at(p) % 7);
const motion = (line: string[]) => line.slice(1).map((p, i) => at(p) - at(line[i]));

/** Every line the walk produces across a spread of seeds. */
function lines(count = 16, rules = {}): string[][] {
  return Array.from({ length: 60 }, (_, s) => drawMelody(lcg(s + 1), POOL, count, rules));
}

describe('drawMelody — the pool and the count are the contract', () => {
  test('every pitch comes from the pool', () => {
    expect(drawMelody(lcg(), POOL, 64).every((p) => POOL.includes(p))).toBe(true);
  });

  test('it returns exactly the count asked for', () => {
    expect(drawMelody(lcg(), POOL, 12)).toHaveLength(12);
  });

  // Boundaries, at the value rather than near it.
  test('a count of 1 is one note and a count of 0 is empty', () => {
    expect(drawMelody(lcg(), POOL, 1)).toHaveLength(1);
    expect(drawMelody(lcg(), POOL, 0)).toEqual([]);
  });

  test('an empty pool is an error, not a silent empty line', () => {
    expect(() => drawMelody(lcg(), [], 4)).toThrow(/pitch pool is empty/);
  });

  // Each guard alone: a pool of one has nowhere to move and must not index off
  // either end.
  test('a single-pitch pool repeats that pitch', () => {
    expect(new Set(drawMelody(lcg(), ['C4'], 5))).toEqual(new Set(['C4']));
  });

  test('the same seed gives the same line', () => {
    expect(drawMelody(lcg(42), POOL, 20)).toEqual(drawMelody(lcg(42), POOL, 20));
  });
});

describe('drawMelody — the rules of melodic writing', () => {
  test('it opens on a stable degree: tonic, mediant or dominant', () => {
    for (const line of lines()) expect([0, 2, 4]).toContain(degrees(line)[0]);
  });

  test('it closes on the tonic', () => {
    for (const line of lines()) expect(degrees(line).at(-1)).toBe(0);
  });

  test('closeOnTonic false lets an excerpt end anywhere', () => {
    expect(new Set(lines(16, { closeOnTonic: false }).map((l) => degrees(l).at(-1))).size).toBeGreaterThan(1);
  });

  test('most motion is by step', () => {
    const iv = lines().flatMap(motion);
    expect(iv.filter((d) => Math.abs(d) === 1).length / iv.length).toBeGreaterThan(0.5);
  });

  test('no interval is a seventh', () => {
    expect(lines().flatMap(motion).some((d) => Math.abs(d) === 6)).toBe(false);
  });

  // Two rules outrank the recovery: 7 still resolves UP, and the close
  // is a cadence, not a recovery.
  test('a leap of a fourth or more is recovered by step, the other way', () => {
    for (const line of lines()) {
      const m = motion(line);
      const d = degrees(line);
      for (let i = 0; i < m.length - 2; i++) {
        if (Math.abs(m[i]) < 3) continue;
        if (d[i + 1] === 6) continue;
        expect(Math.sign(m[i + 1])).toBe(-Math.sign(m[i]));
        expect(Math.abs(m[i + 1])).toBe(1);
      }
    }
  });

  test('the leading note resolves up to the tonic', () => {
    for (const line of lines()) {
      const d = degrees(line);
      for (let i = 0; i < d.length - 2; i++) {
        if (d[i] === 6) expect(at(line[i + 1]) - at(line[i])).toBe(1);
      }
    }
  });

  test('the line stays inside a tenth', () => {
    for (const line of lines(24)) {
      const idx = line.map(at);
      expect(Math.max(...idx) - Math.min(...idx)).toBeLessThanOrEqual(9);
    }
  });

  // Parking passes "mostly stepwise" trivially and ties every answer.
  test('it does not park — the line visits a real range', () => {
    for (const line of lines(24)) expect(new Set(line).size).toBeGreaterThan(3);
  });
});

// Measured over the Essen Folksong Collection: 5365 melodies, 259263 intervals.
// The bounds are wide: a generator must not copy a corpus exactly.
describe('drawMelody — the shape matches the Essen Folksong Collection', () => {
  const SAMPLE = Array.from({ length: 300 }, (_, s) => drawMelody(lcg(s + 1), POOL, 16));
  const IV = SAMPLE.flatMap(motion).map(Math.abs);
  const share = (test: (d: number) => boolean) => IV.filter(test).length / IV.length;

  test('it repeats a note about as often as folk melody does — Essen 22.2%', () => {
    expect(share((d) => d === 0)).toBeGreaterThan(0.15);
    expect(share((d) => d === 0)).toBeLessThan(0.28);
  });

  test('unison and step together carry the line — Essen 71.3%', () => {
    expect(share((d) => d <= 1)).toBeGreaterThan(0.65);
    expect(share((d) => d <= 1)).toBeLessThan(0.82);
  });

  test('a fourth or wider stays rare — Essen 11.5%', () => {
    expect(share((d) => d >= 3)).toBeLessThan(0.16);
  });

  // Huron's step inertia. This fails on any build that draws direction by coin.
  test('after a step the line more often runs on than turns — Essen reverses 44.5%', () => {
    let turns = 0;
    let steps = 0;
    for (const line of SAMPLE) {
      const m = motion(line);
      for (let i = 1; i < m.length; i++) {
        if (m[i - 1] === 0 || m[i] === 0 || Math.abs(m[i - 1]) >= 3) continue;
        steps++;
        if (Math.sign(m[i]) !== Math.sign(m[i - 1])) turns++;
      }
    }
    expect(turns / steps).toBeGreaterThan(0.36);
    expect(turns / steps).toBeLessThan(0.53);
  });

  test('the dominant is the commonest opening — Essen 54.9%, ahead of the tonic', () => {
    const first = SAMPLE.map((line) => degrees(line)[0]);
    const rate = (d: number) => first.filter((x) => x === d).length / first.length;
    expect(rate(4)).toBeGreaterThan(rate(0));
    expect(rate(0)).toBeGreaterThan(rate(2));
  });
});

describe('drawMelody — one climax, which is also the question', () => {
  test('climaxAt makes exactly one note the highest, and it is that one', () => {
    for (let s = 1; s <= 60; s++) {
      const idx = drawMelody(lcg(s), POOL, 16, { climaxAt: 9 }).map(at);
      const top = Math.max(...idx);
      expect(idx.filter((i) => i === top)).toHaveLength(1);
      expect(idx[9]).toBe(top);
    }
  });

  test('nadirAt makes exactly one note the lowest, and it is that one', () => {
    for (let s = 1; s <= 60; s++) {
      const idx = drawMelody(lcg(s), POOL, 16, { nadirAt: 4 }).map(at);
      const bottom = Math.min(...idx);
      expect(idx.filter((i) => i === bottom)).toHaveLength(1);
      expect(idx[4]).toBe(bottom);
    }
  });

  // Boundary: the first and last positions, not one inside them.
  test('the climax may sit at either end of the line', () => {
    for (const pos of [0, 15]) {
      const idx = drawMelody(lcg(5), POOL, 16, { climaxAt: pos }).map(at);
      expect(idx[pos]).toBe(Math.max(...idx));
    }
  });

  test('an out-of-bounds climax position is ignored, not a crash', () => {
    expect(() => drawMelody(lcg(), POOL, 8, { climaxAt: 99 })).not.toThrow();
    expect(() => drawMelody(lcg(), POOL, 8, { climaxAt: -1 })).not.toThrow();
  });
});
