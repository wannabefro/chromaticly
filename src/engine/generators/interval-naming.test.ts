import { G1_CLEFS, G1_KEYS_MAJOR, pitchRange } from '../scope';
import { validate } from '../validator';
import { scientificPitchOrdinal } from './pitch-math';
import { intervalNaming } from './interval-naming';

describe('intervalNaming — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = intervalNaming({ grade: 1, seed: 11 });
    const b = intervalNaming({ grade: 1, seed: 11 });
    expect(a).toEqual(b);
  });

  test('different seeds produce different instances', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seeds.add(JSON.stringify(intervalNaming({ grade: 1, seed })));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('intervalNaming — G1 rule: lower note pinned to the tonic, above-tonic only, <= an octave', () => {
  test('the chord\'s lower note is always the sampled key\'s tonic letter, and both pitches stay in clef range', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = intervalNaming({ grade: 1, seed });
      const music = instance.stimulus.music as {
        clef: 'treble' | 'bass';
        key_sig: string;
        voices: { events: { pitches: string[] }[] }[];
      };
      const [tonic] = music.key_sig.split('_');
      const [lower, upper] = music.voices[0].events[0].pitches;

      expect(G1_KEYS_MAJOR).toContain(tonic);
      expect(G1_CLEFS).toContain(music.clef);
      expect(lower[0]).toBe(tonic);

      const range = pitchRange(music.clef);
      expect(scientificPitchOrdinal(lower)).toBeGreaterThanOrEqual(scientificPitchOrdinal(range.low));
      expect(scientificPitchOrdinal(upper)).toBeLessThanOrEqual(scientificPitchOrdinal(range.high));

      // above tonic only, at most an octave (7 diatonic steps)
      const steps = scientificPitchOrdinal(upper) - scientificPitchOrdinal(lower);
      expect(steps).toBeGreaterThanOrEqual(1);
      expect(steps).toBeLessThanOrEqual(7);
    }
  });
});

describe('intervalNaming — answer is number-only', () => {
  test('canonical answer is an integer 2..8 (steps + 1, above tonic)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = intervalNaming({ grade: 1, seed });
      expect(typeof instance.answer.canonical).toBe('number');
      expect(instance.answer.canonical).toBeGreaterThanOrEqual(2);
      expect(instance.answer.canonical).toBeLessThanOrEqual(8);
    }
  });
});

describe('intervalNaming — distractor rule: +/-1 number', () => {
  test('every distractor is exactly one away from the canonical interval number', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = intervalNaming({ grade: 1, seed });
      const canonical = instance.answer.canonical as number;
      for (const d of instance.distractors as number[]) {
        expect(Math.abs(d - canonical)).toBe(1);
      }
    }
  });
});

describe('intervalNaming — srs_tags', () => {
  test('emits an interval atom for the answer number', () => {
    const instance = intervalNaming({ grade: 1, seed: 3 });
    expect(instance.srs_tags).toEqual([`interval:${instance.answer.canonical}`]);
  });
});

describe('intervalNaming — fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNaming({ grade: 1, seed });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});
