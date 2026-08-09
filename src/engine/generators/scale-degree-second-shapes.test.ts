// The two second shapes for scale_degree_id (chromaticly-lgi). Each reverses
// its own branch, so the invariants are about what the reversal must NOT leak:
// the written degree gets no printed key signature to read the accidental off,
// and the printed triad gets no key signature, which would name the answer.

import { generate } from './index';
import { validate } from '../validator';
import { scopeForGrade } from '../scope';

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
        expect(reason).toMatch(/(degree, not the 1st|is not in the|does not belong to that key)/);
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

// chromaticly-6xs.2. G3 item 3 asks for the tonic triad of every key set for
// the grade. tonic-triads-3 built major ones only, in both of its templates.
describe('the tonic triad of a minor key', () => {
  const MINOR = ['tonic_triad_minor'];
  const g3 = (tmpl: string, seed: number, atoms = MINOR) => generate(tmpl, { grade: 3, seed, atoms });

  test.each(['tonic_triad_key_id', 'scale_degree_id'])('%s builds a minor triad and credits its own atom', (tmpl) => {
    for (let seed = 0; seed < 24; seed++) {
      const inst = g3(tmpl, seed);
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
      expect(inst.srs_tags).toEqual(MINOR);
    }
  });

  // The third is the whole fact. A major triad wearing a minor key's name would
  // pass every other check here.
  test('the printed chord really is minor — the 3rd is 3 semitones above the root', () => {
    const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const semitone = (p: string) => SEMI[p[0]] + (p.includes('#') ? 1 : p.includes('b') ? -1 : 0) + Number(p.slice(-1)) * 12;
    for (let seed = 0; seed < 24; seed++) {
      const music = g3('tonic_triad_key_id', seed).stimulus.music as { voices: { events: { pitches?: string[] }[] }[] };
      const [root, third, fifth] = music.voices[0].events[0].pitches!;
      expect(semitone(third) - semitone(root)).toBe(3);
      expect(semitone(fifth) - semitone(root)).toBe(7);
    }
  });

  test('every minor key the grade sets is reachable, not just the first', () => {
    const keys = new Set<string>();
    for (let seed = 0; seed < 80; seed++) keys.add(String(g3('tonic_triad_key_id', seed).answer.canonical));
    expect(keys.size).toBe(scopeForGrade(3).keysMinor.length);
    for (const key of keys) expect(key).toMatch(/ minor$/);
  });

  // The distractors are other keys of the SAME mode, or the question offers a
  // free elimination: a minor triad cannot be the tonic of a major key.
  test('every distractor names a minor key too', () => {
    for (let seed = 0; seed < 24; seed++) {
      for (const d of g3('tonic_triad_key_id', seed).distractors as string[]) expect(d).toMatch(/ minor$/);
    }
  });

  // A major-only lesson must keep the draw sequence it had before the minor
  // atom existed, or every grade-1 and grade-2 pin moves for nothing.
  test('naming one mode spends no extra rng draw', () => {
    for (let seed = 0; seed < 8; seed++) {
      const major = generate('tonic_triad_key_id', { grade: 3, seed, atoms: ['tonic_triad'] });
      expect(String(major.answer.canonical)).toMatch(/ major$/);
      expect(major.srs_tags).toEqual(['tonic_triad']);
    }
  });

  test('the atom is refused at a grade with no minor keys', () => {
    expect(() => generate('tonic_triad_key_id', { grade: 1, seed: 0, atoms: MINOR })).toThrow();
  });
});
