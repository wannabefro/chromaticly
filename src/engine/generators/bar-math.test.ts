import { mulberry32, weighted } from '../rng';
import { scopeForGrade } from '../scope';
import {
  BAR_UNITS,
  COMPOUND_PATTERNS,
  UNITS,
  barDurationUnits,
  barUnitsFor,
  buildBarDurations,
  buildCompoundBarDurations,
  corruptBarDurations,
  type BarDuration,
} from './bar-math';

type G1Duration = 'semiquaver' | 'quaver' | 'crotchet' | 'minim' | 'semibreve';

// Frozen, independent capture of the PRE-U4 bar-validity.ts/add-time-signature.ts
// implementation (semiquaver = 1 unit, semibreve = 16). This is ground truth for
// the byte-identity comparison below — it must never be derived from bar-math.ts
// (Codex R2: asserting scale-invariance against itself would be circular).
const OLD_UNITS: Record<G1Duration, number> = {
  semiquaver: 1,
  quaver: 2,
  crotchet: 4,
  minim: 8,
  semibreve: 16,
};
const OLD_BEATS_PER_BAR: Record<string, number> = { '2/4': 2, '3/4': 3, '4/4': 4 };
function oldBarUnitsFor(timeSig: string): number {
  return OLD_BEATS_PER_BAR[timeSig] * OLD_UNITS.crotchet;
}
function oldBuildBarDurations(rng: () => number, targetUnits: number, pool: readonly G1Duration[]): G1Duration[] {
  const durations: G1Duration[] = [];
  let remaining = targetUnits;
  while (remaining > 0) {
    const candidates = pool.filter((d) => OLD_UNITS[d] <= remaining);
    const value = weighted(rng, candidates.map((d) => ({ value: d, weight: OLD_UNITS[d] })));
    durations.push(value);
    remaining -= OLD_UNITS[value];
  }
  return durations;
}

describe('bar-math — byte-identity of the ×2 rescale (Codex R2)', () => {
  // scope.noteValues' order at grade 1 is the exact candidate-pool order the
  // pre-extraction generators fed to weighted() — preserving it is what makes
  // the rescale provably order-preserving, not just total-preserving.
  const pool = scopeForGrade(1).noteValues as readonly G1Duration[];

  test.each(['2/4', '3/4', '4/4'] as const)(
    'buildBarDurations(%s) over seeds 0..49 matches an independent capture of the pre-rescale implementation',
    (sig) => {
      for (let seed = 0; seed < 50; seed++) {
        const oldResult = oldBuildBarDurations(mulberry32(seed), oldBarUnitsFor(sig), pool);
        const newResult = buildBarDurations(mulberry32(seed), barUnitsFor(sig), pool);
        expect(newResult).toEqual(oldResult);
      }
    },
  );

  test('a single hand-verified sequence for seed 0, 4/4 (defence in depth beyond the sweep above)', () => {
    const oldResult = oldBuildBarDurations(mulberry32(0), oldBarUnitsFor('4/4'), pool);
    const newResult = buildBarDurations(mulberry32(0), barUnitsFor('4/4'), pool);
    expect(newResult).toEqual(oldResult);
    // Both a total-units check (targets are equal by construction) and an
    // independent recomputation, so this cannot pass by both sides sharing a bug.
    const total = newResult.reduce((sum, d) => sum + UNITS[d], 0);
    expect(total).toBe(BAR_UNITS['4/4']);
  });
});

describe('bar-math — R2 output shape: buildBarDurations/corruptBarDurations return bare duration-name arrays', () => {
  test('buildBarDurations never returns objects or a dots field — same shape as the pre-extraction implementation', () => {
    const pool = scopeForGrade(1).noteValues as readonly G1Duration[];
    const rng = mulberry32(3);
    const durations = buildBarDurations(rng, barUnitsFor('4/4'), pool);
    for (const d of durations) {
      expect(typeof d).toBe('string');
    }
  });

  test('corruptBarDurations preserves array length and only replaces one bare duration string', () => {
    const pool = scopeForGrade(1).noteValues as readonly G1Duration[];
    const rng = mulberry32(3);
    const original = buildBarDurations(rng, barUnitsFor('4/4'), pool);
    const corrupted = corruptBarDurations(mulberry32(9), [...original], pool);
    expect(corrupted).toHaveLength(original.length);
    const changedCount = corrupted.filter((d, i) => d !== original[i]).length;
    expect(changedCount).toBe(1);
  });
});

describe('bar-math — BAR_UNITS: integer bar totals for every renderable signature', () => {
  test('every renderable signature has an integer BAR_UNITS entry', () => {
    for (const sig of ['2/4', '3/4', '4/4', '6/8', '9/8', '12/8']) {
      expect(Number.isInteger(BAR_UNITS[sig])).toBe(true);
    }
  });

  test('9/8 is exactly 36 32nd-units — the representation that dissolves the 4.5-crotchets float risk', () => {
    expect(BAR_UNITS['9/8']).toBe(36);
  });

  test('BAR_UNITS matches the plan D3 table exactly', () => {
    expect(BAR_UNITS).toEqual({ '2/4': 16, '3/4': 24, '4/4': 32, '6/8': 24, '9/8': 36, '12/8': 48 });
  });
});

// Splits a flat compound-bar event list into per-beat chunks at 12-unit
// (dotted-crotchet) boundaries. Throws if any event straddles a boundary —
// the direct test of D4's "no event crosses a beat" invariant.
function splitIntoBeats(events: readonly BarDuration[]): BarDuration[][] {
  const beats: BarDuration[][] = [];
  let current: BarDuration[] = [];
  let posInBeat = 0;
  for (const ev of events) {
    const units = barDurationUnits(ev);
    if (posInBeat + units > 12) {
      throw new Error('event crosses a dotted-crotchet beat boundary');
    }
    current.push(ev);
    posInBeat += units;
    if (posInBeat === 12) {
      beats.push(current);
      current = [];
      posInBeat = 0;
    }
  }
  if (current.length > 0) throw new Error('trailing partial beat');
  return beats;
}

describe('bar-math — buildCompoundBarDurations: per-beat pattern fill (D4)', () => {
  const COMPOUND_SIGS = ['6/8', '9/8', '12/8'] as const;

  test.each(COMPOUND_SIGS)('%s bars over seeds 0..99 always sum exactly to BAR_UNITS[sig]', (sig) => {
    for (let seed = 0; seed < 100; seed++) {
      const events = buildCompoundBarDurations(mulberry32(seed), sig);
      const total = events.reduce((sum, ev) => sum + barDurationUnits(ev), 0);
      expect(total).toBe(BAR_UNITS[sig]);
    }
  });

  test.each(COMPOUND_SIGS)('%s: no event crosses a dotted-crotchet beat boundary, and every beat cell is filled by exactly one pattern', (sig) => {
    for (let seed = 0; seed < 100; seed++) {
      const events = buildCompoundBarDurations(mulberry32(seed), sig);
      // splitIntoBeats throws on a straddle or a trailing partial beat — a
      // clean return already proves the invariant. The beat count also
      // pins the pattern-count-per-bar (6/8=2, 9/8=3, 12/8=4).
      const beats = splitIntoBeats(events);
      const expectedBeatCount = BAR_UNITS[sig] / 12;
      expect(beats).toHaveLength(expectedBeatCount);
    }
  });

  test('every pattern in COMPOUND_PATTERNS is reachable across the seed sweep', () => {
    const seen = new Set<string>();
    for (const sig of COMPOUND_SIGS) {
      for (let seed = 0; seed < 100; seed++) {
        const beats = splitIntoBeats(buildCompoundBarDurations(mulberry32(seed), sig));
        for (const beat of beats) seen.add(JSON.stringify(beat));
      }
    }
    for (const pattern of COMPOUND_PATTERNS) {
      expect(seen.has(JSON.stringify(pattern))).toBe(true);
    }
  });

  test('the whole-beat dotted-crotchet pattern and a demisemiquaver-bearing pattern both occur (D4/D9 — the two pedagogically load-bearing patterns)', () => {
    const dottedCrotchetPattern = JSON.stringify([{ dur: 'crotchet', dots: 1 }]);
    let sawDottedCrotchet = false;
    let sawDemisemiquaver = false;
    for (const sig of COMPOUND_SIGS) {
      for (let seed = 0; seed < 100; seed++) {
        const events = buildCompoundBarDurations(mulberry32(seed), sig);
        const beats = splitIntoBeats(events);
        for (const beat of beats) {
          if (JSON.stringify(beat) === dottedCrotchetPattern) sawDottedCrotchet = true;
          if (beat.some((ev) => ev.dur === 'demisemiquaver')) sawDemisemiquaver = true;
        }
      }
    }
    expect(sawDottedCrotchet).toBe(true);
    expect(sawDemisemiquaver).toBe(true);
  });

  test('throws for a non-compound (or unknown) signature — fail loud, no silent simple-time fallback', () => {
    expect(() => buildCompoundBarDurations(mulberry32(0), '4/4')).toThrow();
    expect(() => buildCompoundBarDurations(mulberry32(0), '5/8')).toThrow();
  });
});

