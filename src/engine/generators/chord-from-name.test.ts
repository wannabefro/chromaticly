// chord_from_name (chromaticly-lgi): the chord is named and its stave chosen.
// Two branches, matching chord_recognition's own: a grade-4 numeral, and a
// grade-5 numeral+position where the three options are the SAME chord in its
// three positions — so only the bass note can tell them apart.

import { generate } from './index';
import type { Music } from '../../music/types';
import { validate } from '../validator';

const G4 = ['chord:I', 'chord:IV', 'chord:V'];
const G5 = ['chord:I:a', 'chord:IV:b', 'chord:V:c', 'chord:II:b'];

function make(seed = 0, grade = 4, atoms = G4) {
  return generate('chord_from_name', { grade, seed, atoms });
}

function optionsOf(inst: ReturnType<typeof make>): Record<string, Music> {
  return (inst.interaction.config as { option_music: Record<string, Music> }).option_music;
}

describe('chord_from_name', () => {
  test('the chord is named in the prompt and every option is a stave', () => {
    const inst = make();
    expect(inst.stimulus.music).toBeNull();
    const options = optionsOf(inst);
    expect(Object.keys(options).sort()).toEqual(['I', 'IV', 'V']);
  });

  test('the inversion branch offers one chord in three positions, so only the bass differs', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = make(seed, 5, G5);
      const options = optionsOf(inst);
      expect(Object.keys(options).sort()).toEqual(['a', 'b', 'c']);
      const pitchSets = Object.values(options).map((m) => {
        const chord = m.voices[0].events[0] as { pitches: string[] };
        return [...chord.pitches].map((p) => p.replace(/\d+$/, '')).sort().join(',');
      });
      expect(new Set(pitchSets).size).toBe(1);
    }
  });

  test('the answer is the position asked for, and its tag carries that position', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = make(seed, 5, G5);
      expect(['a', 'b', 'c']).toContain(inst.answer.canonical);
      expect(inst.srs_tags[0]).toMatch(/^chord:[IV]+:[abc]$/);
    }
  });

  test('a grade-4 item credits the bare chord atom, not a positioned one', () => {
    for (let seed = 0; seed < 10; seed++) expect(make(seed).srs_tags[0]).toMatch(/^chord:[IV]+$/);
  });

  test('every wrong stave is told which chord it actually is', () => {
    for (const [grade, atoms] of [[4, G4], [5, G5]] as const) {
      const inst = make(3, grade, atoms);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors as string[]) expect(typeof reasons[d]).toBe('string');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });

  test('an atom set naming no chord fails loud', () => {
    expect(() => make(0, 4, ['tonic_triad'])).toThrow();
  });

  test('seeds 0..99 validate in both branches', () => {
    for (const [grade, atoms] of [[4, G4], [5, G5]] as const) {
      for (let seed = 0; seed < 100; seed++) {
        expect(validate(make(seed, grade, atoms))).toEqual({ ok: true, errors: [] });
      }
    }
  });
});
