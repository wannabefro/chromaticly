import { G1_CLEFS, G1_KEYS_MAJOR } from '../scope';
import { validate } from '../validator';
import { keySignatureId } from './key-signature-id';

describe('keySignatureId — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = keySignatureId({ grade: 1, seed: 9 });
    const b = keySignatureId({ grade: 1, seed: 9 });
    expect(a).toEqual(b);
  });

  test('different seeds produce different instances', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seeds.add(JSON.stringify(keySignatureId({ grade: 1, seed })));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('keySignatureId — only C/G/D/F ever appear (scope)', () => {
  test('the sampled key and clef, and every distractor key, are within G1 scope', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = keySignatureId({ grade: 1, seed });
      const music = instance.stimulus.music as { clef: string; key_sig: string };
      const [tonic] = music.key_sig.split('_');

      expect(G1_CLEFS).toContain(music.clef);
      expect(G1_KEYS_MAJOR).toContain(tonic);

      for (const d of instance.distractors as string[]) {
        const [dTonic] = d.split(' ');
        expect(G1_KEYS_MAJOR).toContain(dTonic);
      }
    }
  });
});

describe('keySignatureId — name-the-key mode answers "<Key> major"', () => {
  test('G major renders as canonical "G major"', () => {
    let found = false;
    for (let seed = 0; seed < 30 && !found; seed++) {
      const instance = keySignatureId({ grade: 1, seed });
      if (instance.answer.canonical === 'G major') found = true;
    }
    expect(found).toBe(true);
  });

  test('distractors are all wrong-but-plausible: other G1 major keys, never the answer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = keySignatureId({ grade: 1, seed });
      expect(instance.distractors.length).toBeGreaterThanOrEqual(1);
      for (const d of instance.distractors) {
        expect(d).not.toBe(instance.answer.canonical);
      }
    }
  });
});

describe('keySignatureId — srs_tags', () => {
  test('emits a key_sig atom for the sampled major key', () => {
    const instance = keySignatureId({ grade: 1, seed: 2 });
    const music = instance.stimulus.music as { key_sig: string };
    expect(instance.srs_tags).toEqual([`key_sig:${music.key_sig}`]);
  });
});

describe('keySignatureId — fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = keySignatureId({ grade: 1, seed });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});
