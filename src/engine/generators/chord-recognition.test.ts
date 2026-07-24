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

// --- Grade-5 inversions (chromaticly-ehp / plan U2) ---

const INVERSION_ATOMS = [
  'chord:I:a', 'chord:I:b', 'chord:I:c',
  'chord:II:a', 'chord:II:b', 'chord:II:c',
  'chord:IV:a', 'chord:IV:b', 'chord:IV:c',
  'chord:V:a', 'chord:V:b', 'chord:V:c',
];

function invOpts(seed: number, atoms: string[] = INVERSION_ATOMS) {
  return { grade: 5, seed, atoms };
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

describe('chord_recognition inversions — every instance validates clean across seeds', () => {
  test('seeds 0..60 all produce a passing Grade-5 inversion instance', () => {
    for (let seed = 0; seed <= 60; seed++) {
      const inst = generate('chord_recognition', invOpts(seed));
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('chord_recognition inversions — the answer is a structured { numeral, position } pair', () => {
  test('canonical carries a legal numeral (I/II/IV/V) and position (a/b/c); srs_tag is chord:<numeral>:<pos>', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('chord_recognition', invOpts(seed));
      const { numeral, position } = inst.answer.canonical as { numeral: string; position: string };
      expect(['I', 'II', 'IV', 'V']).toContain(numeral);
      expect(['a', 'b', 'c']).toContain(position);
      expect(inst.srs_tags).toEqual([`chord:${numeral}:${position}`]);
    }
  });
});

describe('chord_recognition inversions — the position is exactly which chord member sits in the bass', () => {
  test('recomputing position from the bass note (root=a, 3rd=b, 5th=c) always matches canonical.position', () => {
    for (let seed = 0; seed <= 60; seed++) {
      const inst = generate('chord_recognition', invOpts(seed));
      const { numeral, position } = inst.answer.canonical as { numeral: string; position: string };
      const config = inst.interaction.config as { triads: Record<string, string[]> };
      const [rootP, thirdP, fifthP] = config.triads[numeral]; // root-position reference
      const music = inst.stimulus.music as { voices: { events: { pitches?: string[] }[] }[] };
      const bassLetter = music.voices[0].events[0].pitches![0][0];
      const expected = bassLetter === rootP[0] ? 'a' : bassLetter === thirdP[0] ? 'b' : bassLetter === fifthP[0] ? 'c' : '?';
      expect(position).toBe(expected);
    }
  });
});

describe('chord_recognition inversions — II is a MINOR triad in a major key (diatonic quality, not forced major)', () => {
  test('config.triads.II is minor (minor 3rd + major 3rd); I/IV/V stay major', () => {
    let sawII = false;
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('chord_recognition', invOpts(seed));
      const config = inst.interaction.config as { triads: Record<string, string[]> };
      const [r2, t2, f2] = config.triads.II;
      const n1 = diatonicIntervalNumber(r2, t2);
      expect(n1).toBe(3);
      expect(intervalQuality(r2, t2, n1)).toBe('minor'); // II root-third is a MINOR 3rd
      const n2 = diatonicIntervalNumber(t2, f2);
      expect(intervalQuality(t2, f2, n2)).toBe('major');
      sawII = true;
      for (const major of ['I', 'IV', 'V']) {
        const [r, t] = config.triads[major];
        expect(intervalQuality(r, t, diatonicIntervalNumber(r, t))).toBe('major');
      }
    }
    expect(sawII).toBe(true);
  });
});

describe('chord_recognition inversions — every numeral and position is reachable', () => {
  test('all of I/II/IV/V and all of a/b/c appear as the canonical across seeds', () => {
    const numerals = new Set<string>();
    const positions = new Set<string>();
    for (let seed = 0; seed <= 120; seed++) {
      const { numeral, position } = generate('chord_recognition', invOpts(seed)).answer.canonical as {
        numeral: string;
        position: string;
      };
      numerals.add(numeral);
      positions.add(position);
    }
    expect(numerals).toEqual(new Set(['I', 'II', 'IV', 'V']));
    expect(positions).toEqual(new Set(['a', 'b', 'c']));
  });
});

describe('chord_recognition inversions — config surfaces both selection axes', () => {
  test('config.numerals is I/II/IV/V and config.positions is a/b/c', () => {
    const inst = generate('chord_recognition', invOpts(0));
    const config = inst.interaction.config as { numerals: string[]; positions: string[] };
    expect(config.numerals).toEqual(['I', 'II', 'IV', 'V']);
    expect(config.positions).toEqual(['a', 'b', 'c']);
  });
});

describe('chord_recognition inversions — a single position atom pins both axes', () => {
  test('chord:IV:b always yields { numeral: IV, position: b } (1st inversion, 3rd in bass)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('chord_recognition', invOpts(seed, ['chord:IV:b']));
      expect(inst.answer.canonical).toEqual({ numeral: 'IV', position: 'b' });
      const config = inst.interaction.config as { triads: Record<string, string[]> };
      const music = inst.stimulus.music as { voices: { events: { pitches?: string[] }[] }[] };
      // 1st inversion: the 3rd of IV is the bass note.
      expect(music.voices[0].events[0].pitches![0][0]).toBe(config.triads.IV[1][0]);
    }
  });
});

describe('chord_recognition — the Grade-4 bare-atom path is untouched (still a string numeral)', () => {
  test('bare chord:* atoms still produce a string canonical, not a { numeral, position } object', () => {
    const inst = generate('chord_recognition', opts(0));
    expect(typeof inst.answer.canonical).toBe('string');
  });
});
