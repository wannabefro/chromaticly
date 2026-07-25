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
  // chromaticly-gni — rest_completion is introduced at grade 1; pinned pre-lesson
  // (before rests-1 exists) so registration is covered by the net at introduction.
  {
    label: 'rest_completion (rests-1, pre-lesson pin, chromaticly-gni)',
    templateId: 'rest_completion',
    atoms: ['rest:semibreve', 'rest:minim', 'rest:crotchet', 'rest:quaver', 'rest:semiquaver'],
  },
];

const CASES = [...LESSON_CASES, ...EXTRA_CASES];

// U1 (D12) — a data-driven map from template to the grade it's introduced
// at; absent ⇒ grade 1 (the default, since most templates exist from grade
// 1). A generator that only exists from grade g up has no valid
// below-g instance to snapshot (a below-g call would throw or produce
// garbage), so it must never be forced into a below-g case set — declaring
// it here routes its coverage requirement to the matching *_EXTRA_CASES pool
// instead. metre_classification registers as grade 3 in U6 — the first entry
// this map needs beyond grade 2.
const TEMPLATE_INTRODUCED_AT: Record<string, 2 | 3 | 4 | 5> = {
  mode_swap: 2,
  scale_construction: 2,
  metre_classification: 3,
  anacrusis_recognition: 3,
  octave_transposition: 3,
  chromatic_scale: 4,
  degree_name_id: 4,
  duplet_recognition: 4,
  chord_recognition: 4,
  ornament_recognition: 4,
  instrument_knowledge: 4,
  enharmonic_recognition: 4,
  clef_equivalence: 4,
  transposing_instrument: 5,
  metre_rewrite: 5,
  satb_voice_recognition: 5,
};

/** The grade a template first exists at; every template not listed here exists from grade 1. */
function introducedAtGrade(templateId: string): 1 | 2 | 3 | 4 | 5 {
  return TEMPLATE_INTRODUCED_AT[templateId] ?? 1;
}

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

type CoverageByGrade = Partial<Record<1 | 2 | 3 | 4 | 5, Set<string>>>;

/** A template is covered only by a pin block at the grade it's introduced at. */
function isTemplateCovered(templateId: string, introducedAt: 1 | 2 | 3 | 4 | 5, coverageByGrade: CoverageByGrade): boolean {
  return coverageByGrade[introducedAt]?.has(templateId) ?? false;
}

/** A template pinned below the grade it's introduced at would pin a throw or an invalid instance — always a defect. */
function templateLeaksBelowIntroduction(
  templateId: string,
  introducedAt: 1 | 2 | 3 | 4 | 5,
  coverageByGrade: CoverageByGrade,
): boolean {
  return ([1, 2, 3, 4, 5] as const).filter((g) => g < introducedAt).some((g) => coverageByGrade[g]?.has(templateId));
}

describe('seed-stability — grade-1 generator output is pinned byte-for-byte', () => {
  test('every registered generator is exercised (the net cannot silently miss one)', () => {
    const coverageByGrade: CoverageByGrade = {
      1: new Set(CASES.map((c) => c.templateId)),
      2: new Set(GRADE_2_EXTRA_CASES.map((c) => c.templateId)),
      3: new Set(GRADE_3_EXTRA_CASES.map((c) => c.templateId)),
      4: new Set(GRADE_4_EXTRA_CASES.map((c) => c.templateId)),
      5: new Set(GRADE_5_EXTRA_CASES.map((c) => c.templateId)),
    };
    for (const templateId of Object.keys(GENERATORS)) {
      // Invariant: an unpinned generator would let a refactor change its output
      // undetected — so a missing template is a defect in this net, fail loud.
      expect(isTemplateCovered(templateId, introducedAtGrade(templateId), coverageByGrade)).toBe(true);
    }
  });

  test('no template is pinned in a case set below the grade it is introduced at', () => {
    const coverageByGrade: CoverageByGrade = {
      1: new Set(CASES.map((c) => c.templateId)),
      2: new Set(GRADE_2_EXTRA_CASES.map((c) => c.templateId)),
      3: new Set(GRADE_3_EXTRA_CASES.map((c) => c.templateId)),
      4: new Set(GRADE_4_EXTRA_CASES.map((c) => c.templateId)),
      5: new Set(GRADE_5_EXTRA_CASES.map((c) => c.templateId)),
    };
    const leaks = Object.keys(GENERATORS).filter((templateId) =>
      templateLeaksBelowIntroduction(templateId, introducedAtGrade(templateId), coverageByGrade),
    );
    expect(leaks).toEqual([]);
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
  test('a registered generator pinned nowhere is reported uncovered — the core "no generator ships unpinned" guarantee survives the refactor', () => {
    const coverageByGrade: CoverageByGrade = { 1: new Set(['note_naming']), 2: new Set(['mode_swap']) };
    expect(isTemplateCovered('unregistered_orphan', 1, coverageByGrade)).toBe(false);
  });

  test('a grade-2-introduced template pinned only at grade 2 counts as covered', () => {
    const coverageByGrade: CoverageByGrade = { 1: new Set(['note_naming']), 2: new Set(['mode_swap']) };
    expect(isTemplateCovered('mode_swap', 2, coverageByGrade)).toBe(true);
  });

  test('a grade-2-introduced template that also appears in the grade-1 case set is flagged as a leak', () => {
    const coverageByGrade: CoverageByGrade = { 1: new Set(['note_naming', 'mode_swap']), 2: new Set(['mode_swap']) };
    expect(templateLeaksBelowIntroduction('mode_swap', 2, coverageByGrade)).toBe(true);
  });

  test('disjoint partitions report no leak', () => {
    const coverageByGrade: CoverageByGrade = { 1: new Set(['note_naming']), 2: new Set(['mode_swap']) };
    expect(templateLeaksBelowIntroduction('mode_swap', 2, coverageByGrade)).toBe(false);
  });

  // The generalization this unit exists for: a genuinely grade-3-only
  // template (metre_classification, registered in U6) must be caught by the
  // same "no generator ships unpinned" / "no lower-grade leak" nets, not just
  // grade 1 vs grade 2.
  test('a template introduced at grade 3, pinned only in a grade-3 case set, counts as covered — the "no generator ships unpinned" guarantee now extends to grade-3-only templates', () => {
    const coverageByGrade: CoverageByGrade = { 1: new Set(['note_naming']), 3: new Set(['metre_classification']) };
    expect(isTemplateCovered('metre_classification', 3, coverageByGrade)).toBe(true);
  });

  test('a template introduced at grade 3 with no grade-3 pin is reported uncovered', () => {
    const coverageByGrade: CoverageByGrade = { 1: new Set(['note_naming']) };
    expect(isTemplateCovered('metre_classification', 3, coverageByGrade)).toBe(false);
  });

  test('a grade-3-introduced template appearing in a grade-1 case set is flagged as a leak', () => {
    const coverageByGrade: CoverageByGrade = { 1: new Set(['metre_classification']) };
    expect(templateLeaksBelowIntroduction('metre_classification', 3, coverageByGrade)).toBe(true);
  });

  test('a grade-3-introduced template appearing in a grade-2 case set is flagged as a leak — both lower grades are checked, not just grade 1', () => {
    const coverageByGrade: CoverageByGrade = { 2: new Set(['metre_classification']) };
    expect(templateLeaksBelowIntroduction('metre_classification', 3, coverageByGrade)).toBe(true);
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
  {
    label: 'add_time_signature compound (compound-bars-3, pre-lesson pin, U5)',
    templateId: 'add_time_signature',
    atoms: ['add_time_signature:6/8', 'add_time_signature:9/8', 'add_time_signature:12/8'],
  },
  {
    label: 'metre_classification (compound-time-3, pre-lesson pin, U6)',
    templateId: 'metre_classification',
    atoms: ['metre:2/4', 'metre:3/4', 'metre:4/4', 'metre:6/8', 'metre:9/8', 'metre:12/8'],
  },
  {
    label: 'interval_naming number+type (intervals-3, pre-lesson pin, U3)',
    templateId: 'interval_naming',
    atoms: [
      'interval_type:2',
      'interval_type:3',
      'interval_type:4',
      'interval_type:5',
      'interval_type:6',
      'interval_type:7',
      'interval_type:8',
    ],
  },
  {
    label: 'anacrusis_recognition (anacrusis-3, pre-lesson pin, U4)',
    templateId: 'anacrusis_recognition',
    atoms: ['anacrusis:2/4', 'anacrusis:3/4', 'anacrusis:4/4'],
  },
  {
    label: 'octave_transposition (transposition-3, pre-lesson pin, U2)',
    templateId: 'octave_transposition',
    atoms: ['transpose:octave'],
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

// U6 (fyu.6) — grade-4-only pins, additive and separate from every lower-grade
// block above: new snapshot keys only. Pinned pre-lesson (mirroring
// GRADE_3_EXTRA_CASES) so generator-level grade-4 output — including the first
// double-sharp in the course, G# harmonic minor's F𝄪 raised 7th — is
// characterized independently of the lesson-derived pins. Later grade-4 slices
// append their own cases (new generators) to this same array.
const GRADE_4_EXTRA_CASES: Case[] = [
  {
    label: 'mode_swap (keys-4, pre-lesson pin)',
    templateId: 'mode_swap',
    atoms: ['key_sig:G#_minor', 'key_sig:Bb_minor'],
  },
  {
    label: 'scale_construction harmonic (minor-scales-4, pre-lesson pin)',
    templateId: 'scale_construction',
    atoms: ['scale:G#_minor_harmonic', 'scale:Bb_minor_harmonic'],
  },
  {
    label: 'scale_construction melodic (minor-scales-4, pre-lesson pin)',
    templateId: 'scale_construction',
    atoms: ['scale:G#_minor_melodic', 'scale:Bb_minor_melodic'],
  },
  {
    label: 'chromatic_scale (chromatic-scale-4, pre-lesson pin)',
    templateId: 'chromatic_scale',
    atoms: ['scale:C_chromatic', 'scale:G_chromatic'],
  },
  {
    label: 'degree_name_id (degree-names-4, pre-lesson pin)',
    templateId: 'degree_name_id',
    atoms: ['degree_name:tonic', 'degree_name:dominant', 'degree_name:leading_note'],
  },
  {
    label: 'note_value_compare breve (rhythm-4, pre-lesson pin)',
    templateId: 'note_value_compare',
    atoms: [],
  },
  {
    label: 'rhythm_sum double-dot (rhythm-4, pre-lesson pin)',
    templateId: 'rhythm_sum',
    atoms: ['rhythm_sum'],
  },
  {
    label: 'duplet_recognition (duplet-4, pre-lesson pin)',
    templateId: 'duplet_recognition',
    atoms: ['duplet:6/8', 'duplet:9/8', 'duplet:12/8'],
  },
  {
    label: 'interval_naming aug/dim + between-any-notes (intervals-4, pre-lesson pin)',
    templateId: 'interval_naming',
    atoms: ['interval_type:2', 'interval_type:3', 'interval_type:4', 'interval_type:5', 'interval_type:6', 'interval_type:7', 'interval_type:8'],
  },
  {
    label: 'note_naming alto (alto-reading-4, pre-lesson pin)',
    templateId: 'note_naming',
    atoms: ['note_read:alto:C4', 'note_read:alto:F3', 'note_read:alto:A3', 'note_read:alto:E4', 'note_read:alto:G4'],
  },
  {
    label: 'octave_transposition alto (transposition-4-alto, pre-lesson pin)',
    templateId: 'octave_transposition',
    atoms: ['transpose:octave'],
  },
  {
    label: 'clef_equivalence (clef-equivalence-4, pre-lesson pin, chromaticly-ra3)',
    templateId: 'clef_equivalence',
    atoms: ['clef_equiv:cross'],
  },
  {
    label: 'chord_recognition (chords-4, pre-lesson pin)',
    templateId: 'chord_recognition',
    atoms: ['chord:I', 'chord:IV', 'chord:V'],
  },
  {
    label: 'ornament_recognition (ornaments-4, pre-lesson pin)',
    templateId: 'ornament_recognition',
    atoms: [
      'ornament:trill',
      'ornament:turn',
      'ornament:upper_mordent',
      'ornament:lower_mordent',
      'ornament:acciaccatura',
      'ornament:appoggiatura',
    ],
  },
  {
    label: 'instrument_knowledge (instruments-4, pre-lesson pin)',
    templateId: 'instrument_knowledge',
    atoms: ['instrument_family:trumpet', 'instrument_clef:viola', 'direction:arco', 'direction:pizzicato', 'direction:con sordino'],
  },
  {
    label: 'metre_classification new metres (time-signatures-4, pre-lesson pin, 570.U4)',
    templateId: 'metre_classification',
    atoms: [
      'metre:2/8',
      'metre:3/8',
      'metre:4/8',
      'metre:6/4',
      'metre:9/4',
      'metre:12/4',
      'metre:6/16',
      'metre:9/16',
      'metre:12/16',
    ],
  },
  {
    label: 'enharmonic_recognition (enharmonics-4, pre-lesson pin, chromaticly-xbu)',
    templateId: 'enharmonic_recognition',
    atoms: ['enharmonic:C#', 'enharmonic:Db', 'enharmonic:D#', 'enharmonic:Eb', 'enharmonic:F#', 'enharmonic:Gb', 'enharmonic:G#', 'enharmonic:Ab', 'enharmonic:A#', 'enharmonic:Bb'],
  },
  {
    label: 'key_signature_id B/Db major (major-keys-4, pre-lesson pin, chromaticly-fm9)',
    templateId: 'key_signature_id',
    atoms: ['key_sig:E_major', 'key_sig:B_major', 'key_sig:Ab_major', 'key_sig:Db_major'],
  },
];

if (GRADE_4_EXTRA_CASES.length > 0) {
  describe('seed-stability — grade-4-only generator extras are pinned byte-for-byte', () => {
    describe.each(GRADE_4_EXTRA_CASES)('$label', ({ templateId, atoms }) => {
      test('instances are a pure function of (template, grade, seed, atoms)', () => {
        const instances = SEEDS.map((seed) => generate(templateId, { grade: 4, seed, atoms }));
        expect(instances).toMatchSnapshot();
      });
    });
  });
}

// Grade-5-only generators, pinned directly at grade 5 (mirrors the grade-4
// extras): transposing_instrument (G5-4, chromaticly-wz1) is net-new at grade 5
// — no lower grade has any valid instance — so it carries its own pre-lesson
// pin independent of the transposing-instruments-5 lesson.
const GRADE_5_EXTRA_CASES: Case[] = [
  {
    label: 'transposing_instrument (transposing-instruments-5, pre-lesson pin, chromaticly-wz1)',
    templateId: 'transposing_instrument',
    atoms: ['transpose_instrument:bb', 'transpose_instrument:a', 'transpose_instrument:f'],
  },
  {
    label: 'metre_rewrite (metre-rewrite-5, pre-lesson pin, chromaticly-4ak)',
    templateId: 'metre_rewrite',
    atoms: ['rewrite:simple_compound'],
  },
  {
    label: 'satb_voice_recognition (satb-5, pre-lesson pin, chromaticly-g5-1)',
    templateId: 'satb_voice_recognition',
    atoms: ['satb_voice:soprano', 'satb_voice:alto', 'satb_voice:tenor', 'satb_voice:bass'],
  },
];

if (GRADE_5_EXTRA_CASES.length > 0) {
  describe('seed-stability — grade-5-only generator extras are pinned byte-for-byte', () => {
    describe.each(GRADE_5_EXTRA_CASES)('$label', ({ templateId, atoms }) => {
      test('instances are a pure function of (template, grade, seed, atoms)', () => {
        const instances = SEEDS.map((seed) => generate(templateId, { grade: 5, seed, atoms }));
        expect(instances).toMatchSnapshot();
      });
    });
  });
}

// U6 (fyu.6) — lesson-derived grade-4 cases, mirroring GRADE_3_CASES: new
// snapshot keys only, additive alongside the pre-lesson GRADE_4_EXTRA_CASES pins.
const GRADE_4_CASES: Case[] = LESSONS_BY_GRADE[4].flatMap((lesson) =>
  lesson.templates.map((templateId) => ({
    label: `${templateId} @ ${lesson.id}`,
    templateId,
    atoms: lesson.atoms,
  })),
);

describe('seed-stability — grade-4 lesson-derived generator output is pinned byte-for-byte', () => {
  describe.each(GRADE_4_CASES)('$label', ({ templateId, atoms }) => {
    test('instances are a pure function of (template, grade, seed, atoms)', () => {
      const instances = SEEDS.map((seed) => generate(templateId, { grade: 4, seed, atoms }));
      expect(instances).toMatchSnapshot();
    });
  });
});

// Grade-5 lesson-derived cases (chromaticly-ehp). chord_recognition is already
// introduced at grade 4, so these are new snapshot keys only (additive) — grade
// 1-4 keys are untouched. The inversions atoms (chord:<numeral>:<pos>) route the
// generator into its Grade-5 inversions path.
const GRADE_5_CASES: Case[] = LESSONS_BY_GRADE[5].flatMap((lesson) =>
  lesson.templates.map((templateId) => ({
    label: `${templateId} @ ${lesson.id}`,
    templateId,
    atoms: lesson.atoms,
  })),
);

describe('seed-stability — grade-5 lesson-derived generator output is pinned byte-for-byte', () => {
  describe.each(GRADE_5_CASES)('$label', ({ templateId, atoms }) => {
    test('instances are a pure function of (template, grade, seed, atoms)', () => {
      const instances = SEEDS.map((seed) => generate(templateId, { grade: 5, seed, atoms }));
      expect(instances).toMatchSnapshot();
    });
  });
});
