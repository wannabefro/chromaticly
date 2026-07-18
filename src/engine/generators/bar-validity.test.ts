import type { Music, MusicEvent } from '../../music/types';
import { scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { validate } from '../validator';
import { barRange, barValidity } from './bar-validity';

const g1NoteValues = scopeForGrade(1).noteValues;
const g1TimeSignatures = scopeForGrade(1).timeSignatures;

// Independent (not-generator-internal) recomputation of bar beat sums, mirroring
// rhythm-sum.test.ts's own independent BEATS table — a real invariant check, not
// a restatement of the generator's own arithmetic.
const UNITS: Record<string, number> = { semiquaver: 1, quaver: 2, crotchet: 4, minim: 8, semibreve: 16 };
const BAR_UNITS: Record<string, number> = { '2/4': 8, '3/4': 12, '4/4': 16 };

function barsFromInstance(instance: ExerciseInstance): MusicEvent[][] {
  const bars = instance.interaction.config.bars as { start: number; end: number }[];
  const music = instance.stimulus.music as Music;
  const events = music.voices[0].events;
  return bars.map((b) => events.slice(b.start, b.end));
}

describe('barValidity — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = barValidity({ grade: 1, seed: 5, atoms: [] });
    const b = barValidity({ grade: 1, seed: 5, atoms: [] });
    expect(a).toEqual(b);
  });

  test('different seeds produce different instances', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seeds.add(JSON.stringify(barValidity({ grade: 1, seed, atoms: [] })));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('barValidity — per-bar verdict matches whether that bar\'s note values actually sum to the time signature', () => {
  test('every per_item entry agrees with an independent recomputation of the bar\'s beat total', () => {
    for (let seed = 0; seed < 50; seed++) {
      const instance = barValidity({ grade: 1, seed, atoms: [] });
      const timeSig = instance.stimulus.music!.time_sig as string;
      const target = BAR_UNITS[timeSig];
      const perItem = instance.answer.per_item as boolean[];
      const barEventLists = barsFromInstance(instance);

      expect(barEventLists).toHaveLength(perItem.length);

      barEventLists.forEach((events, i) => {
        const total = events.reduce((sum, ev) => {
          if (ev.type !== 'note') throw new Error('expected only note events within a bar range');
          return sum + UNITS[ev.dur as string];
        }, 0);
        expect(total === target).toBe(perItem[i]);
      });
    }
  });
});

describe('barValidity — 4-6 bars, corrupt fraction lands in [40%, 60%]', () => {
  test('bar count is always 4, 5, or 6', () => {
    for (let seed = 0; seed < 50; seed++) {
      const instance = barValidity({ grade: 1, seed, atoms: [] });
      const perItem = instance.answer.per_item as boolean[];
      expect(perItem.length).toBeGreaterThanOrEqual(4);
      expect(perItem.length).toBeLessThanOrEqual(6);
    }
  });

  test('the fraction of false (corrupted) bars is within [0.4, 0.6] for every seed', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = barValidity({ grade: 1, seed, atoms: [] });
      const perItem = instance.answer.per_item as boolean[];
      const corruptFraction = perItem.filter((v) => v === false).length / perItem.length;
      expect(corruptFraction).toBeGreaterThanOrEqual(0.4 - 1e-9);
      expect(corruptFraction).toBeLessThanOrEqual(0.6 + 1e-9);
    }
  });
});

describe('barValidity — bar-identity metadata (F10)', () => {
  test('interaction.config.bars length equals answer.per_item length', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = barValidity({ grade: 1, seed, atoms: [] });
      const bars = instance.interaction.config.bars as unknown[];
      const perItem = instance.answer.per_item as boolean[];
      expect(bars).toHaveLength(perItem.length);
    }
  });

  test('barRange (the control->bar mapping fn) returns each bar\'s event range, not a geometry guess', () => {
    const instance = barValidity({ grade: 1, seed: 3, atoms: [] });
    const bars = instance.interaction.config.bars as { start: number; end: number }[];
    bars.forEach((expected, i) => {
      expect(barRange(instance, i)).toEqual(expected);
    });
  });

  test('barRange throws for an out-of-range bar index (fail loud, no silent geometry fallback)', () => {
    const instance = barValidity({ grade: 1, seed: 3, atoms: [] });
    const barCount = (instance.answer.per_item as boolean[]).length;
    expect(() => barRange(instance, barCount)).toThrow();
    expect(() => barRange(instance, -1)).toThrow();
  });
});

describe('barValidity — interaction shape', () => {
  test('emits a true_false interaction with a bar-ordered per_item boolean array', () => {
    const instance = barValidity({ grade: 1, seed: 1, atoms: [] });
    expect(instance.interaction.type).toBe('true_false');
    expect(Array.isArray(instance.answer.per_item)).toBe(true);
    for (const v of instance.answer.per_item as unknown[]) {
      expect(typeof v).toBe('boolean');
    }
  });

  test('every emitted time signature and note value is in G1 scope', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = barValidity({ grade: 1, seed, atoms: [] });
      expect(g1TimeSignatures).toContain(instance.stimulus.music!.time_sig);
      for (const ev of instance.stimulus.music!.voices[0].events) {
        if (ev.type === 'note') expect(g1NoteValues).toContain(ev.dur);
      }
    }
  });
});

describe('barValidity — srs_tags', () => {
  test('emits the bare bar_validity atom', () => {
    const instance = barValidity({ grade: 1, seed: 1, atoms: [] });
    expect(instance.srs_tags).toEqual(['bar_validity']);
  });
});

describe('barValidity — fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = barValidity({ grade: 1, seed, atoms: [] });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});
