// Tier-A generator registry (U6-U8). Maps each template_id to its generator.

import type { ExerciseInstance } from '../schema';
import { addTimeSignature } from './add-time-signature';
import { barValidity } from './bar-validity';
import { findTheBar } from './find-the-bar';
import { intervalNaming, intervalNamingStaveInput } from './interval-naming';
import { keySignatureId } from './key-signature-id';
import { modeSwap } from './mode-swap';
import { noteNaming } from './note-naming';
import { noteValueCompare } from './note-value-compare';
import { rhythmSum } from './rhythm-sum';
import { scaleConstruction } from './scale-construction';
import { termMeaning, termMeaningFlashcard } from './term-meaning';
import type { GenerateOptions, Generator } from './types';

export const GENERATORS: Record<string, Generator> = {
  note_naming: noteNaming,
  interval_naming: intervalNaming,
  interval_naming_stave_input: intervalNamingStaveInput,
  rhythm_sum: rhythmSum,
  key_signature_id: keySignatureId,
  mode_swap: modeSwap,
  scale_construction: scaleConstruction,
  term_meaning: termMeaning,
  term_meaning_flashcard: termMeaningFlashcard,
  bar_validity: barValidity,
  add_time_signature: addTimeSignature,
  note_value_compare: noteValueCompare,
  music_in_context: findTheBar,
};

export function generate(templateId: string, opts: GenerateOptions): ExerciseInstance {
  const generator = GENERATORS[templateId];
  if (!generator) throw new Error(`No generator registered for template_id "${templateId}"`);
  return generator(opts);
}
