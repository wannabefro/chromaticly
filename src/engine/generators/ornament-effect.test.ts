// ornament_effect (chromaticly-lgi): the ornament is named and its pattern
// chosen. The tag has to follow the LESSON's direction, not the shape — a
// grade-5 written-to-sign lesson credits its own atom, or a clean set scores
// nothing (the bug ornaments-to-sign-5 already hit once).

import { generate } from './index';
import { validate } from '../validator';

const G4 = ['ornament:trill', 'ornament:turn', 'ornament:upper_mordent', 'ornament:lower_mordent'];
const G5 = G4.map((a) => `${a}:written_to_sign`);

function make(seed = 0, grade = 4, atoms = G4) {
  return generate('ornament_effect', { grade, seed, atoms });
}

describe('ornament_effect', () => {
  test('the ornament is the stimulus text and no notation is shown — the pattern is the answer', () => {
    const inst = make();
    expect(inst.stimulus.music).toBeNull();
    expect(typeof inst.stimulus.text).toBe('string');
  });

  test('the prompt takes the right article for the name it uses', () => {
    const prompts = new Set(Array.from({ length: 20 }, (_, seed) => make(seed).prompt));
    for (const prompt of prompts) expect(prompt).toMatch(/^What does (a|an) [a-z ]+ play\?$/);
    expect([...prompts].some((p) => p.startsWith('What does an'))).toBe(true);
  });

  test('a grade-5 written-to-sign lesson credits its own atom, not the bare one', () => {
    for (let seed = 0; seed < 10; seed++) {
      expect(make(seed, 5, G5).srs_tags[0]).toMatch(/:written_to_sign$/);
      expect(make(seed, 4, G4).srs_tags[0]).not.toMatch(/:written_to_sign$/);
    }
  });

  test('every option is a different ornament pattern, and each wrong one is named', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = make(seed);
      const options = [inst.answer.canonical, ...inst.distractors];
      expect(new Set(options).size).toBe(options.length);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors as string[]) expect(reasons[d]).toMatch(/^That is /);
    }
  });

  test('a lesson mixing the two directions fails loud', () => {
    expect(() => make(0, 5, ['ornament:trill', 'ornament:turn:written_to_sign'])).toThrow();
  });

  test('an atom set naming no ornament fails loud', () => {
    expect(() => make(0, 4, ['term:trill'])).toThrow();
  });

  test('seeds 0..99 validate in both directions', () => {
    for (const [grade, atoms] of [[4, G4], [5, G5]] as const) {
      for (let seed = 0; seed < 100; seed++) {
        expect(validate(make(seed, grade, atoms))).toEqual({ ok: true, errors: [] });
      }
    }
  });
});
