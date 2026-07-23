import { validate } from '../validator';
import { generate } from './index';
import { DIRECTION_TABLE, INSTRUMENT_TABLE } from './instrument-knowledge';

const ALL_ATOMS = [
  ...Object.keys(INSTRUMENT_TABLE).map((inst) => `instrument_family:${inst}`),
  ...Object.keys(INSTRUMENT_TABLE).map((inst) => `instrument_clef:${inst}`),
  ...Object.keys(DIRECTION_TABLE).map((term) => `direction:${term}`),
];

function opts(seed: number, atoms: string[] = ALL_ATOMS) {
  return { grade: 4, seed, atoms };
}

describe('instrument_knowledge — every instance validates clean across seeds 0-40', () => {
  test('seeds 0..40 all produce a passing instance for each question kind', () => {
    const familyAtoms = Object.keys(INSTRUMENT_TABLE).map((inst) => `instrument_family:${inst}`);
    const clefAtoms = Object.keys(INSTRUMENT_TABLE).map((inst) => `instrument_clef:${inst}`);
    const directionAtoms = Object.keys(DIRECTION_TABLE).map((term) => `direction:${term}`);
    for (const atoms of [familyAtoms, clefAtoms, directionAtoms]) {
      for (let seed = 0; seed <= 40; seed++) {
        const inst = generate('instrument_knowledge', opts(seed, atoms));
        expect(validate(inst)).toEqual({ ok: true, errors: [] });
      }
    }
  });
});

describe('instrument_knowledge — text-only stimulus', () => {
  test('stimulus.music and stimulus.text are always null', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('instrument_knowledge', opts(seed));
      expect(inst.stimulus.music).toBeNull();
      expect(inst.stimulus.text).toBeNull();
    }
  });
});

describe('instrument_knowledge — family MCQ', () => {
  test('trumpet is graded Brass, pinned via a single instrument_family atom', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('instrument_knowledge', opts(seed, ['instrument_family:trumpet']));
      expect(inst.answer.canonical).toBe('Brass');
      expect(inst.distractors).toEqual(expect.arrayContaining(['Strings', 'Woodwind', 'Percussion']));
      expect((inst.distractors as string[]).length).toBe(3);
    }
  });

  test('single-atom SRS pin: srs_tags has exactly the one selected atom', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('instrument_knowledge', opts(seed, ['instrument_family:trumpet']));
      expect(inst.srs_tags).toEqual(['instrument_family:trumpet']);
    }
  });
});

describe('instrument_knowledge — clef MCQ', () => {
  test('viola is graded Alto, and Alto is offered as an option', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('instrument_knowledge', opts(seed, ['instrument_clef:viola']));
      expect(inst.answer.canonical).toBe('Alto');
      expect(inst.distractors).toEqual(expect.arrayContaining(['Treble', 'Bass']));
      expect((inst.distractors as string[]).length).toBe(2);
    }
  });

  test('single-atom SRS pin: srs_tags has exactly the one selected atom', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('instrument_knowledge', opts(seed, ['instrument_clef:viola']));
      expect(inst.srs_tags).toEqual(['instrument_clef:viola']);
    }
  });
});

describe('instrument_knowledge — direction drag_match', () => {
  const atoms = ['direction:arco', 'direction:pizzicato', 'direction:con sordino', 'direction:senza sordino', 'direction:col legno'];

  test('answer.canonical maps each config.left term to DIRECTION_TABLE[term]', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('instrument_knowledge', opts(seed, atoms));
      const config = inst.interaction.config as { left: string[]; right: string[] };
      const canonical = inst.answer.canonical as Record<string, string>;
      for (const term of config.left) {
        expect(canonical[term]).toBe(DIRECTION_TABLE[term]);
      }
    }
  });

  test('config.right is exactly a permutation of config.left\'s meanings', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('instrument_knowledge', opts(seed, atoms));
      const config = inst.interaction.config as { left: string[]; right: string[] };
      const expectedMeanings = config.left.map((t) => DIRECTION_TABLE[t]);
      expect([...config.right].sort()).toEqual([...expectedMeanings].sort());
    }
  });

  test('config.left is capped at 4 terms even when more than 4 direction atoms are in scope', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('instrument_knowledge', opts(seed, atoms));
      const config = inst.interaction.config as { left: string[] };
      expect(config.left.length).toBeLessThanOrEqual(4);
    }
  });

  test('srs_tags cover exactly the direction terms in the match — no more, no fewer', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('instrument_knowledge', opts(seed, atoms));
      const config = inst.interaction.config as { left: string[] };
      expect([...inst.srs_tags].sort()).toEqual([...config.left.map((t) => `direction:${t}`)].sort());
    }
  });

  test('the shuffle is seed-deterministic: same seed produces the same config.right order across two calls', () => {
    for (let seed = 0; seed < 20; seed++) {
      const a = generate('instrument_knowledge', opts(seed, atoms));
      const b = generate('instrument_knowledge', opts(seed, atoms));
      expect(a).toEqual(b);
      const configA = a.interaction.config as { right: string[] };
      const configB = b.interaction.config as { right: string[] };
      expect(configA.right).toEqual(configB.right);
    }
  });
});

describe('instrument_knowledge — rejects an unknown atom or empty atom scope', () => {
  test('an atom naming an unregistered instrument throws', () => {
    expect(() => generate('instrument_knowledge', opts(0, ['instrument_family:kazoo']))).toThrow();
  });

  test('an atom naming an unregistered direction throws', () => {
    expect(() => generate('instrument_knowledge', opts(0, ['direction:staccato']))).toThrow();
  });

  test('an empty atom array throws', () => {
    expect(() => generate('instrument_knowledge', opts(0, []))).toThrow();
  });
});

describe('instrument_knowledge — reproducibility (KTD4: pure function of seed + atoms)', () => {
  test('the same (seed, atoms) produces a deeply-equal instance', () => {
    expect(generate('instrument_knowledge', opts(9))).toEqual(generate('instrument_knowledge', opts(9)));
  });
});
