import { validate } from '../validator';
import { DEGREE_ORDER, DISPLAY_NAMES, ordinalOf } from './degree-name-id';
import { generate } from './index';

const ALL_ATOMS = DEGREE_ORDER.map((name) => `degree_name:${name}`);

function opts(seed: number, atoms: string[] = ALL_ATOMS) {
  return { grade: 4, seed, atoms };
}

const EXPECTED_ORDINAL: Record<string, string> = {
  tonic: '1st',
  supertonic: '2nd',
  mediant: '3rd',
  subdominant: '4th',
  dominant: '5th',
  submediant: '6th',
  leading_note: '7th',
};

describe('degree_name_id — the degree<->ordinal map is exactly the ABRSM-standard 1st..7th', () => {
  test('every name maps to its expected ordinal', () => {
    for (const name of DEGREE_ORDER) {
      expect(ordinalOf(name)).toBe(EXPECTED_ORDINAL[name]);
    }
  });
});

describe('degree_name_id — both question directions surface the correct answer, for every degree', () => {
  test('across 300 seeds, every (name, direction) pair yields a canonical consistent with the degree<->ordinal map', () => {
    for (let seed = 0; seed < 300; seed++) {
      const inst = generate('degree_name_id', opts(seed));
      const isNameToOrdinal = /^Which degree/.test(inst.prompt);
      if (isNameToOrdinal) {
        const displayName = /the (.+)\?$/.exec(inst.prompt)![1];
        const name = DEGREE_ORDER.find((n) => DISPLAY_NAMES[n] === displayName)!;
        expect(inst.answer.canonical).toBe(EXPECTED_ORDINAL[name]);
      } else {
        const ordinal = /for the (\S+) degree/.exec(inst.prompt)![1];
        const name = DEGREE_ORDER.find((n) => EXPECTED_ORDINAL[n] === ordinal)!;
        expect(inst.answer.canonical).toBe(DISPLAY_NAMES[name]);
      }
    }
  });

  test('every one of the 7 degree names is reached as the subject across 300 seeds', () => {
    const subjects = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const inst = generate('degree_name_id', opts(seed));
      subjects.add(inst.srs_tags[0]);
    }
    expect(subjects).toEqual(new Set(DEGREE_ORDER.map((name) => `degree_name:${name}`)));
  });

  test('both directions (name->ordinal and ordinal->name) are actually reached', () => {
    const directions = new Set<boolean>();
    for (let seed = 0; seed < 300; seed++) {
      directions.add(/^Which degree/.test(generate('degree_name_id', opts(seed)).prompt));
    }
    expect(directions).toEqual(new Set([true, false]));
  });
});

describe('degree_name_id — distractors never equal the answer (commandment 4)', () => {
  test('across 300 seeds, distractors are 2, distinct, and never the canonical answer', () => {
    for (let seed = 0; seed < 300; seed++) {
      const inst = generate('degree_name_id', opts(seed));
      expect(inst.distractors).toHaveLength(2);
      const [a, b] = inst.distractors as string[];
      expect(a).not.toBe(b);
      expect(a).not.toBe(inst.answer.canonical);
      expect(b).not.toBe(inst.answer.canonical);
    }
  });
});

describe('degree_name_id — validator-clean across the retry budget', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('degree_name_id', opts(seed));
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('degree_name_id — single-atom scope is safe (one atom pins the degree)', () => {
  test('every instance names the dominant when only degree_name:dominant is in scope', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('degree_name_id', opts(seed, ['degree_name:dominant']));
      expect(inst.srs_tags).toEqual(['degree_name:dominant']);
    }
  });
});

describe('degree_name_id — text-only stimulus (a bare degree-name fact has nothing to notate)', () => {
  test('stimulus.music is always null', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(generate('degree_name_id', opts(seed)).stimulus.music).toBeNull();
    }
  });
});

describe('degree_name_id — reproducibility (KTD4: pure function of seed + atoms)', () => {
  test('the same (seed, atoms) produces a deeply-equal instance', () => {
    expect(generate('degree_name_id', opts(9))).toEqual(generate('degree_name_id', opts(9)));
  });

  test('different seeds produce different instances', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) seen.add(JSON.stringify(generate('degree_name_id', opts(seed))));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('degree_name_id — rejects an unknown degree name', () => {
  test('an atom naming an unregistered degree throws', () => {
    expect(() => generate('degree_name_id', opts(0, ['degree_name:flat_seventh']))).toThrow();
  });
});
