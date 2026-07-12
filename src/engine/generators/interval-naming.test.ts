import { musicToAbc } from '../../music/abc-emitter';
import type { Music } from '../../music/types';
import { G1_CLEFS, G1_KEYS_MAJOR, G1_NOTE_VALUES, pitchRange } from '../scope';
import { validate } from '../validator';
import { intervalNaming, intervalNamingStaveInput } from './interval-naming';
import { scientificPitchOrdinal } from './pitch-math';

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

      // Interval number counts letter positions, so compare on the natural
      // letter+octave — the upper note may carry a diatonic accidental (e.g.
      // Bb in F major) that does not change the step count.
      const naturalize = (p: string) => p.replace(/[#b]/, '');

      expect(G1_KEYS_MAJOR).toContain(tonic);
      expect(G1_CLEFS).toContain(music.clef);
      expect(lower[0]).toBe(tonic);

      const range = pitchRange(music.clef);
      expect(scientificPitchOrdinal(naturalize(lower))).toBeGreaterThanOrEqual(scientificPitchOrdinal(range.low));
      expect(scientificPitchOrdinal(naturalize(upper))).toBeLessThanOrEqual(scientificPitchOrdinal(range.high));

      // above tonic only, at most an octave (7 diatonic steps)
      const steps = scientificPitchOrdinal(naturalize(upper)) - scientificPitchOrdinal(naturalize(lower));
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

describe('intervalNaming — notes are spelled diatonically within the key', () => {
  // A G1 interval above the tonic is diatonic, so the key signature carries any
  // accidental and the emitter never prints an explicit natural (=) — e.g. the
  // 7th above D in D major must render as C#, not a chromatic C-natural.
  test('no generated interval renders an explicit accidental in the ABC body', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNaming({ grade: 1, seed });
      const abc = musicToAbc(instance.stimulus.music as Music);
      const body = abc.split('\n').filter((line) => !/^[A-Za-z]:/.test(line)).join('\n');
      expect(body).not.toMatch(/[=^_]/);
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

// U8/RD2: "write the note a [interval] higher than the given note" — the sole
// Grade 1 stave-input item. answer.canonical is the SEMANTIC target
// {pitch, dur}, not a rendered Music object (AD5) — grading (grading.test.ts)
// never deep-equals a Music object either.
describe('intervalNamingStaveInput — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = intervalNamingStaveInput({ grade: 1, seed: 11 });
    const b = intervalNamingStaveInput({ grade: 1, seed: 11 });
    expect(a).toEqual(b);
  });

  test('different seeds produce different instances', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seeds.add(JSON.stringify(intervalNamingStaveInput({ grade: 1, seed })));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('intervalNamingStaveInput — interaction shape', () => {
  test('interaction.type is stave_input', () => {
    const instance = intervalNamingStaveInput({ grade: 1, seed: 2 });
    expect(instance.interaction.type).toBe('stave_input');
  });

  test('stimulus renders exactly the given (lower) note — the learner writes the target, not the reverse', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = intervalNamingStaveInput({ grade: 1, seed });
      const music = instance.stimulus.music as Music;
      expect(music.voices[0].events).toHaveLength(1);
      expect(music.voices[0].events[0].type).toBe('note');
    }
  });
});

describe('intervalNamingStaveInput — canonical target is semantic {pitch, dur}, in G1 scope (ledger = middle C only)', () => {
  test('canonical is a scientific pitch + a G1 duration, within the sampled clef range, above the given note', () => {
    for (let seed = 0; seed < 50; seed++) {
      const instance = intervalNamingStaveInput({ grade: 1, seed });
      const music = instance.stimulus.music as {
        clef: 'treble' | 'bass';
        key_sig: string;
        voices: { events: { pitch: string }[] }[];
      };
      const canonical = instance.answer.canonical as { pitch: string; dur: string };
      const givenPitch = music.voices[0].events[0].pitch;

      expect(G1_CLEFS).toContain(music.clef);
      expect(G1_NOTE_VALUES).toContain(canonical.dur);

      const range = pitchRange(music.clef);
      const naturalize = (p: string) => p.replace(/[#b]/, '');
      expect(scientificPitchOrdinal(naturalize(canonical.pitch))).toBeGreaterThanOrEqual(scientificPitchOrdinal(range.low));
      expect(scientificPitchOrdinal(naturalize(canonical.pitch))).toBeLessThanOrEqual(scientificPitchOrdinal(range.high));

      // above the given note (RD2/G1_INTERVAL_RULE: above tonic only)
      expect(scientificPitchOrdinal(naturalize(canonical.pitch))).toBeGreaterThan(scientificPitchOrdinal(naturalize(givenPitch)));
    }
  });

  test('canonical answer is never a Music object — grading stays semantic (AD5)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = intervalNamingStaveInput({ grade: 1, seed });
      const canonical = instance.answer.canonical as Record<string, unknown>;
      expect(canonical).not.toHaveProperty('voices');
      expect(canonical).not.toHaveProperty('clef');
      expect(Object.keys(canonical).sort()).toEqual(['dur', 'pitch']);
    }
  });
});

describe('intervalNamingStaveInput — srs_tags', () => {
  test('emits the same interval-atom scheme as the mcq variant (shared mastery skill)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = intervalNamingStaveInput({ grade: 1, seed });
      expect(instance.srs_tags[0]).toMatch(/^interval:\d+$/);
    }
  });
});

describe('intervalNamingStaveInput — fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNamingStaveInput({ grade: 1, seed });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});
