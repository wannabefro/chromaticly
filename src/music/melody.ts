// Melodic writing by the general rules (chromaticly-e3o). One test per rule in
// melody.test.ts. The pool is an ASCENDING DIATONIC scale, so an index difference
// is scale steps and `index % 7` is a degree — hence no key signature here.

const STABLE_OPENINGS = [0, 2, 4] as const;

const STEP_WEIGHTS: readonly (readonly [number, number])[] = [
  [1, 62],
  [2, 20],
  [3, 9],
  [4, 6],
  [5, 2],
  [7, 1],
];

const TOTAL_WEIGHT = STEP_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

const LEAP = 3;

const RANGE = 9;

export interface MelodyRules {
  /** Index of the tonic within `pool`. Defaults to 0. */
  tonic?: number;
  /** Force the single highest note to this position. */
  climaxAt?: number;
  /** Force the single lowest note to this position. */
  nadirAt?: number;
  /** On by default; off for an excerpt with no cadence. */
  closeOnTonic?: boolean;
}

/** Write `count` pitches over an ascending diatonic `pool`. */
export function drawMelody(rng: () => number, pool: readonly string[], count: number, rules: MelodyRules = {}): string[] {
  if (pool.length === 0) throw new Error('drawMelody: the pitch pool is empty');
  if (count <= 0) return [];

  const tonic = rules.tonic ?? 0;
  const size = pool.length;
  // Reserved for the rules that step outside the walk. Without it they
  // fight RANGE, and the second check loses silently.
  const closes = rules.closeOnTonic !== false;
  const reserved = (rules.climaxAt !== undefined || rules.nadirAt !== undefined ? 1 : 0) + (closes ? 2 : 0) + 1;
  const span = Math.max(1, Math.min(RANGE - reserved, size - 1));
  const home = openOn(rng, size, tonic, span);

  const line = [home];
  for (let i = 1; i < count; i++) {
    line.push(nextNote(rng, line, size, span, tonic, i === count - 1 && closes));
  }

  placeExtreme(line, rules.climaxAt, size, 'high');
  placeExtreme(line, rules.nadirAt, size, 'low');
  return line.map((i) => pool[i]);
}

/** A uniform start puts a passage below the stave as often as it centres one. */
function openOn(rng: () => number, size: number, tonic: number, span: number): number {
  const degree = STABLE_OPENINGS[Math.floor(rng() * STABLE_OPENINGS.length)];
  const middle = (size - 1) / 2;
  let best: number | null = null;
  for (let i = 0; i < size; i++) {
    if (mod7(i - tonic) !== degree) continue;
    if (best === null || Math.abs(i - middle) < Math.abs(best - middle)) best = i;
  }
  return best ?? Math.round(middle);
}

function nextNote(rng: () => number, line: number[], size: number, span: number, tonic: number, closing: boolean): number {
  const from = line[line.length - 1];
  const ok = (i: number) => fits(i, line, span, size);

  if (closing) {
    const target = nearestDegree(from, tonic, size);
    if (target !== null) return target;
  }

  // Before leap recovery, and not compass-checked: 7 pulling to 8 outranks both.
  if (mod7(from - tonic) === 6 && from + 1 < size) return from + 1;

  const previous = line.length >= 2 ? line[line.length - 2] : null;
  if (previous !== null && Math.abs(from - previous) >= LEAP) {
    const back = from + (from > previous ? -1 : 1);
    if (ok(back)) return back;
  }

  const t = rng() * TOTAL_WEIGHT * 2;
  const up = t < TOTAL_WEIGHT;
  const step = weightedStep(up ? t : t - TOTAL_WEIGHT);
  for (const candidate of [from + (up ? step : -step), from + (up ? -step : step), from + (up ? -1 : 1), from + (up ? 1 : -1)]) {
    if (ok(candidate)) return candidate;
  }
  return from;
}

function fits(index: number, line: number[], span: number, size: number): boolean {
  if (index < 0 || index >= size) return false;
  return Math.max(...line, index) - Math.min(...line, index) <= span;
}

/** Position `at` becomes the line's ONE strict extreme. The climax rule and
 *  the "highest note" question are one mechanism. */
function placeExtreme(line: number[], at: number | undefined, size: number, dir: 'high' | 'low'): void {
  if (at === undefined || at < 0 || at >= line.length || line.length < 2) return;

  const others = line.filter((_, i) => i !== at);
  const target = dir === 'high' ? Math.max(...others) + 1 : Math.min(...others) - 1;

  // Out of the pool moves the LINE, not the climax, which must stay answerable.
  if (target < 0 || target >= size) {
    const shift = target < 0 ? -target : target - (size - 1);
    for (let i = 0; i < line.length; i++) {
      if (i !== at) line[i] = clamp(line[i] + (target < 0 ? shift : -shift), 0, size - 1);
    }
    const moved = line.filter((_, i) => i !== at);
    line[at] = clamp(dir === 'high' ? Math.max(...moved) + 1 : Math.min(...moved) - 1, 0, size - 1);
    return;
  }
  line[at] = target;
}

function nearestDegree(from: number, tonic: number, size: number): number | null {
  for (const delta of [-1, 1, -2, 2, 0, -3, 3]) {
    const at = from + delta;
    if (at >= 0 && at < size && mod7(at - tonic) === 0) return at;
  }
  return null;
}

function weightedStep(ticket: number): number {
  for (const [step, weight] of STEP_WEIGHTS) {
    if (ticket < weight) return step;
    ticket -= weight;
  }
  return 1;
}

function mod7(n: number): number {
  return ((n % 7) + 7) % 7;
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}
