// note_sounds_as (chromaticly-lgi): the misconception this shape exists to
// catch is "F double sharp is a kind of F". Both wrong options are therefore
// the under-moved spellings, and each says how far short it falls.

import { generate } from './index';
import { validate } from '../validator';

const ATOMS = ['note_read:treble:F##4', 'note_read:treble:G##4', 'note_read:bass:Bbb3', 'note_read:bass:Ebb3'];

function make(seed = 0, atoms = ATOMS) {
  return generate('note_sounds_as', { grade: 4, seed, atoms });
}

describe('note_sounds_as', () => {
  test('the answer is the note two semitones away, never the written letter', () => {
    const expected: Record<string, string> = { 'F##4': 'G', 'G##4': 'A', Bbb3: 'A', Ebb3: 'D' };
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      const pitch = (inst.stimulus.music as { voices: { events: { pitch: string }[] }[] }).voices[0].events[0].pitch;
      expect(inst.answer.canonical).toBe(expected[pitch]);
    }
  });

  test('both wrong options are the under-moved spellings, one semitone and none', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = make(seed);
      const pitch = (inst.stimulus.music as { voices: { events: { pitch: string }[] }[] }).voices[0].events[0].pitch;
      const letter = pitch[0];
      const once = `${letter} ${pitch.includes('#') ? 'sharp' : 'flat'}`;
      expect(inst.distractors).toEqual([once, letter]);
    }
  });

  test('each wrong option names its own shortfall, and the two differ', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = make(seed);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors as string[]) expect(typeof reasons[d]).toBe('string');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });

  test('the tag is the note read, so credit lands on the same atom naming does', () => {
    for (let seed = 0; seed < 20; seed++) expect(ATOMS).toContain(make(seed).srs_tags[0]);
  });

  test('a lesson whose notes carry no double accidental fails loud', () => {
    expect(() => make(0, ['note_read:treble:F#4', 'note_read:treble:C4'])).toThrow();
  });

  test('seeds 0..99 validate', () => {
    for (let seed = 0; seed < 100; seed++) expect(validate(make(seed))).toEqual({ ok: true, errors: [] });
  });
});
