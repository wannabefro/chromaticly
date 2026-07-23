import { validate } from '../validator';
import { intervalQuality, diatonicIntervalNumber } from '../interval-quality';
import { CHORD_DEGREE_STEPS } from './chord-recognition';
import { generate } from './index';

const ALL_ATOMS = ['chord:I', 'chord:IV', 'chord:V'];

function opts(seed: number, atoms: string[] = ALL_ATOMS) {
  return { grade: 4, seed, atoms };
}

describe('chord_recognition — every instance validates clean across seeds 0-40', () => {
  test('seeds 0..40 all produce a passing instance', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('chord_recognition', opts(seed));
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('chord_recognition — stimulus shape', () => {
  test('exactly one 3-pitch chord event, no time signature, treble or bass clef', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('chord_recognition', opts(seed));
      const music = inst.stimulus.music as { clef: string; time_sig: unknown; voices: { events: { type: string; pitches?: string[] }[] }[] };
      expect(['treble', 'bass']).toContain(music.clef);
      expect(music.time_sig).toBeNull();
      const chordEvents = music.voices.flatMap((v) => v.events).filter((ev) => ev.type === 'chord');
      expect(chordEvents).toHaveLength(1);
      expect(chordEvents[0].pitches).toHaveLength(3);
    }
  });
});

describe('chord_recognition — the invariant: the canonical numeral matches the root\'s scale degree in the key', () => {
  test('across seeds, recomputing the numeral from the chord root and the key signature always matches answer.canonical', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('chord_recognition', opts(seed));
      const music = inst.stimulus.music as { key_sig: string; voices: { events: { type: string; pitches?: string[] }[] }[] };
      const [tonic] = music.key_sig.split('_');
      const [root] = music.voices[0].events[0].pitches!;
      const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      const steps = (letters.indexOf(root[0]) - letters.indexOf(tonic[0]) + 7) % 7;
      const expectedNumeral = Object.entries(CHORD_DEGREE_STEPS).find(([, s]) => s === steps)?.[0];
      expect(inst.answer.canonical).toBe(expectedNumeral);
    }
  });
});

describe('chord_recognition — each of I/IV/V is reachable across seeds', () => {
  test('all three numerals appear as the canonical answer across seeds 0-40', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed <= 40; seed++) {
      seen.add(generate('chord_recognition', opts(seed)).answer.canonical as string);
    }
    expect(seen).toEqual(new Set(['I', 'IV', 'V']));
  });
});

describe('chord_recognition — distractors are the other two numerals', () => {
  test('distractors are always {I, IV, V} minus the canonical, across seeds', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('chord_recognition', opts(seed));
      const expected = ['I', 'IV', 'V'].filter((n) => n !== inst.answer.canonical);
      expect([...(inst.distractors as string[])].sort()).toEqual([...expected].sort());
    }
  });
});

describe('chord_recognition — interaction.config.triads carries all three primary triads', () => {
  test('config.triads has exactly I/IV/V, and config.triads[canonical] equals the stimulus chord', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('chord_recognition', opts(seed));
      const config = inst.interaction.config as { numerals: string[]; triads: Record<string, string[]> };
      expect(config.numerals).toEqual(['I', 'IV', 'V']);
      expect(Object.keys(config.triads).sort()).toEqual(['I', 'IV', 'V']);
      for (const numeral of ['I', 'IV', 'V']) {
        expect(config.triads[numeral]).toHaveLength(3);
      }
      const music = inst.stimulus.music as { voices: { events: { pitches?: string[] }[] }[] };
      expect(config.triads[inst.answer.canonical as string]).toEqual(music.voices[0].events[0].pitches);
    }
  });

  test('every triad in config.triads is a root-position major triad (major 3rd + minor 3rd)', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('chord_recognition', opts(seed));
      const config = inst.interaction.config as { triads: Record<string, string[]> };
      for (const numeral of ['I', 'IV', 'V']) {
        const [root, third, fifth] = config.triads[numeral];
        const thirdNumber = diatonicIntervalNumber(root, third);
        expect(thirdNumber).toBe(3);
        expect(intervalQuality(root, third, thirdNumber)).toBe('major');
        const fifthNumber = diatonicIntervalNumber(third, fifth);
        expect(fifthNumber).toBe(3);
        expect(intervalQuality(third, fifth, fifthNumber)).toBe('minor');
      }
    }
  });
});

describe('chord_recognition — spot check: IV of C major is F-A-C, spelled with no accidentals', () => {
  test('an instance drawing C major and numeral IV spells F, A, C', () => {
    let found = false;
    for (let seed = 0; seed <= 200; seed++) {
      const inst = generate('chord_recognition', opts(seed));
      const music = inst.stimulus.music as { key_sig: string };
      if (music.key_sig !== 'C_major' || inst.answer.canonical !== 'IV') continue;
      found = true;
      const config = inst.interaction.config as { triads: Record<string, string[]> };
      const [root, third, fifth] = config.triads.IV;
      expect(root[0]).toBe('F');
      expect(third[0]).toBe('A');
      expect(fifth[0]).toBe('C');
      // No accidental in C major — every pitch in the triad is a bare natural letter+octave.
      expect(root).toMatch(/^F-?\d+$/);
      expect(third).toMatch(/^A-?\d+$/);
      expect(fifth).toMatch(/^C-?\d+$/);
    }
    expect(found).toBe(true);
  });
});

describe('chord_recognition — single-atom scope pins the numeral (SRS due-path discipline)', () => {
  test('every instance names IV when only chord:IV is in scope', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('chord_recognition', opts(seed, ['chord:IV']));
      expect(inst.srs_tags).toEqual(['chord:IV']);
      expect(inst.answer.canonical).toBe('IV');
    }
  });
});

describe('chord_recognition — rejects an unknown chord numeral atom', () => {
  test('an atom naming an unregistered numeral throws', () => {
    expect(() => generate('chord_recognition', opts(0, ['chord:ii']))).toThrow();
  });
});

describe('chord_recognition — reproducibility (KTD4: pure function of seed + atoms)', () => {
  test('the same (seed, atoms) produces a deeply-equal instance', () => {
    expect(generate('chord_recognition', opts(9))).toEqual(generate('chord_recognition', opts(9)));
  });
});
