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
const GRADE_2_ONLY_TEMPLATE_IDS = ['mode_swap', 'scale_construction'];

// metre_classification (U6, D7) only exists from grade 3 up (its atoms are
// metre:<sig> over the compound trio + the three simple signatures, and
// classifyMetre/checkScope reject a grade-1/2 call) — same "no valid
// below-introduction instance" shape as the grade-2-only pair above, one
// grade tier further out.
const GRADE_3_ONLY_TEMPLATE_IDS = ['metre_classification'];

describe('GENERATORS registry', () => {
  test('every expected template_id resolves to a generator function', () => {
    for (const templateId of [...TEMPLATE_IDS, ...GRADE_2_ONLY_TEMPLATE_IDS, ...GRADE_3_ONLY_TEMPLATE_IDS]) {
      expect(typeof GENERATORS[templateId]).toBe('function');
    }
  });

  test('has exactly the Tier-A template ids registered — no extras, no gaps', () => {
    expect(Object.keys(GENERATORS).sort()).toEqual(
      [...TEMPLATE_IDS, ...GRADE_2_ONLY_TEMPLATE_IDS, ...GRADE_3_ONLY_TEMPLATE_IDS].sort(),
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
