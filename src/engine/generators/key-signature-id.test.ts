import { assembleOptions, gradeMcq } from '../../ui/grading';
import { scopeForGrade } from '../scope';
import { validate } from '../validator';
import { keySignatureId } from './key-signature-id';
import { atomsForLesson, optsFor } from './test-helpers';

const g1Clefs = scopeForGrade(1).clefs;

const KEYS = atomsForLesson('key-signatures'); // key_sig:{C,G,D,F}_major
const G1_TONICS = ['C', 'G', 'D', 'F'];

describe('keySignatureId — reproducibility (KTD4: pure function of seed + atoms)', () => {
  test('the same (seed, atoms) produces a deeply-equal instance', () => {
    expect(keySignatureId(optsFor(KEYS, 9))).toEqual(keySignatureId(optsFor(KEYS, 9)));
  });

  test('different seeds produce different instances', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) seen.add(JSON.stringify(keySignatureId(optsFor(KEYS, seed))));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('keySignatureId — key pool is atom-derived (R4, KTD5)', () => {
  test('with the key-signatures lesson atoms only C/G/D/F ever appear (unchanged from G1)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = keySignatureId(optsFor(KEYS, seed));
      const music = instance.stimulus.music as { clef: string; key_sig: string };
      const [tonic] = music.key_sig.split('_');
      expect(g1Clefs).toContain(music.clef);
      expect(G1_TONICS).toContain(tonic);
      for (const d of instance.distractors as string[]) {
        expect(G1_TONICS).toContain(d.split(' ')[0]);
      }
    }
  });

  test('normalizes key_sig:<T>_major → "<T> major" / "<T>_major", never a doubled "<T>_major major"', () => {
    // Restrict the pool to G and D so the assertion is deterministic.
    const twoKeys = ['key_sig:G_major', 'key_sig:D_major'];
    for (let seed = 0; seed < 20; seed++) {
      const instance = keySignatureId(optsFor(twoKeys, seed));
      const music = instance.stimulus.music as { key_sig: string };
      const canonical = instance.answer.canonical as string;
      expect(['G major', 'D major']).toContain(canonical);
      expect(['G_major', 'D_major']).toContain(music.key_sig);
      expect(canonical).not.toContain('_'); // no "G_major major"
      expect(instance.srs_tags).toEqual([`key_sig:${music.key_sig}`]);
    }
  });

  test('a two-key subset samples only those two keys, with the single other as the lone distractor', () => {
    const twoKeys = ['key_sig:C_major', 'key_sig:F_major'];
    for (let seed = 0; seed < 20; seed++) {
      const instance = keySignatureId(optsFor(twoKeys, seed));
      expect(['C major', 'F major']).toContain(instance.answer.canonical);
      expect(instance.distractors).toHaveLength(1);
      expect(['C major', 'F major']).toContain(instance.distractors[0]);
      expect(instance.distractors[0]).not.toBe(instance.answer.canonical);
    }
  });

  test('fewer than two key_sig:* atoms throws — no valid closed-item MCQ', () => {
    expect(() => keySignatureId(optsFor(['key_sig:C_major'], 0))).toThrow(/at least two/);
    expect(() => keySignatureId(optsFor([], 0))).toThrow(/at least two/);
  });
});

describe('keySignatureId — name-the-key mode answers "<Key> major"', () => {
  test('distractors are all wrong-but-plausible other G1 major keys, never the answer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = keySignatureId(optsFor(KEYS, seed));
      expect(instance.distractors.length).toBeGreaterThanOrEqual(1);
      for (const d of instance.distractors) expect(d).not.toBe(instance.answer.canonical);
    }
  });
});

describe('keySignatureId — fuzz gate: every generated item is validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(validate(keySignatureId(optsFor(KEYS, seed)))).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('keySignatureId — notation-answer MCQ render payload (U4/AD5)', () => {
  test('answer.canonical stays a semantic key-name string, never a Music object', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(typeof keySignatureId(optsFor(KEYS, seed)).answer.canonical).toBe('string');
    }
  });

  test('every assembled option (answer + distractors) carries a rendered key-signature stave', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = keySignatureId(optsFor(KEYS, seed));
      const options = assembleOptions(instance);
      expect(options).toHaveLength(instance.distractors.length + 1);
      for (const option of options) {
        expect(option.music).toBeDefined();
        expect(option.music?.key_sig).toBe(`${(option.value as string).split(' ')[0]}_major`);
      }
    }
  });

  // AD5's grading invariant: the rendered stave never leaks into `value`, so
  // grading stays a semantic-string deep-equal, not a Music-object comparison.
  test('grading compares the semantic value, never the option music payload', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = keySignatureId(optsFor(KEYS, seed));
      for (const option of assembleOptions(instance)) {
        expect(typeof option.value).toBe('string');
        expect(gradeMcq(instance, option.value)).toBe(option.correct);
      }
    }
  });
});
