import { validate } from '../validator';
import { generate } from './index';

const FULL_ATOMS = ['key_sig:A_minor', 'key_sig:E_minor', 'key_sig:D_minor'];
const RELATIVE_MAJOR: Record<string, string> = { A: 'C', E: 'G', D: 'F' };

// U4 (grade3-melodic-minor plan, D4) — the 6 new minor-keys-3 pairs.
const GRADE3_ATOMS = [
  'key_sig:B_minor',
  'key_sig:G_minor',
  'key_sig:F#_minor',
  'key_sig:C_minor',
  'key_sig:C#_minor',
  'key_sig:F_minor',
];

function opts(atoms: string[], seed: number) {
  return { grade: 2, seed, atoms };
}

function opts3(atoms: string[], seed: number) {
  return { grade: 3, seed, atoms };
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

// U4 (grade3-melodic-minor plan, D4) — the distractor pool widens from 3
// in-scope minors (grade 2, always exactly 2 other tonics) to 9 (grade 3,
// up to 8 other tonics), so the option-count contract (3-option MCQ) needs
// an explicit cap, gated so grade 2 never enters the new selection branch.

// The grade-2 distractor pool is always exactly these two tonics, in this
// fixed order — a pre-D4 fact hand-derived from
// GRADE_2_SCOPE.keysMinor = ['A', 'E', 'D'] filtered by `!== canonical`
// (verified against the real pre-change generator output before this unit
// touched the file). D4's cap is gated on pool.length > 2, which this
// 2-element pool never reaches, so the selection branch must never run here.
const GRADE2_MINOR_DISTRACTORS: Record<string, string[]> = {
  A: ['E minor', 'D minor'],
  E: ['A minor', 'D minor'],
  D: ['A minor', 'E minor'],
};
const GRADE2_MAJOR_DISTRACTORS: Record<string, string[]> = {
  A: ['G major', 'F major'],
  E: ['C major', 'F major'],
  D: ['C major', 'G major'],
};

describe('mode_swap — grade-2 byte-identity (D4: the selection cap is a no-op when the pool is exactly 2, so grade 2 draws no new rng and its output is unchanged)', () => {
  test('distractors for seeds 0..19 deep-equal the pre-D4 pool (hand-derived from the grade-2 scope filter, not re-derived from the new code)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('mode_swap', opts(FULL_ATOMS, seed));
      const tonic = pairMinorTonic(inst);
      const expected = isMinorCanonical(inst) ? GRADE2_MINOR_DISTRACTORS[tonic] : GRADE2_MAJOR_DISTRACTORS[tonic];
      expect(inst.distractors).toEqual(expected);
    }
  });
});

describe('mode_swap — grade-3 distractor cap (D4): exactly 2 distractors (3-option MCQ) even though the pool widens to 9 keys', () => {
  test('every grade-3 instance has exactly 2 distractors', () => {
    for (let seed = 0; seed < 200; seed++) {
      const inst = generate('mode_swap', opts3(GRADE3_ATOMS, seed));
      expect(inst.distractors).toHaveLength(2);
    }
  });
});

// Independent minor-3rd calculator — NOT imported from mode-swap.ts. The
// point of this test is to prove the diagnostic distractor really is "a
// minor 3rd above the major tonic" (the counted-up-instead-of-down
// misconception), not merely equal to whatever mode-swap.ts's own selection
// logic happens to compute.
const NATURAL_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
function minorThirdAbove(tonic: string): string {
  const letter = tonic[0];
  const accidental = tonic.length > 1 ? (tonic[1] === '#' ? 1 : -1) : 0;
  const letterIdx = LETTERS.indexOf(letter);
  const targetLetter = LETTERS[(letterIdx + 2) % 7];
  const sourceSemitone = (NATURAL_SEMITONE[letter] + accidental + 12) % 12;
  const desiredSemitone = (sourceSemitone + 3) % 12;
  const delta = (((desiredSemitone - NATURAL_SEMITONE[targetLetter] + 6) % 12) + 12) % 12 - 6;
  const symbol = delta === 0 ? '' : delta === 1 ? '#' : delta === -1 ? 'b' : '?';
  return `${targetLetter}${symbol}`;
}

describe('mode_swap — wrong-direction distractor (D4): the headline "counted up instead of down" misconception is prioritized when representable', () => {
  test('relative minor of D major offers F minor (a minor 3rd above D, not the correct minor 3rd below)', () => {
    expect(minorThirdAbove('D')).toBe('F');
    const inst = Array.from({ length: 200 }, (_, seed) => generate('mode_swap', opts3(GRADE3_ATOMS, seed))).find(
      (i) => pairMinorTonic(i) === 'B' && isMinorCanonical(i),
    );
    expect(inst).toBeDefined();
    expect(inst!.distractors).toContain('F minor');
  });

  test('relative minor of A major offers C minor (a minor 3rd above A, not the correct minor 3rd below)', () => {
    expect(minorThirdAbove('A')).toBe('C');
    const inst = Array.from({ length: 200 }, (_, seed) => generate('mode_swap', opts3(GRADE3_ATOMS, seed))).find(
      (i) => pairMinorTonic(i) === 'F#' && isMinorCanonical(i),
    );
    expect(inst).toBeDefined();
    expect(inst!.distractors).toContain('C minor');
  });
});

describe('mode_swap — grade-3 reachability (6-atom minor-keys-3 scope; mirrors flat-tonic-grade2.test.ts discipline: assert REACHED, not merely not-throw)', () => {
  const instances = Array.from({ length: 120 }, (_, seed) => generate('mode_swap', opts3(GRADE3_ATOMS, seed)));

  test('every one of the 6 new pairs (B, G, F#, C, C#, F) is actually asked', () => {
    const pairs = new Set(instances.map(pairMinorTonic));
    expect(pairs).toEqual(new Set(['B', 'G', 'F#', 'C', 'C#', 'F']));
  });

  test('both question directions are reached for the grade-3 pairs', () => {
    const directions = new Set(instances.map(isMinorCanonical));
    expect(directions).toEqual(new Set([true, false]));
  });

  test('the two NEW majors (E, Ab) are actually reached as canonicals — the flat-tonic bug class applied to the new relatives', () => {
    const majorCanonicals = new Set(
      instances.filter((i) => !isMinorCanonical(i)).map((i) => i.answer.canonical as string),
    );
    expect(majorCanonicals).toContain('E major');
    expect(majorCanonicals).toContain('Ab major');
  });
});

describe('mode_swap — validator-clean across the retry budget at grade 3 (scope is law; D8 put E/Ab in scope)', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('mode_swap', opts3(GRADE3_ATOMS, seed));
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('mode_swap — single-atom scope is safe at grade 3 (D4: the distractor pool never depends on the atoms)', () => {
  const atoms = ['key_sig:C#_minor'];
  const instances = Array.from({ length: 20 }, (_, seed) => generate('mode_swap', opts3(atoms, seed)));

  test('generation succeeds across seeds 0..19 without throwing', () => {
    expect(instances).toHaveLength(20);
  });

  test('every instance asks about the C#<->E pair — the single atom pins the pair', () => {
    for (const inst of instances) {
      expect(pairMinorTonic(inst)).toBe('C#');
    }
  });

  test('distractors are still capped at exactly 2 (drawn from the full grade-3 scope, not the single atom)', () => {
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

describe('mode_swap — grade-3 distractor contract (commandment 3: diagnostic, never the answer; carried from grade 2, re-asserted over the D4 selection logic)', () => {
  const GRADE3_MINORS = ['A', 'E', 'D', 'B', 'G', 'F#', 'C', 'C#', 'F'];
  const GRADE3_MAJORS = ['C', 'G', 'D', 'F', 'A', 'Bb', 'Eb', 'E', 'Ab'];
  const instances = Array.from({ length: 200 }, (_, seed) => generate('mode_swap', opts3(GRADE3_ATOMS, seed)));

  test('every distractor is the same mode as the answer, in grade-3 scope, with no duplicates, and never the answer', () => {
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
        expect(canonicalIsMinor ? GRADE3_MINORS : GRADE3_MAJORS).toContain(tonic);
      }
    }
  });
});
