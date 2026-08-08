import { assertAtomResolves } from '../../content/lessons';
import { validate } from '../validator';
import { intervalQuality, diatonicIntervalNumber } from '../interval-quality';
import { CHORD_DEGREE_STEPS } from './chord-recognition';
import { generate } from './index';
import type { Music } from '../../music/types';

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

// chromaticly-7xv — the minor-key primary triads. The point of these is the
// asymmetry: i and iv fall out of the key signature, V does not.
describe('chord_recognition — minor keys (G4 item 4)', () => {
  const at = (numeral: string, seed = 0) =>
    generate('chord_recognition', { grade: 4, seed, atoms: [`chord_minor:${numeral}`] });

  const pitches = (i: ReturnType<typeof at>) =>
    ((i.stimulus.music as any).voices[0].events[0].pitches as string[]);

  test.each(['I', 'IV', 'V'])('%s credits its own atom and answers its own numeral', (numeral) => {
    const i = at(numeral);
    expect(i.srs_tags).toEqual([`chord_minor:${numeral}`]);
    expect(i.answer.canonical).toBe(numeral);
  });

  // The defect this content exists to fix: a dominant built from the key
  // signature alone is MINOR, and cannot function as a dominant. Checked as a
  // semitone count so it does not depend on the validator agreeing.
  test('V is major and i/iv are minor, on every seed', () => {
    const semis = (a: string, b: string) => {
      const step: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
      const parse = (p: string) => {
        const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/.exec(p)!;
        const acc = (m[2] ?? '').startsWith('#') ? m[2]!.length : (m[2] ?? '').startsWith('b') ? -m[2]!.length : 0;
        return step[m[1]] + acc + 12 * Number(m[3]);
      };
      return parse(b) - parse(a);
    };
    for (let seed = 0; seed < 8; seed++) {
      for (const numeral of ['I', 'IV', 'V']) {
        const [root, third, fifth] = pitches(at(numeral, seed));
        expect(semis(root, fifth)).toBe(7);
        expect(semis(root, third)).toBe(numeral === 'V' ? 4 : 3);
      }
    }
  });

  test('the stimulus carries a minor key signature, and the raised 7th is not in it', () => {
    const i = at('V', 3);
    expect((i.stimulus.music as any).key_sig).toMatch(/_minor$/);
  });

  // Minor harmony is Grade 4 content. The atom must not resolve below it.
  test('the atom does not resolve below grade 4', () => {
    expect(() => assertAtomResolves('chord_minor:V', 3)).toThrow();
    expect(() => assertAtomResolves('chord_minor:V', 4)).not.toThrow();
  });
});

// chromaticly-ic5.5. G5 item 4 asks for inversions in any major OR minor key.
describe('chord_recognition — inversions in a minor key (chromaticly-ic5.5)', () => {
  const ATOMS = ['I', 'II', 'IV', 'V'].flatMap((n) => ['a', 'b', 'c'].map((p) => `chord_minor:${n}:${p}`));

  const gen = (seed: number, atoms: string[] = ATOMS) =>
    generate('chord_recognition', { grade: 5, seed, atoms });

  const triadsOf = (inst: ReturnType<typeof gen>) =>
    (inst.interaction.config as { triads: Record<string, string[]> }).triads;

  /** Semitones between two spelled pitches, so quality is read not assumed. */
  const semitones = (low: string, high: string): number => {
    const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const parse = (p: string) => {
      const m = /^([A-G])(##|bb|#|b)?(-?\d+)$/.exec(p)!;
      const shift = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : m[2] === '##' ? 2 : m[2] === 'bb' ? -2 : 0;
      return STEP[m[1]] + shift + 12 * Number(m[3]);
    };
    return parse(high) - parse(low);
  };

  test('every item is validator-clean and carries a minor key signature', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = gen(seed);
      expect((inst.stimulus.music as Music).key_sig).toMatch(/_minor$/);
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });

  // THE invariant, and the reason this could not join chord-inversions-5.
  test('ii is two stacked minor 3rds — a diminished triad, in every key drawn', () => {
    for (let seed = 0; seed < 40; seed++) {
      const [root, third, fifth] = triadsOf(gen(seed)).II;
      expect(semitones(root, third)).toBe(3);
      expect(semitones(third, fifth)).toBe(3);
    }
  });

  test('i and iv are minor and V is major, so the raised 7th is on the page', () => {
    for (let seed = 0; seed < 40; seed++) {
      const triads = triadsOf(gen(seed));
      for (const numeral of ['I', 'IV']) {
        expect(semitones(triads[numeral][0], triads[numeral][1])).toBe(3);
      }
      expect(semitones(triads.V[0], triads.V[1])).toBe(4);
    }
  });

  test('all twelve numeral-and-position pairs are asked', () => {
    const asked = new Set<string>();
    for (let seed = 0; seed < 60; seed++) asked.add(gen(seed).srs_tags[0]);
    expect([...asked].sort()).toEqual([...ATOMS].sort());
  });

  test.each(ATOMS)('a single due atom %s is a whole item', (atom) => {
    const inst = gen(0, [atom]);
    expect(inst.srs_tags).toEqual([atom]);
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  test('the major inversions path is untouched — it still draws a major key', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('chord_recognition', { grade: 5, seed, atoms: ['chord:II:b'] });
      expect((inst.stimulus.music as Music).key_sig).toMatch(/_major$/);
      expect(semitones(triadsOf(inst).II[0], triadsOf(inst).II[1])).toBe(3);
      expect(semitones(triadsOf(inst).II[1], triadsOf(inst).II[2])).toBe(4);
    }
  });

  test('an unknown numeral or position in a minor inversion atom throws', () => {
    expect(() => gen(0, ['chord_minor:III:a'])).toThrow();
    expect(() => gen(0, ['chord_minor:I:d'])).toThrow();
  });
});

// The inversion branch never checked quality before this.
describe('chordInversionErrors rejects a triad of the wrong quality', () => {
  test('a ii built minor instead of diminished', () => {
    // Some keys spell the 5th of ii with no accidental, so stripping one is a
    // no-op there. Search for a key where the tamper actually bites.
    const inst = Array.from({ length: 20 }, (_, seed) =>
      generate('chord_recognition', { grade: 5, seed, atoms: ['chord_minor:I:a'] }),
    ).find((i) => /[#b]/.test((i.interaction.config as { triads: Record<string, string[]> }).triads.II[2]));
    expect(inst).toBeDefined();
    const triads = (inst!.interaction.config as { triads: Record<string, string[]> }).triads;
    const [root, third] = triads.II;
    triads.II = [root, third, `${triads.II[2].replace(/[#b]/g, '')}`];
    expect(validate(inst!).errors.some((e) => e.includes('config.triads.II'))).toBe(true);
  });

  test('a V built without its raised 7th', () => {
    // Some keys raise the 7th with a natural, so search for a sharp.
    const inst = Array.from({ length: 20 }, (_, seed) =>
      generate('chord_recognition', { grade: 5, seed, atoms: ['chord_minor:I:a'] }),
    ).find((i) => (i.interaction.config as { triads: Record<string, string[]> }).triads.V[1].includes('#'));
    expect(inst).toBeDefined();
    const triads = (inst!.interaction.config as { triads: Record<string, string[]> }).triads;
    triads.V = [triads.V[0], triads.V[1].replace('#', ''), triads.V[2]];
    expect(validate(inst!).errors.some((e) => e.includes('config.triads.V'))).toBe(true);
  });

  test('a chip map whose answer chord is not the notated one', () => {
    const inst = generate('chord_recognition', { grade: 5, seed: 1, atoms: ['chord_minor:I:a'] });
    const triads = (inst.interaction.config as { triads: Record<string, string[]> }).triads;
    triads.I = triads.IV;
    expect(validate(inst).errors.some((e) => e.includes('does not spell the stimulus chord'))).toBe(true);
  });
});

// chromaticly-9kx. Placement pools both families. Branching on family made
// every item minor.
describe('chord_recognition — a pooled atom set reaches both inversion families', () => {
  const POOLED = ['chord:I:b', 'chord:IV:c', 'chord_minor:I:b', 'chord_minor:IV:c'];

  test('every seed credits an atom the pool actually holds', () => {
    for (let seed = 0; seed < 40; seed++) {
      expect(POOLED).toContain(generate('chord_recognition', { grade: 5, seed, atoms: POOLED }).srs_tags[0]);
    }
  });

  test('all four pooled atoms are reachable', () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, seed) => generate('chord_recognition', { grade: 5, seed, atoms: POOLED }).srs_tags[0]),
    );
    expect(seen).toEqual(new Set(POOLED));
  });
});
