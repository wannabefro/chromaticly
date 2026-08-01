// satb_voice_position (chromaticly-lgi): recognition reads a marked note and
// names its voice; this asks where a named voice is written, which is what a
// learner needs to WRITE an SATB chord. The staff/stem table is the invariant.

import { generate } from './index';
import { validate } from '../validator';

const ATOMS = ['satb_voice:soprano', 'satb_voice:alto', 'satb_voice:tenor', 'satb_voice:bass'];

function make(seed = 0, atoms = ATOMS) {
  return generate('satb_voice_position', { grade: 5, seed, atoms });
}

const EXPECTED: Record<string, string> = {
  Soprano: 'Treble staff, stem up',
  Alto: 'Treble staff, stem down',
  Tenor: 'Bass staff, stem up',
  Bass: 'Bass staff, stem down',
};

describe('satb_voice_position', () => {
  test('the answer is the voice\'s own staff and stem', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      expect(inst.answer.canonical).toBe(EXPECTED[inst.stimulus.text as string]);
    }
  });

  test('the other three positions are the options, so every voice is contrasted', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = make(seed);
      const options = [inst.answer.canonical, ...inst.distractors].sort();
      expect(options).toEqual(Object.values(EXPECTED).sort());
    }
  });

  test('the question is asked without notation — the rule is recalled, not read', () => {
    expect(make(1).stimulus.music).toBeNull();
  });

  test('each wrong position is told whose it is, and the three differ', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = make(seed);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors as string[]) expect(reasons[d]).toMatch(/^That is where the (Soprano|Alto|Tenor|Bass) goes\./);
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });

  test('the tag is the voice asked about, so credit lands on that voice', () => {
    for (let seed = 0; seed < 20; seed++) expect(ATOMS).toContain(make(seed).srs_tags[0]);
  });

  test('an unknown voice and a missing atom both fail loud', () => {
    expect(() => make(0, ['satb_voice:descant'])).toThrow();
    expect(() => make(0, ['chord:I'])).toThrow();
  });

  test('a grade other than 5 fails loud, matching the recognition shape', () => {
    expect(() => generate('satb_voice_position', { grade: 4, seed: 0, atoms: ATOMS })).toThrow();
  });

  test('seeds 0..99 validate', () => {
    for (let seed = 0; seed < 100; seed++) expect(validate(make(seed))).toEqual({ ok: true, errors: [] });
  });
});
