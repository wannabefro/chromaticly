// Pure, deterministic PRNG utilities (KTD4: generation is a pure
// (template, grade, seed, kb_version) -> instance projection). No Math.random.

/** mulberry32 — deterministic uniform generator in [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a sub-seed from (seed, attempt) so reject-and-regenerate retries
 * stay reproducible: the same original seed always yields the same final
 * item, because each retry's seed is a pure function of the attempt number.
 * splitmix32-style integer hash mix.
 */
export function deriveSeed(seed: number, attempt: number): number {
  let z = (seed ^ Math.imul(attempt + 1, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

/** Uniform pick from a non-empty array. */
export function pick<T>(rng: () => number, items: T[]): T {
  return items[int(rng, 0, items.length - 1)];
}

/** Inclusive on both ends: int(rng, 1, 3) can return 1, 2, or 3. */
export function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Weighted pick from a non-empty array of {value, weight}. */
export function weighted<T>(rng: () => number, items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item.value;
  }
  return items[items.length - 1].value;
}
