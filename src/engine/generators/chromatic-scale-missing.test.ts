// chromatic_scale_missing (chromaticly-lgi): spotting a wrong note and spotting
// a gap are different reading tasks. Exactly one interior note is absent, and
// every wrong option is a note the stimulus really shows — otherwise the item
// could be answered without reading the stave.

import { generate } from './index';
import { chromaticScaleAscending } from './chromatic-scale';
import { validate } from '../validator';

const ATOMS = ['scale:C_chromatic', 'scale:G_chromatic', 'scale:D_chromatic', 'scale:F_chromatic'];

function make(seed = 0, atoms = ATOMS) {
  return generate('chromatic_scale_missing', { grade: 4, seed, atoms });
}

function shownPitches(inst: ReturnType<typeof make>): string[] {
  return (inst.stimulus.music as { voices: { events: { pitch: string }[] }[] }).voices[0].events.map((e) => e.pitch);
}

const name = (pitch: string): string => pitch.replace(/-?\d+$/, '').replace('#', '♯');

describe('chromatic_scale_missing', () => {
  test('exactly one interior note is absent, and it is the answer', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      const shown = shownPitches(inst);
      const absent = chromaticScaleAscending(shown[0]).filter((p) => !shown.includes(p));
      expect(absent).toHaveLength(1);
      expect(inst.answer.canonical).toBe(name(absent[0]));
    }
  });

  test('the tonic and its octave are never the missing note — both ends carry the same name', () => {
    for (let seed = 0; seed < 40; seed++) {
      const shown = shownPitches(make(seed));
      expect(shown).toHaveLength(12);
      expect(name(shown[0])).toBe(name(shown[shown.length - 1]));
    }
  });

  test('every wrong option is a note the stave really shows', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      const names = shownPitches(inst).map(name);
      for (const d of inst.distractors as string[]) expect(names).toContain(d);
    }
  });

  test('each wrong option is told where it already sits, and the two differ', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = make(seed);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors as string[]) expect(reasons[d]).toContain('already written');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });

  test('the tag names the tonic drawn, so credit lands on that scale', () => {
    for (let seed = 0; seed < 20; seed++) expect(ATOMS).toContain(make(seed).srs_tags[0]);
  });

  test('a lesson naming no chromatic scale fails loud', () => {
    expect(() => make(0, ['scale:A_minor_harmonic'])).toThrow();
  });

  test('seeds 0..99 validate', () => {
    for (let seed = 0; seed < 100; seed++) expect(validate(make(seed))).toEqual({ ok: true, errors: [] });
  });
});
