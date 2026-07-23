import type { Music, NoteEvent } from '../../music/types';
import { validate } from '../validator';
import { chromaticScaleAscending, chromaticPositionLabel } from './chromatic-scale';
import { generate } from './index';

const ATOMS = ['scale:C_chromatic', 'scale:G_chromatic'];

function opts(seed: number) {
  return { grade: 4, seed, atoms: ATOMS };
}

function notesOf(inst: ReturnType<typeof generate>): string[] {
  const music = inst.stimulus.music as Music;
  return music.voices
    .flatMap((v) => v.events)
    .filter((ev): ev is NoteEvent => ev.type === 'note')
    .map((ev) => ev.pitch);
}

function tonicOf(inst: ReturnType<typeof generate>): string {
  const tag = inst.srs_tags[0]; // "scale:<tonic>_chromatic"
  return tag.split(':')[1].split('_')[0];
}

describe('chromaticScaleAscending — the exact all-sharp spelling rule (whole tone -> insert sharp, semitone -> nothing)', () => {
  test('C chromatic ascending is exactly C C# D D# E F F# G G# A A# B C', () => {
    expect(chromaticScaleAscending('C4')).toEqual([
      'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5',
    ]);
  });

  test('G chromatic ascending is exactly G G# A A# B C C# D D# E F F# G', () => {
    expect(chromaticScaleAscending('G3')).toEqual([
      'G3', 'G#3', 'A3', 'A#3', 'B3', 'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4',
    ]);
  });
});

describe('chromatic_scale — exactly one wrong note (the spot-the-wrong-note contract)', () => {
  test('across seeds 0..99, the stimulus differs from the recomputed true scale at exactly one position', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('chromatic_scale', opts(seed));
      const notes = notesOf(inst);
      expect(notes).toHaveLength(13);
      const trueScale = chromaticScaleAscending(notes[0]);
      const diffIndices = notes.reduce<number[]>((acc, n, i) => (n === trueScale[i] ? acc : [...acc, i]), []);
      expect(diffIndices).toHaveLength(1);
      // Never the tonic (index 0) or the octave (index 12) — those are the
      // never-corrupted endpoints per the spec.
      expect(diffIndices[0]).toBeGreaterThan(0);
      expect(diffIndices[0]).toBeLessThan(12);
    }
  });
});

describe('chromatic_scale — canonical ordinal matches the actually-corrupted index', () => {
  test('across seeds 0..99, answer.canonical names the exact position that differs from the true scale', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('chromatic_scale', opts(seed));
      const notes = notesOf(inst);
      const trueScale = chromaticScaleAscending(notes[0]);
      const wrongIndex = notes.findIndex((n, i) => n !== trueScale[i]);
      expect(inst.answer.canonical).toBe(chromaticPositionLabel(wrongIndex));
    }
  });
});

describe('chromatic_scale — reachability (both allowed tonics actually get asked)', () => {
  test('C and G are both reached across seeds 0..39', () => {
    const tonics = new Set(Array.from({ length: 40 }, (_, seed) => tonicOf(generate('chromatic_scale', opts(seed)))));
    expect(tonics).toEqual(new Set(['C', 'G']));
  });
});

describe('chromatic_scale — validator-clean across the retry budget', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('chromatic_scale', opts(seed));
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('chromatic_scale — no key signature (a chromatic scale names no key)', () => {
  test('stimulus music always carries key_sig: null', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('chromatic_scale', opts(seed));
      expect((inst.stimulus.music as Music).key_sig).toBeNull();
    }
  });
});

describe('chromatic_scale — reproducibility (KTD4: pure function of seed + atoms)', () => {
  test('the same (seed, atoms) produces a deeply-equal instance', () => {
    expect(generate('chromatic_scale', opts(7))).toEqual(generate('chromatic_scale', opts(7)));
  });

  test('different seeds produce different instances', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) seen.add(JSON.stringify(generate('chromatic_scale', opts(seed))));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('chromatic_scale — rejects a tonic outside the MVP natural-letter set', () => {
  test('an accidental tonic throws', () => {
    expect(() => generate('chromatic_scale', { grade: 4, seed: 0, atoms: ['scale:F#_chromatic'] })).toThrow();
  });
});
