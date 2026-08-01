// note_naming_stave_input (chromaticly-lgi): the reverse of note_naming — the
// note is named and the learner places it. The invariants that matter are the
// two that make a placement REACHABLE: the stave input offers sharp, natural
// and flat only, and it has a slot only for a pitch in the clef's grade range.

import { generate } from './index';
import { scopeForGrade } from '../scope';
import { validate } from '../validator';

const TREBLE = ['note_read:treble:C4', 'note_read:treble:E4', 'note_read:treble:G4'];
const SHARPS = ['note_read:treble:F#4', 'note_read:treble:C#5'];

function make(atoms: string[], seed = 0, grade = 1) {
  return generate('note_naming_stave_input', { grade, seed, atoms });
}

function answer(atoms: string[], seed = 0, grade = 1) {
  return make(atoms, seed, grade).answer.canonical as { pitch: string; dur: string };
}

describe('note_naming_stave_input', () => {
  test('the answer pitch is always one the lesson declared — the draw is atom-scoped', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(TREBLE).toContain(`note_read:treble:${answer(TREBLE, seed).pitch}`);
    }
  });

  test('the clef travels in interaction.config — a named-note item has no stimulus to read it off', () => {
    const inst = make(TREBLE);
    expect(inst.stimulus.music).toBeNull();
    expect((inst.interaction.config as { clef: string }).clef).toBe('treble');
  });

  test('the prompt names the note and the duration, because both are graded', () => {
    const inst = make(SHARPS, 3);
    const { dur } = inst.answer.canonical as { dur: string };
    expect(inst.prompt).toContain(dur);
    expect(inst.prompt).toMatch(/Write [A-G]( (sharp|flat))?/);
  });

  test('an accidental is kept in the answer pitch, since the picker sets one', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(answer(SHARPS, seed).pitch).toMatch(/^[A-G]#\d$/);
    }
  });

  test('a double accidental fails loud — the picker cannot place F double sharp', () => {
    expect(() => make(['note_read:treble:F##4'], 0, 4)).toThrow();
    expect(() => make(['note_read:bass:Bbb3'], 0, 4)).toThrow();
  });

  test('a pitch outside the clef range at that grade fails loud, rather than asking for a slot that is not drawn', () => {
    expect(() => make(['note_read:treble:C6'], 0, 1)).toThrow();
  });

  test('the same pitch one grade wider is placeable — the guard is the range, not the pitch', () => {
    expect(answer(['note_read:treble:C6'], 0, 2).pitch).toBe('C6');
  });

  test('the duration is in the grade scope, so the palette can offer it', () => {
    const values = scopeForGrade(1).noteValues as readonly string[];
    for (let seed = 0; seed < 20; seed++) expect(values).toContain(answer(TREBLE, seed).dur);
  });

  test('the tag is the note that was drawn, so credit lands on that note alone', () => {
    for (let seed = 0; seed < 10; seed++) {
      const inst = make(TREBLE, seed);
      expect(inst.srs_tags).toEqual([`note_read:treble:${(inst.answer.canonical as { pitch: string }).pitch}`]);
    }
  });

  test('there are no distractors — a placement is not chosen from a list', () => {
    expect(make(TREBLE).distractors).toEqual([]);
  });

  test('seeds 0..99 all produce a validator-clean instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(validate(make(TREBLE, seed))).toEqual({ ok: true, errors: [] });
    }
  });

  test('the same seed produces the same item', () => {
    expect(make(TREBLE, 7)).toEqual(make(TREBLE, 7));
  });
});
