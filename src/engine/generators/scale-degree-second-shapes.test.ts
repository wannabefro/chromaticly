// The two second shapes for scale_degree_id (chromaticly-lgi). Each reverses
// its own branch, so the invariants are about what the reversal must NOT leak:
// the written degree gets no printed key signature to read the accidental off,
// and the printed triad gets no key signature, which would name the answer.

import { generate } from './index';
import { validate } from '../validator';

const DEGREES = ['degree:1', 'degree:3', 'degree:5', 'degree:7'];
const TRIAD = ['tonic_triad'];

function write(seed: number, grade = 1) {
  return generate('scale_degree_stave_input', { grade, seed, atoms: DEGREES });
}

function keyId(seed: number, grade = 1) {
  return generate('tonic_triad_key_id', { grade, seed, atoms: TRIAD });
}

describe('scale_degree_stave_input — the degree is named and written', () => {
  test('no key signature is printed, so the accidental has to be known', () => {
    const inst = write(0);
    expect(inst.stimulus.music).toBeNull();
    expect(inst.prompt).toContain('with any accidental it needs');
  });

  test('any alternative offered is the same letter in another octave, never another note', () => {
    for (let seed = 0; seed < 30; seed++) {
      const inst = write(seed);
      const { pitch } = inst.answer.canonical as { pitch: string };
      for (const alt of inst.answer.accepted_alternatives as { pitch: string }[]) {
        expect(alt.pitch[0]).toBe(pitch[0]);
        expect(alt.pitch).not.toBe(pitch);
      }
    }
  });

  test('a stave that holds the letter twice does offer the second one — a degree is a pitch class', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => i);
    expect(seeds.some((seed) => write(seed, 3).answer.accepted_alternatives.length > 0)).toBe(true);
  });

  test('an alternative carries the same duration as the answer, or it would grade wrong', () => {
    const inst = write(2);
    const { dur } = inst.answer.canonical as { dur: string };
    for (const alt of inst.answer.accepted_alternatives as { dur: string }[]) expect(alt.dur).toBe(dur);
  });

  test('the tag is the degree drawn, so credit lands on that degree alone', () => {
    for (let seed = 0; seed < 10; seed++) {
      const tag = write(seed).srs_tags[0];
      expect(DEGREES).toContain(tag);
    }
  });

  test('an atom set naming no degree fails loud', () => {
    expect(() => generate('scale_degree_stave_input', { grade: 1, seed: 0, atoms: ['tonic_triad'] })).toThrow();
  });

  test('seeds 0..99 validate at every grade the lesson runs at', () => {
    for (const grade of [1, 2, 3]) {
      for (let seed = 0; seed < 100; seed++) {
        expect(validate(write(seed, grade))).toEqual({ ok: true, errors: [] });
      }
    }
  });
});

describe('tonic_triad_key_id — the triad is printed and its key named', () => {
  test('no key signature is printed, because it would name the answer', () => {
    expect((keyId(0).stimulus.music as { key_sig: unknown }).key_sig).toBeNull();
  });

  test('a distractor is never told it holds a degree it does not — a root outside the scale says so', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = keyId(seed, 3);
      for (const [option, reason] of Object.entries(inst.feedback.by_distractor ?? {})) {
        const key = option.replace(' major', '');
        expect(reason).toContain(key);
        expect(reason).toMatch(/(degree, not the 1st|is not in the)/);
      }
    }
  });

  test('the answer and its distractors are all in-scope major keys', () => {
    const inst = keyId(1, 2);
    for (const option of [inst.answer.canonical, ...inst.distractors]) {
      expect(String(option)).toMatch(/^[A-G][#b]? major$/);
    }
  });

  test('an atom set without tonic_triad fails loud', () => {
    expect(() => generate('tonic_triad_key_id', { grade: 1, seed: 0, atoms: ['degree:5'] })).toThrow();
  });

  test('seeds 0..99 validate at every grade the lesson runs at', () => {
    for (const grade of [1, 2, 3]) {
      for (let seed = 0; seed < 100; seed++) {
        expect(validate(keyId(seed, grade))).toEqual({ ok: true, errors: [] });
      }
    }
  });
});
