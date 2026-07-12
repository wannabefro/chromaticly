import { validate } from '../validator';
import { GENERATORS, generate } from './index';

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
];

describe('GENERATORS registry', () => {
  test('every expected template_id resolves to a generator function', () => {
    for (const templateId of TEMPLATE_IDS) {
      expect(typeof GENERATORS[templateId]).toBe('function');
    }
  });

  test('has exactly the nine Tier-A template ids registered — no extras, no gaps', () => {
    expect(Object.keys(GENERATORS).sort()).toEqual([...TEMPLATE_IDS].sort());
  });
});

describe('generate() — dispatches to the right generator', () => {
  test('generate(templateId, opts) produces an instance whose template_id matches', () => {
    for (const templateId of TEMPLATE_IDS) {
      const instance = generate(templateId, { grade: 1, seed: 1 });
      expect(instance.template_id).toBe(templateId);
      expect(validate(instance).ok).toBe(true);
    }
  });

  test('generate() matches calling the registered generator directly for the same seed', () => {
    for (const templateId of TEMPLATE_IDS) {
      const viaRegistry = generate(templateId, { grade: 1, seed: 55 });
      const viaDirect = GENERATORS[templateId]({ grade: 1, seed: 55 });
      expect(viaRegistry).toEqual(viaDirect);
    }
  });

  test('throws on an unregistered template_id', () => {
    expect(() => generate('melody_generator', { grade: 1, seed: 0 })).toThrow(/No generator registered/);
  });
});
