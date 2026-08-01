import { validate } from '../validator';
import { GENERATORS, generate } from './index';
import { atomsForTemplate } from './test-helpers';

const TEMPLATE_IDS = [
  'note_naming',
  'interval_naming',
  'interval_naming_stave_input',
  'rhythm_sum',
  'key_signature_id',
  'term_meaning',
  'term_meaning_flashcard',
  'bar_validity',
  'add_time_signature',
  'note_value_compare',
  'music_in_context',
];

// mode_swap and scale_construction only exist from grade 2 up (scope.keysMinor
// is empty at grade 1, so no grade-1 instance is ever valid) — covered
// separately below rather than through the grade-1 loops the rest of this
// file shares.
const GRADE_2_ONLY_TEMPLATE_IDS = ['mode_swap', 'scale_construction', 'triplet_recognition'];

// metre_classification (U6, D7) only exists from grade 3 up (its atoms are
// metre:<sig> over the compound trio + the three simple signatures, and
// classifyMetre/checkScope reject a grade-1/2 call) — same "no valid
// below-introduction instance" shape as the grade-2-only pair above, one
// grade tier further out. octave_transposition (grade3-octave-transposition
// slice, D1/D8) joins it — a grade-3-only pitch-content template, bucketed
// the same way.
const GRADE_3_ONLY_TEMPLATE_IDS = ['metre_classification', 'metre_from_class', 'octave_transposition'];

// clef_equivalence (chromaticly-ra3) throws below grade 4 (build() gate) — the
// "same pitch across treble/alto/bass" skill the KB scopes only at grade 4.
const GRADE_4_ONLY_TEMPLATE_IDS = ['clef_equivalence'];

// transposing_instrument (G5-4, chromaticly-wz1) throws below grade 5 (build()
// gate) — the transposing-instrument skill the KB scopes only at grade 5. Same
// shape as clef_equivalence one tier out.
// satb_voice_recognition (G5-1, chromaticly-0iy) throws below grade 5 (build()
// gate) — the SATB "name the voice" grand-staff skill the KB scopes only at
// grade 5. Same grade-5-only shape as the transposing/metre-rewrite pair.
const GRADE_5_ONLY_TEMPLATE_IDS = [
  'transposing_instrument',
  'metre_rewrite',
  'satb_voice_recognition',
  'tuplet_recognition',
  'cadence_recognition',
  'scale_degree_id',
];

// anacrusis_recognition (anacrusis slice, D5) needs an explicit anacrusis:<sig>
// atom (no legacy bare-atom fallback, unlike add_time_signature) but — unlike
// metre_classification — is NOT grade-gated in the generator/validator: its
// atoms are simple time signatures only, which are in scope at every grade.
// "Grade 3 device" is enforced solely by assertAtomResolves reading
// rhythmDevices at the curriculum layer (lessons.ts), so it gets its own
// bucket rather than either grade-tier one above.
//
// chromatic_scale and degree_name_id (fyu.6) join it for the same reason:
// neither reads a grade-scoped dimension from scopeForGrade (a chromatic
// scale carries no key_sig, and a degree name has no notation at all), so
// both produce a valid instance at every grade 1-4 — "Grade 4" is enforced
// solely by assertAtomResolves at the curriculum layer (lessons.ts), not here.
// chord_recognition (fyu.10) joins them too: it draws from scope.keysMajor
// (present at every grade), so "Grade 4" is likewise a curriculum-layer-only
// gate, not a generator-level one.
// ornament_recognition (fyu.11) joins them for the same reason: strand
// terms_signs, no grade-scoped dimension read from scopeForGrade — "Grade 4"
// is a curriculum-layer-only gate (assertAtomResolves), not a generator one.
// instrument_knowledge joins them too, same shape: strand terms_signs,
// text-only, no grade-scoped dimension read from scopeForGrade — "Grade 4" is
// a curriculum-layer-only gate (assertAtomResolves), not a generator one.
// enharmonic_recognition (chromaticly-xbu) joins them too, same shape: strand
// pitch, text-only, no grade-scoped dimension — "Grade 4" is a curriculum-layer
// gate (assertAtomResolves) only.
// rest_completion (chromaticly-gni) joins them: it needs rest:<dur> atoms (throws
// without one) and is valid from grade 1 up; which rest values are in scope is a
// curriculum-layer gate (assertAtomResolves reading scope.rests), not generator-level.
// note_grouping (chromaticly-18o) joins them: it needs a grouping:<sig> atom and
// runs at every grade, gated only by which signature the grade can render.
const ATOM_REQUIRED_TEMPLATE_IDS = [
  'anacrusis_recognition',
  'chromatic_scale',
  'degree_name_id',
  'duplet_recognition',
  'chord_recognition',
  'chord_from_name',
  'ornament_recognition',
  'ornament_effect',
  'interval_compound_reduce',
  'time_signature_match',
  'anacrusis_final_bar',
  'note_sounds_as',
  'note_value_equivalence',
  'rhythm_sum_reverse',
  'instrument_knowledge',
  'enharmonic_recognition',
  'rest_completion',
  'rest_value_id',
  'major_scale_steps',
  'tie_dot_value',
  'note_grouping',
  'note_grouping_metre_id',
  'note_naming_stave_input',
  'scale_degree_stave_input',
  'tonic_triad_key_id',
];

describe('GENERATORS registry', () => {
  test('every expected template_id resolves to a generator function', () => {
    for (const templateId of [
      ...TEMPLATE_IDS,
      ...GRADE_2_ONLY_TEMPLATE_IDS,
      ...GRADE_3_ONLY_TEMPLATE_IDS,
      ...GRADE_4_ONLY_TEMPLATE_IDS,
      ...GRADE_5_ONLY_TEMPLATE_IDS,
      ...ATOM_REQUIRED_TEMPLATE_IDS,
    ]) {
      expect(typeof GENERATORS[templateId]).toBe('function');
    }
  });

  test('has exactly the Tier-A template ids registered — no extras, no gaps', () => {
    expect(Object.keys(GENERATORS).sort()).toEqual(
      [
        ...TEMPLATE_IDS,
        ...GRADE_2_ONLY_TEMPLATE_IDS,
        ...GRADE_3_ONLY_TEMPLATE_IDS,
        ...GRADE_4_ONLY_TEMPLATE_IDS,
        ...GRADE_5_ONLY_TEMPLATE_IDS,
        ...ATOM_REQUIRED_TEMPLATE_IDS,
      ].sort(),
    );
  });
});

describe('generate() — grade-2-only templates', () => {
  test('mode_swap produces a valid grade-2 instance (grade 1 has no valid instance — keysMinor is empty there)', () => {
    const atoms = ['key_sig:A_minor', 'key_sig:E_minor', 'key_sig:D_minor'];
    const instance = generate('mode_swap', { grade: 2, seed: 1, atoms });
    expect(instance.template_id).toBe('mode_swap');
    expect(validate(instance).ok).toBe(true);
  });

  test('scale_construction produces a valid grade-2 instance (grade 1 has no valid instance — keysMinor is empty there)', () => {
    const atoms = ['scale:A_minor_harmonic', 'scale:E_minor_harmonic', 'scale:D_minor_harmonic'];
    const instance = generate('scale_construction', { grade: 2, seed: 1, atoms });
    expect(instance.template_id).toBe('scale_construction');
    expect(validate(instance).ok).toBe(true);
  });
});

describe('generate() — grade-3-only templates', () => {
  test('metre_classification produces a valid grade-3 instance (grade 1/2 have no valid instance — the compound trio is outside their scope)', () => {
    const atoms = ['metre:2/4', 'metre:3/4', 'metre:4/4', 'metre:6/8', 'metre:9/8', 'metre:12/8'];
    const instance = generate('metre_classification', { grade: 3, seed: 1, atoms });
    expect(instance.template_id).toBe('metre_classification');
    expect(validate(instance).ok).toBe(true);
  });

  test('octave_transposition produces a valid grade-3 instance', () => {
    const instance = generate('octave_transposition', { grade: 3, seed: 1, atoms: ['transpose:octave'] });
    expect(instance.template_id).toBe('octave_transposition');
    expect(validate(instance).ok).toBe(true);
  });
});

describe('generate() — grade-4-only templates', () => {
  test('clef_equivalence produces a valid grade-4 instance (throws below grade 4)', () => {
    const instance = generate('clef_equivalence', { grade: 4, seed: 1, atoms: ['clef_equiv:cross'] });
    expect(instance.template_id).toBe('clef_equivalence');
    expect(validate(instance).ok).toBe(true);
    expect(() => generate('clef_equivalence', { grade: 3, seed: 1, atoms: ['clef_equiv:cross'] })).toThrow();
  });
});

describe('generate() — anacrusis_recognition (requires an explicit anacrusis:<sig> atom; not grade-gated by the generator)', () => {
  const atoms = ['anacrusis:2/4', 'anacrusis:3/4', 'anacrusis:4/4'];

  test('produces a valid grade-1 instance too — rhythmDevices gating (D6) is curriculum-layer only', () => {
    const instance = generate('anacrusis_recognition', { grade: 1, seed: 1, atoms });
    expect(instance.template_id).toBe('anacrusis_recognition');
    expect(validate(instance).ok).toBe(true);
  });

  test('produces a valid grade-3 instance', () => {
    const instance = generate('anacrusis_recognition', { grade: 3, seed: 1, atoms });
    expect(instance.template_id).toBe('anacrusis_recognition');
    expect(validate(instance).ok).toBe(true);
  });
});

describe('generate() — chromatic_scale and degree_name_id (curriculum-gated, not generator-gated; fyu.6)', () => {
  test('chromatic_scale produces a valid instance at grade 1 and grade 4', () => {
    const atoms = ['scale:C_chromatic'];
    for (const grade of [1, 4]) {
      const instance = generate('chromatic_scale', { grade, seed: 1, atoms });
      expect(instance.template_id).toBe('chromatic_scale');
      expect(validate(instance).ok).toBe(true);
    }
  });

  test('degree_name_id produces a valid instance at grade 1 and grade 4', () => {
    const atoms = ['degree_name:dominant'];
    for (const grade of [1, 4]) {
      const instance = generate('degree_name_id', { grade, seed: 1, atoms });
      expect(instance.template_id).toBe('degree_name_id');
      expect(validate(instance).ok).toBe(true);
    }
  });
});

describe('generate() — dispatches to the right generator', () => {
  test('generate(templateId, opts) produces an instance whose template_id matches', () => {
    for (const templateId of TEMPLATE_IDS) {
      const instance = generate(templateId, { grade: 1, seed: 1, atoms: atomsForTemplate(templateId) });
      expect(instance.template_id).toBe(templateId);
      expect(validate(instance).ok).toBe(true);
    }
  });

  test('generate() matches calling the registered generator directly for the same seed', () => {
    for (const templateId of TEMPLATE_IDS) {
      const viaRegistry = generate(templateId, { grade: 1, seed: 55, atoms: atomsForTemplate(templateId) });
      const viaDirect = GENERATORS[templateId]({ grade: 1, seed: 55, atoms: atomsForTemplate(templateId) });
      expect(viaRegistry).toEqual(viaDirect);
    }
  });

  test('throws on an unregistered template_id', () => {
    expect(() => generate('melody_generator', { grade: 1, seed: 0, atoms: [] })).toThrow(/No generator registered/);
  });
});
