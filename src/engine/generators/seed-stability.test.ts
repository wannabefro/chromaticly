// U1 — the Grade-2-foundation characterization net (plan 2026-07-18-002).
//
// Generator output is a pure function of (template, grade, seed, atoms). This
// suite pins that function for Grade 1 with committed snapshots, so the scope
// generalization (G1_ constants -> scopeForGrade) can be proven byte-identical:
// any change that consumes the RNG differently (a reordered array, an extra
// pick, a changed spread) shifts an instance and fails here — NOT silently on a
// learner's device. Every later unit of the plan re-runs this suite unchanged.
//
// Coverage is driven by the REAL curriculum pairs (each lesson × its templates),
// which is what production generates, so the atom-branching generators
// (note_naming across treble/bass/accidentals, key_signature_id over the key
// subset, find_the_bar over its property variants) are all exercised with their
// true atom scopes — plus the two registered templates no lesson references
// (note_value_compare, term_meaning). A coverage assertion fails loudly if a
// registered generator is ever left unpinned.

import { LESSONS_BY_GRADE } from '../../content/lessons';
import { buildContextPassage } from './context-passage';
import { generate, GENERATORS } from './index';
import { atomsForLesson } from './test-helpers';

const SEEDS = Array.from({ length: 20 }, (_, i) => i);

interface Case {
  label: string;
  templateId: string;
  atoms: string[];
}

// Every (lesson, template) pair production actually generates, pinned at grade 1.
const LESSON_CASES: Case[] = LESSONS_BY_GRADE[1].flatMap((lesson) =>
  lesson.templates.map((templateId) => ({
    label: `${templateId} @ ${lesson.id}`,
    templateId,
    atoms: lesson.atoms,
  })),
);

// Registered templates no lesson references (used in onboarding / practice
// rotation), pinned with a representative real atom scope.
const EXTRA_CASES: Case[] = [
  { label: 'note_value_compare (rotation)', templateId: 'note_value_compare', atoms: [] },
  { label: 'term_meaning (rotation)', templateId: 'term_meaning', atoms: atomsForLesson('terms-and-signs') },
];

const CASES = [...LESSON_CASES, ...EXTRA_CASES];

// U2 (grade2-minor-keys plan, review finding 1) — a generator that only
// exists from grade 2 up has no valid grade-1 instance to snapshot (a
// grade-1 call would throw or produce garbage), so it must never be forced
// into CASES above. Declaring it here routes its coverage requirement to
// GRADE_2_EXTRA_CASES instead. Both are empty until U3/U4 register the first
// grade-2-only generator (mode_swap, scale_construction).
const GRADE_2_ONLY_TEMPLATES = new Set<string>(['mode_swap', 'scale_construction']);

// Grade-2-only generators, pinned directly at grade 2 (mirrors EXTRA_CASES
// above, since no grade-1 lesson can ever reference a grade-2-only template).
const GRADE_2_EXTRA_CASES: Case[] = [
  {
    label: 'mode_swap (minor-keys-2, pre-lesson pin)',
    templateId: 'mode_swap',
    atoms: ['key_sig:A_minor', 'key_sig:E_minor', 'key_sig:D_minor'],
  },
  {
    label: 'scale_construction (minor-scales-2, pre-lesson pin)',
    templateId: 'scale_construction',
    atoms: ['scale:A_minor_harmonic', 'scale:E_minor_harmonic', 'scale:D_minor_harmonic'],
  },
];

/** A grade-2-only template is covered only by a grade-2 pin; every other template is covered by a grade-1 case. */
function isTemplateCovered(
  templateId: string,
  grade1Covered: Set<string>,
  grade2Only: Set<string>,
  grade2Covered: Set<string>,
): boolean {
  return grade2Only.has(templateId) ? grade2Covered.has(templateId) : grade1Covered.has(templateId);
}

/** A grade-2-only template that also has a grade-1 case would pin a throw or an invalid instance — always a defect. */
function grade1Leaks(grade2Only: Set<string>, grade1Covered: Set<string>): string[] {
  return [...grade2Only].filter((templateId) => grade1Covered.has(templateId));
}

describe('seed-stability — grade-1 generator output is pinned byte-for-byte', () => {
  test('every registered generator is exercised (the net cannot silently miss one)', () => {
    const grade1Covered = new Set(CASES.map((c) => c.templateId));
    const grade2Covered = new Set(GRADE_2_EXTRA_CASES.map((c) => c.templateId));
    for (const templateId of Object.keys(GENERATORS)) {
      // Invariant: an unpinned generator would let a refactor change its output
      // undetected — so a missing template is a defect in this net, fail loud.
      expect(isTemplateCovered(templateId, grade1Covered, GRADE_2_ONLY_TEMPLATES, grade2Covered)).toBe(true);
    }
  });

  test('a grade-2-only template is never pinned in a grade-1 case', () => {
    const grade1Covered = new Set(CASES.map((c) => c.templateId));
    expect(grade1Leaks(GRADE_2_ONLY_TEMPLATES, grade1Covered)).toEqual([]);
  });

  describe.each(CASES)('$label', ({ templateId, atoms }) => {
    test('instances are a pure function of (template, grade, seed, atoms)', () => {
      const instances = SEEDS.map((seed) => generate(templateId, { grade: 1, seed, atoms }));
      expect(instances).toMatchSnapshot();
    });
  });

  // buildContextPassage is the passage path (SetRunner routes music_in_context
  // here, not through GENERATORS) — its own RNG surface, pinned separately.
  describe('music_in_context passage', () => {
    const atoms = atomsForLesson('music-in-context');
    test('passages are a pure function of (grade, seed, atoms)', () => {
      const passages = SEEDS.map((seed) => buildContextPassage({ grade: 1, seed, atoms }));
      expect(passages).toMatchSnapshot();
    });
  });
});

// describe.each rejects an empty table, and GRADE_2_EXTRA_CASES is
// intentionally empty until U3/U4 register the first grade-2-only generator.
if (GRADE_2_EXTRA_CASES.length > 0) {
  describe('seed-stability — grade-2-only generator extras are pinned byte-for-byte', () => {
    describe.each(GRADE_2_EXTRA_CASES)('$label', ({ templateId, atoms }) => {
      test('instances are a pure function of (template, grade, seed, atoms)', () => {
        const instances = SEEDS.map((seed) => generate(templateId, { grade: 2, seed, atoms }));
        expect(instances).toMatchSnapshot();
      });
    });
  });
}

describe('seed-stability — grade partition coverage logic (synthetic inputs, no live generator required)', () => {
  test('a registered generator in neither partition is reported uncovered — the core "no generator ships unpinned" guarantee survives the refactor', () => {
    const grade1Covered = new Set(['note_naming']);
    const grade2Only = new Set(['mode_swap']);
    const grade2Covered = new Set(['mode_swap']);
    expect(isTemplateCovered('unregistered_orphan', grade1Covered, grade2Only, grade2Covered)).toBe(false);
  });

  test('a grade-2-only template pinned only at grade 2 counts as covered', () => {
    const grade1Covered = new Set(['note_naming']);
    const grade2Only = new Set(['mode_swap']);
    const grade2Covered = new Set(['mode_swap']);
    expect(isTemplateCovered('mode_swap', grade1Covered, grade2Only, grade2Covered)).toBe(true);
  });

  test('a template declared grade-2-only that also appears in a grade-1 case is flagged as a leak', () => {
    const grade1Covered = new Set(['note_naming', 'mode_swap']);
    const grade2Only = new Set(['mode_swap']);
    expect(grade1Leaks(grade2Only, grade1Covered)).toEqual(['mode_swap']);
  });

  test('disjoint partitions report no leak', () => {
    const grade1Covered = new Set(['note_naming']);
    const grade2Only = new Set(['mode_swap']);
    expect(grade1Leaks(grade2Only, grade1Covered)).toEqual([]);
  });
});

// U2 (D12) — grade-2 cases, pinned additively and separately from the grade-1
// block above: new snapshot keys only, and grade-1's entries must stay
// byte-identical (verified via git diff on the snapshot file, not by this suite).
const GRADE_2_CASES: Case[] = LESSONS_BY_GRADE[2].flatMap((lesson) =>
  lesson.templates.map((templateId) => ({
    label: `${templateId} @ ${lesson.id}`,
    templateId,
    atoms: lesson.atoms,
  })),
);

describe('seed-stability — grade-2 generator output is pinned byte-for-byte', () => {
  describe.each(GRADE_2_CASES)('$label', ({ templateId, atoms }) => {
    test('instances are a pure function of (template, grade, seed, atoms)', () => {
      const instances = SEEDS.map((seed) => generate(templateId, { grade: 2, seed, atoms }));
      expect(instances).toMatchSnapshot();
    });
  });
});

// U3 (grade3-melodic-minor plan, D10) — grade-3-only pins, additive and
// separate from every grade-1/2 block above: no existing key moves, these
// are new snapshot keys only. Pinned pre-lesson (mirroring GRADE_2_EXTRA_CASES)
// so generator-level grade-3 output is characterized before U5 registers the
// real lessons; U4/U5 append their own cases to this same array.
const GRADE_3_EXTRA_CASES: Case[] = [
  {
    label: 'mode_swap (minor-keys-3, pre-lesson pin)',
    templateId: 'mode_swap',
    atoms: [
      'key_sig:B_minor',
      'key_sig:G_minor',
      'key_sig:F#_minor',
      'key_sig:C_minor',
      'key_sig:C#_minor',
      'key_sig:F_minor',
    ],
  },
  {
    label: 'scale_construction harmonic (minor-scales-3, pre-lesson pin)',
    templateId: 'scale_construction',
    atoms: [
      'scale:B_minor_harmonic',
      'scale:G_minor_harmonic',
      'scale:F#_minor_harmonic',
      'scale:C_minor_harmonic',
      'scale:C#_minor_harmonic',
      'scale:F_minor_harmonic',
    ],
  },
  {
    label: 'scale_construction melodic (melodic-minor-3, pre-lesson pin)',
    templateId: 'scale_construction',
    atoms: [
      'scale:A_minor_melodic',
      'scale:E_minor_melodic',
      'scale:D_minor_melodic',
      'scale:B_minor_melodic',
      'scale:G_minor_melodic',
      'scale:F#_minor_melodic',
      'scale:C_minor_melodic',
      'scale:C#_minor_melodic',
      'scale:F_minor_melodic',
    ],
  },
];

if (GRADE_3_EXTRA_CASES.length > 0) {
  describe('seed-stability — grade-3-only generator extras are pinned byte-for-byte', () => {
    describe.each(GRADE_3_EXTRA_CASES)('$label', ({ templateId, atoms }) => {
      test('instances are a pure function of (template, grade, seed, atoms)', () => {
        const instances = SEEDS.map((seed) => generate(templateId, { grade: 3, seed, atoms }));
        expect(instances).toMatchSnapshot();
      });
    });
  });
}

// U5 (grade3-melodic-minor plan, D10) — lesson-derived grade-3 cases, mirroring
// GRADE_2_CASES above: new snapshot keys only, additive alongside the U3/U4
// pre-lesson GRADE_3_EXTRA_CASES pins (both may cover the same (template,
// atoms) pair by design — the pre-lesson pins stay so a later cleanup has
// two independent nets to delete from, not one).
const GRADE_3_CASES: Case[] = LESSONS_BY_GRADE[3].flatMap((lesson) =>
  lesson.templates.map((templateId) => ({
    label: `${templateId} @ ${lesson.id}`,
    templateId,
    atoms: lesson.atoms,
  })),
);

describe('seed-stability — grade-3 lesson-derived generator output is pinned byte-for-byte', () => {
  describe.each(GRADE_3_CASES)('$label', ({ templateId, atoms }) => {
    test('instances are a pure function of (template, grade, seed, atoms)', () => {
      const instances = SEEDS.map((seed) => generate(templateId, { grade: 3, seed, atoms }));
      expect(instances).toMatchSnapshot();
    });
  });
});
