import { mulberry32, weighted } from '../rng';
import { scopeForGrade } from '../scope';
import {
  BAR_UNITS,
  COMPOUND_PATTERNS,
  COMPOUND_PATTERNS_BY_DEN,
  UNITS,
  barDurationUnits,
  barUnitsFor,
  buildBarDurations,
  buildCompoundBarDurations,
  corruptBarDurations,
  buildIrregularBarDurations,
  type BarDuration,
  type SimpleDuration,
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

  test('BAR_UNITS matches the D3 table plus the Grade-4 and Grade-5 metres exactly', () => {
    expect(BAR_UNITS).toEqual({
      '2/4': 16, '3/4': 24, '4/4': 32, '6/8': 24, '9/8': 36, '12/8': 48,
      '2/8': 8, '3/8': 12, '4/8': 16, '6/4': 48, '9/4': 72, '12/4': 96,
      '6/16': 12, '9/16': 18, '12/16': 24,
      '5/4': 40, '7/4': 56, '5/8': 20, '7/8': 28,
    });
  });

  test('each new metre total = num × (32/den)', () => {
    expect(BAR_UNITS['2/8']).toBe(2 * 4);
    expect(BAR_UNITS['6/4']).toBe(6 * 8);
    expect(BAR_UNITS['12/16']).toBe(12 * 2);
    expect(BAR_UNITS['5/4']).toBe(5 * 8);
    expect(BAR_UNITS['7/8']).toBe(7 * 4);
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

// Denominator-general beat splitter — throws if any event straddles a beat of
// `beatUnits`, or if the bar ends mid-beat.
function splitIntoBeatsOf(events: readonly BarDuration[], beatUnits: number): BarDuration[][] {
  const beats: BarDuration[][] = [];
  let current: BarDuration[] = [];
  let posInBeat = 0;
  for (const ev of events) {
    const units = barDurationUnits(ev);
    if (posInBeat + units > beatUnits) throw new Error('event crosses a beat boundary');
    current.push(ev);
    posInBeat += units;
    if (posInBeat === beatUnits) {
      beats.push(current);
      current = [];
      posInBeat = 0;
    }
  }
  if (current.length > 0) throw new Error('trailing partial beat');
  return beats;
}

describe('bar-math — Grade 4 compound metres (/4 and /16)', () => {
  const CASES = [
    { sig: '6/4', beatUnits: 24, beats: 2 },
    { sig: '9/4', beatUnits: 24, beats: 3 },
    { sig: '12/4', beatUnits: 24, beats: 4 },
    { sig: '6/16', beatUnits: 6, beats: 2 },
    { sig: '9/16', beatUnits: 6, beats: 3 },
    { sig: '12/16', beatUnits: 6, beats: 4 },
  ] as const;

  test.each(CASES)('$sig bars over seeds 0..99 sum exactly to BAR_UNITS and never straddle a beat', ({ sig, beatUnits, beats }) => {
    for (let seed = 0; seed < 100; seed++) {
      const events = buildCompoundBarDurations(mulberry32(seed), sig);
      const total = events.reduce((sum, ev) => sum + barDurationUnits(ev), 0);
      expect(total).toBe(BAR_UNITS[sig]);
      expect(splitIntoBeatsOf(events, beatUnits)).toHaveLength(beats);
    }
  });

  test('/16 bars never emit a note below a demisemiquaver', () => {
    for (const sig of ['6/16', '9/16', '12/16'] as const) {
      for (let seed = 0; seed < 100; seed++) {
        for (const ev of buildCompoundBarDurations(mulberry32(seed), sig)) {
          expect(UNITS[ev.dur]).toBeGreaterThanOrEqual(UNITS.demisemiquaver);
        }
      }
    }
  });
});

describe('bar-math — COMPOUND_PATTERNS_BY_DEN: materialized pattern tables (Codex C3)', () => {
  test('/8 set is the original COMPOUND_PATTERNS (byte-identity)', () => {
    expect(COMPOUND_PATTERNS_BY_DEN[8]).toBe(COMPOUND_PATTERNS);
  });

  test('/4 set keeps all six patterns (scale-up never underflows)', () => {
    expect(COMPOUND_PATTERNS_BY_DEN[4]).toHaveLength(6);
  });

  test('/16 set drops exactly the demisemiquaver-bearing pattern → five patterns', () => {
    expect(COMPOUND_PATTERNS_BY_DEN[16]).toHaveLength(5);
  });

  test.each([
    [4, 24],
    [8, 12],
    [16, 6],
  ])('every /%i pattern sums to one beat (%i units) and uses only supported durations', (den, beatUnits) => {
    for (const pattern of COMPOUND_PATTERNS_BY_DEN[den]) {
      const total = pattern.reduce((sum, d) => sum + barDurationUnits(d), 0);
      expect(total).toBe(beatUnits);
      for (const d of pattern) expect(UNITS[d.dur]).toBeGreaterThanOrEqual(UNITS.demisemiquaver);
    }
  });

  test('every denominator retains the headline single-dotted-beat pattern and at least one split', () => {
    for (const den of [4, 8, 16]) {
      const patterns = COMPOUND_PATTERNS_BY_DEN[den];
      expect(patterns.some((p) => p.length === 1 && p[0].dots === 1)).toBe(true); // headline dotted beat
      expect(patterns.some((p) => p.length > 1)).toBe(true); // at least one multi-note split
    }
  });
});

describe('bar-math — corruptBarDurations never injects breve (Grade 4 defensive fix)', () => {
  test('breve is never a corruption alternative, even though scope.noteValues includes it at grade 4', () => {
    const pool = scopeForGrade(4).noteValues as readonly SimpleDuration[];
    for (const sig of ['2/4', '3/4', '4/4'] as const) {
      for (let seed = 0; seed < 100; seed++) {
        const original = buildBarDurations(mulberry32(seed), barUnitsFor(sig), pool);
        const corrupted = corruptBarDurations(mulberry32(seed + 1000), [...original], pool);
        expect(corrupted).not.toContain('breve');
      }
    }
  });
});

// chromaticly-e3z.6. The invariant is not "the bar sums right" — buildBarDurations
// already does that. It is that no note crosses a group boundary, because the
// beaming that boundary produces IS what the metre is taught by.
describe('buildIrregularBarDurations — no note crosses the group join', () => {
  const POOL = ['demisemiquaver', 'semiquaver', 'quaver', 'crotchet', 'minim'] as const;
  const CROTCHET = 8;
  const GROUPS: Record<string, number[]> = {
    '5/4': [3 * CROTCHET, 2 * CROTCHET],
    '7/4': [3 * CROTCHET, 2 * CROTCHET, 2 * CROTCHET],
    '5/8': [1.5 * CROTCHET, 1 * CROTCHET],
    '7/8': [1.5 * CROTCHET, 1 * CROTCHET, 1 * CROTCHET],
  };

  test.each(['5/4', '7/4', '5/8', '7/8'])('every group of %s is filled exactly, over many seeds', (sig) => {
    for (let seed = 0; seed < 40; seed++) {
      const durations = buildIrregularBarDurations(mulberry32(seed), sig, POOL);
      const edges = new Set<number>();
      let cumulative = 0;
      for (const span of GROUPS[sig]) {
        cumulative += span;
        edges.add(cumulative);
      }
      // Walk the bar; every boundary must fall ON a note edge, never inside one.
      let pos = 0;
      const reached = new Set<number>([0]);
      for (const d of durations) {
        pos += UNITS[d];
        reached.add(pos);
      }
      expect(pos).toBe(barUnitsFor(sig));
      for (const edge of edges) expect(reached.has(edge)).toBe(true);
    }
  });

  test('a regular metre throws rather than quietly filling as one run', () => {
    expect(() => buildIrregularBarDurations(mulberry32(0), '4/4', POOL)).toThrow('4/4');
    expect(() => buildIrregularBarDurations(mulberry32(0), '6/8', POOL)).toThrow('6/8');
  });
});
