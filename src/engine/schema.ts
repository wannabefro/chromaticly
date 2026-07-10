// Zod schema + inferred type for an exercise instance (curriculum/exercise-templates.json's
// exercise_instance_schema), plus kb_version (KTD4: reproducibility across content updates —
// not in the JSON schema doc, added per the plan).

import { z } from 'zod';

export const ExerciseInstanceSchema = z.object({
  id: z.string(),
  template_id: z.string(),
  grade: z.number().int().min(1).max(5),
  strand: z.enum(['rhythm', 'pitch', 'scales_keys', 'intervals', 'chords', 'terms_signs', 'context']),
  unit: z.string().optional(),
  prompt: z.string(),
  stimulus: z.object({
    music: z.any().nullable(),
    text: z.string().nullable(),
  }),
  interaction: z.object({
    type: z.enum([
      'mcq',
      'multi_select',
      'true_false',
      'text_input',
      'stave_input',
      'tap_placement',
      'drag_match',
      'grid_fill',
      'roman_numeral_boxes',
    ]),
    config: z.record(z.string(), z.any()),
  }),
  answer: z.object({
    canonical: z.any(),
    accepted_alternatives: z.array(z.any()).default([]),
    per_item: z.array(z.any()).optional(),
  }),
  distractors: z.array(z.any()).default([]),
  hints: z.array(z.string()).default([]),
  feedback: z.object({
    correct: z.string(),
    incorrect: z.string(),
  }),
  srs_tags: z.array(z.string()).default([]),
  kb_version: z.string(),
});

export type ExerciseInstance = z.infer<typeof ExerciseInstanceSchema>;
