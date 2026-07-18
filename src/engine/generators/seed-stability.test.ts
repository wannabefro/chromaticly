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

describe('seed-stability — grade-1 generator output is pinned byte-for-byte', () => {
  test('every registered generator is exercised (the net cannot silently miss one)', () => {
    const covered = new Set(CASES.map((c) => c.templateId));
    for (const templateId of Object.keys(GENERATORS)) {
      // Invariant: an unpinned generator would let a refactor change its output
      // undetected — so a missing template is a defect in this net, fail loud.
      expect(covered).toContain(templateId);
    }
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
