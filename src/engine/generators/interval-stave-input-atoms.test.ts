// interval_naming_stave_input (chromaticly-lgi): the write-the-note shape now
// reads the lesson's own atom family. Before this it always tagged interval:<n>,
// so an intervals-2/3/4 set scored nothing — the same bug ornaments-to-sign-5
// hit. The tag per branch is therefore the invariant under test.

import { generate } from './index';
import { validate } from '../validator';
import { gradeStaveInput } from '../../ui/grading';

const KEY = ['interval_key:A_major', 'interval_key:Bb_major', 'interval_key:A_minor', 'interval_key:D_minor'];
const TYPE = ['interval_type:2', 'interval_type:3', 'interval_type:5', 'interval_type:8'];
const ANY = ['interval_any:2', 'interval_any:4', 'interval_any:6', 'interval_any:7'];

function make(seed: number, grade: number, atoms: string[]) {
  return generate('interval_naming_stave_input', { grade, seed, atoms });
}

describe('interval_naming_stave_input atom scoping', () => {
  test('an interval_key lesson credits the key it drew, and names it in the prompt', () => {
    for (let seed = 0; seed < 30; seed++) {
      const inst = make(seed, 2, KEY);
      expect(KEY).toContain(inst.srs_tags[0]);
      expect(inst.prompt).toMatch(/^This is [A-G]b? (major|minor)\. Write the note/);
    }
  });

  test('an interval_type lesson credits the number it asked for, not a bare interval atom', () => {
    for (let seed = 0; seed < 30; seed++) {
      const inst = make(seed, 3, TYPE);
      const [, n] = /^interval_type:(\d)$/.exec(inst.srs_tags[0]) ?? [];
      expect(TYPE).toContain(inst.srs_tags[0]);
      expect(inst.prompt).toContain(`${n}${{ 2: 'nd', 3: 'rd' }[Number(n)] ?? 'th'} higher`);
    }
  });

  test('an interval_any lesson drops the key signature — the domain is any two notes', () => {
    for (let seed = 0; seed < 30; seed++) {
      const inst = make(seed, 4, ANY);
      expect(ANY).toContain(inst.srs_tags[0]);
      expect((inst.stimulus.music as { key_sig: unknown }).key_sig).toBeNull();
      expect(inst.prompt).toMatch(/^Write the note/);
    }
  });

  // This asserted the alternative's literal shape and called that "accepted".
  // It was a bare pitch string, `gradeStaveInput` reads `.pitch`/`.dur`, and so
  // every alternative was rejected while the test stayed green. Ask the grader.
  test('a key-signature spelling is accepted with or without the explicit accidental', () => {
    // Bb under two flats is the same note as B on the same slot, so both are right.
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const inst = make(seed, 2, KEY);
      const { pitch, dur } = inst.answer.canonical as { pitch: string; dur: string };
      if (/[#b]/.test(pitch)) {
        const natural = pitch.replace(/[#b]/g, '');
        expect(inst.answer.accepted_alternatives).toEqual([{ pitch: natural, dur }]);
        expect(gradeStaveInput(inst, { pitch: natural, dur })).toBe(true);
        seen.add(pitch);
      } else {
        expect(inst.answer.accepted_alternatives).toEqual([]);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  test('a lesson naming no interval atom keeps the bare grade-1 draw', () => {
    const inst = make(0, 1, ['interval:2', 'interval:3']);
    expect(inst.srs_tags[0]).toMatch(/^interval:\d$/);
    expect(inst.prompt).toMatch(/^Write the note/);
  });

  test('seeds 0..99 validate in every branch', () => {
    for (const [grade, atoms] of [[2, KEY], [3, TYPE], [4, ANY]] as const) {
      for (let seed = 0; seed < 100; seed++) {
        expect(validate(make(seed, grade, atoms))).toEqual({ ok: true, errors: [] });
      }
    }
  });
});
