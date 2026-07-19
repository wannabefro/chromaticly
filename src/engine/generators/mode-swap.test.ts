import { validate } from '../validator';
import { generate } from './index';

const FULL_ATOMS = ['key_sig:A_minor', 'key_sig:E_minor', 'key_sig:D_minor'];
const RELATIVE_MAJOR: Record<string, string> = { A: 'C', E: 'G', D: 'F' };

function opts(atoms: string[], seed: number) {
  return { grade: 2, seed, atoms };
}

/** The pair this instance asked about, regardless of question direction —
 *  srs_tags always names the pair's minor atom (D4). */
function pairMinorTonic(inst: ReturnType<typeof generate>): string {
  const tag = inst.srs_tags[0]; // "key_sig:<T>_minor"
  return tag.split(':')[1].split('_')[0];
}

function isMinorCanonical(inst: ReturnType<typeof generate>): boolean {
  return /minor/i.test(inst.answer.canonical as string);
}

describe('mode_swap — reachability (mirrors flat-tonic-grade2.test.ts discipline: assert REACHED, not merely not-throw)', () => {
  const instances = Array.from({ length: 120 }, (_, seed) => generate('mode_swap', opts(FULL_ATOMS, seed)));

  test('every one of the three grade-2 pairs (A, E, D) is actually asked', () => {
    const pairs = new Set(instances.map(pairMinorTonic));
    expect(pairs).toEqual(new Set(['A', 'E', 'D']));
  });

  test('both question directions (relative-minor-of-major and relative-major-of-minor) are actually reached', () => {
    const directions = new Set(instances.map(isMinorCanonical));
    expect(directions).toEqual(new Set([true, false]));
  });
});

describe('mode_swap — validator-clean across the retry budget (scope is law at grade 2)', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('mode_swap', opts(FULL_ATOMS, seed));
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('mode_swap — single-atom scope is safe (the Practice due-path crash class key_signature_id is exempt from, D4)', () => {
  const atoms = ['key_sig:E_minor'];
  const instances = Array.from({ length: 20 }, (_, seed) => generate('mode_swap', opts(atoms, seed)));

  test('generation succeeds across seeds 0..19 without throwing', () => {
    expect(instances).toHaveLength(20);
  });

  test('every instance asks about the E<->G pair — the single atom pins the pair', () => {
    for (const inst of instances) {
      expect(pairMinorTonic(inst)).toBe('E');
    }
  });

  test('distractors are still a full pool of 2 (drawn from grade scope, not the atoms)', () => {
    for (const inst of instances) {
      expect(inst.distractors).toHaveLength(2);
    }
  });

  test('every instance still validates', () => {
    for (const inst of instances) {
      expect(validate(inst).ok).toBe(true);
    }
  });
});

describe('mode_swap — distractor contract (commandment 3: diagnostic, never the answer)', () => {
  const instances = Array.from({ length: 60 }, (_, seed) => generate('mode_swap', opts(FULL_ATOMS, seed)));

  test('every distractor is the same mode as the answer, in grade-2 scope, with no duplicates, and never the answer', () => {
    for (const inst of instances) {
      const canonicalIsMinor = isMinorCanonical(inst);
      expect(inst.distractors).toHaveLength(2);
      const seen = new Set<string>();
      for (const d of inst.distractors as string[]) {
        expect(/minor/i.test(d)).toBe(canonicalIsMinor);
        expect(d).not.toBe(inst.answer.canonical);
        expect(seen.has(d)).toBe(false);
        seen.add(d);
        const tonic = d.split(' ')[0];
        if (canonicalIsMinor) {
          expect(['A', 'E', 'D']).toContain(tonic);
        } else {
          expect(['C', 'G', 'F']).toContain(tonic);
        }
      }
    }
  });

  test('for the C-major question (relative minor of C major), E minor is present among the distractors — the counted-wrong-direction confusion', () => {
    const cMajorQuestions = instances.filter(
      (inst) => pairMinorTonic(inst) === 'A' && isMinorCanonical(inst),
    );
    expect(cMajorQuestions.length).toBeGreaterThan(0);
    for (const inst of cMajorQuestions) {
      expect(inst.distractors).toContain('E minor');
    }
  });
});

describe('mode_swap — srs_tags (mastery accrues to the pair regardless of question direction)', () => {
  test('srs_tags is the pair\'s minor key_sig atom in BOTH directions', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = generate('mode_swap', opts(FULL_ATOMS, seed));
      const tonic = pairMinorTonic(inst);
      expect(inst.srs_tags).toEqual([`key_sig:${tonic}_minor`]);
    }
  });
});

describe('mode_swap — text-only stimulus (D3: no notation, deferred to a later decision)', () => {
  test('stimulus.music is null and stimulus.text names both the relationship and the given key', () => {
    for (let seed = 0; seed < 30; seed++) {
      const inst = generate('mode_swap', opts(FULL_ATOMS, seed));
      expect(inst.stimulus.music).toBeNull();
      expect(inst.stimulus.text).not.toBeNull();
      const text = inst.stimulus.text as string;
      expect(/relative (minor|major)/i.test(text)).toBe(true);
      if (isMinorCanonical(inst)) {
        const major = RELATIVE_MAJOR[pairMinorTonic(inst)];
        expect(text).toContain(`${major} major`);
      } else {
        expect(text).toContain(`${pairMinorTonic(inst)} minor`);
      }
    }
  });
});

describe('mode_swap — cannot leak below grade 2 (keysMinor is empty at grade 1)', () => {
  test('grade 1 fails to generate a valid instance', () => {
    expect(() => generate('mode_swap', opts(FULL_ATOMS, 0))).not.toThrow(); // sanity: grade 2 itself is fine
    expect(() => generate('mode_swap', { grade: 1, seed: 0, atoms: FULL_ATOMS })).toThrow();
  });
});

describe('mode_swap — reproducibility (KTD4: pure function of seed + atoms)', () => {
  test('the same (seed, atoms) produces a deeply-equal instance', () => {
    expect(generate('mode_swap', opts(FULL_ATOMS, 12))).toEqual(generate('mode_swap', opts(FULL_ATOMS, 12)));
  });

  test('different seeds produce different instances', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) seen.add(JSON.stringify(generate('mode_swap', opts(FULL_ATOMS, seed))));
    expect(seen.size).toBeGreaterThan(1);
  });
});
