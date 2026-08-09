// A step-biased walk over a diatonic pool (chromaticly-e3o). Not for the
// rhythm family, which holds one pitch on purpose.

/** Interval weights in scale steps. No 7th: it reads as a mistake. */
const STEP_WEIGHTS: readonly (readonly [number, number])[] = [
  [1, 62],
  [2, 20],
  [3, 9],
  [4, 6],
  [5, 2],
  [7, 1],
];

const TOTAL_WEIGHT = STEP_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

const TESSITURA = 6;

export interface MelodyOptions {
  /** Index into `pool`. Drawn if omitted. */
  start?: number;
  tessitura?: number;
}

/** Draw `count` pitches from an ASCENDING diatonic `pool`.
 *  Consumes `count - 1` rng draws with `start`, `count` without. */
export function drawMelody(rng: () => number, pool: readonly string[], count: number, options: MelodyOptions = {}): string[] {
  if (pool.length === 0) throw new Error('drawMelody: the pitch pool is empty');
  if (count <= 0) return [];

  const span = options.tessitura ?? Math.min(TESSITURA, Math.max(1, Math.floor((pool.length - 1) / 2)));
  // Centred, with jitter — a uniform draw puts a whole passage below the stave
  // about as often as it centres one.
  const home = options.start ?? Math.round((pool.length - 1) / 2 + (rng() - 0.5) * span);
  let index = clamp(home, 0, pool.length - 1);

  const line = [pool[index]];
  for (let i = 1; i < count; i++) {
    // One draw, split: half picks direction, remainder picks the interval.
    const t = rng() * TOTAL_WEIGHT * 2;
    const up = t < TOTAL_WEIGHT;
    const step = weightedStep(up ? t : t - TOTAL_WEIGHT);
    const wanted = index + (up ? step : -step);

    // Reflect, never clamp: clamping parks the line and ties the answer.
    index = inBounds(wanted, home, span, pool.length) ? wanted : reflect(index, step, up, home, span, pool.length);
    line.push(pool[index]);
  }
  return line;
}

function weightedStep(ticket: number): number {
  for (const [step, weight] of STEP_WEIGHTS) {
    if (ticket < weight) return step;
    ticket -= weight;
  }
  return 1;
}

function reflect(index: number, step: number, up: boolean, home: number, span: number, size: number): number {
  const back = index + (up ? -step : step);
  if (inBounds(back, home, span, size)) return back;
  const low = Math.max(0, home - span);
  const high = Math.min(size - 1, home + span);
  return index - low > high - index ? low : high;
}

function inBounds(index: number, home: number, span: number, size: number): boolean {
  return index >= 0 && index < size && Math.abs(index - home) <= span;
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}
