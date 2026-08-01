// rest_value_id (chromaticly-lgi): the rest is printed and named. Recognising
// the glyph and working out what a bar is missing are different skills, so this
// is a second shape for the rests lessons, not a reskin of rest_completion.

import { generate } from './index';
import { scopeForGrade } from '../scope';
import { validate } from '../validator';

const G1_RESTS = ['rest:crotchet', 'rest:minim', 'rest:semibreve'];

function make(seed = 0, grade = 1, atoms = G1_RESTS) {
  return generate('rest_value_id', { grade, seed, atoms });
}

describe('rest_value_id', () => {
  test('the rest is the stimulus, not an option — the question is what it is', () => {
    const inst = make();
    const music = inst.stimulus.music as { voices: { events: { type: string }[] }[] };
    expect(music.voices[0].events[0].type).toBe('rest');
    expect(inst.interaction.config?.option_music).toBeUndefined();
  });

  test('the answer is one of the lesson\'s own rests', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(G1_RESTS).toContain(`rest:${String(make(seed).answer.canonical).replace(' rest', '')}`);
    }
  });

  test('every option is a rest the grade actually teaches', () => {
    const rests = scopeForGrade(3).rests as readonly string[];
    const inst = make(1, 3, ['rest:quaver', 'rest:crotchet', 'rest:minim']);
    for (const option of [inst.answer.canonical, ...inst.distractors]) {
      expect(rests).toContain(String(option).replace(' rest', ''));
    }
  });

  test('a distractor states its own length and how it compares — never a shared line', () => {
    const inst = make(2, 4, ['rest:breve', 'rest:semibreve']);
    const reasons = inst.feedback.by_distractor ?? {};
    for (const d of inst.distractors as string[]) expect(reasons[d]).toMatch(/lasts .*, .* as long as this one\./);
    expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
  });

  test('the tag is the rest drawn, so credit lands on that rest alone', () => {
    for (let seed = 0; seed < 10; seed++) {
      const inst = make(seed);
      expect(inst.srs_tags).toEqual([`rest:${String(inst.answer.canonical).replace(' rest', '')}`]);
    }
  });

  test('an atom set naming no rest fails loud', () => {
    expect(() => make(0, 1, ['note_read:treble:C4'])).toThrow();
  });

  test('seeds 0..99 validate at every grade a rests lesson runs at', () => {
    for (const grade of [1, 3, 4]) {
      for (let seed = 0; seed < 100; seed++) {
        expect(validate(make(seed, grade))).toEqual({ ok: true, errors: [] });
      }
    }
  });
});
