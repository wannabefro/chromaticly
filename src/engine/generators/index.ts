// Tier-A generator registry (U6-U8). Maps each template_id to its generator.

import type { ExerciseInstance } from '../schema';
import { barValidity } from './bar-validity';
import { intervalNaming } from './interval-naming';
import { keySignatureId } from './key-signature-id';
import { noteNaming } from './note-naming';
import { rhythmSum } from './rhythm-sum';
import { termMeaning, termMeaningFlashcard } from './term-meaning';
import type { GenerateOptions, Generator } from './types';

export const GENERATORS: Record<string, Generator> = {
  note_naming: noteNaming,
  interval_naming: intervalNaming,
  rhythm_sum: rhythmSum,
  key_signature_id: keySignatureId,
  term_meaning: termMeaning,
  term_meaning_flashcard: termMeaningFlashcard,
  bar_validity: barValidity,
};

export function generate(templateId: string, opts: GenerateOptions): ExerciseInstance {
  const generator = GENERATORS[templateId];
  if (!generator) throw new Error(`No generator registered for template_id "${templateId}"`);
  return generator(opts);
}
