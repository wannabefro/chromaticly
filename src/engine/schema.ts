// Zod schema + inferred type for an exercise instance (curriculum/exercise-templates.json's
// exercise_instance_schema), plus kb_version (KTD4: reproducibility across content updates —
// not in the JSON schema doc, added per the plan).

import { z } from 'zod';

/** The `interaction.type` enum, extracted so the U3 interaction registry can key
 *  off a named `InteractionType` instead of re-deriving it from the schema. */
export const InteractionTypeSchema = z.enum([
  'mcq',
  'multi_select',
  'true_false',
  'text_input',
  'stave_input',
  'tap_placement',
  'drag_match',
  'grid_fill',
  'roman_numeral_boxes',
  'flashcard',
  'find_the_bar',
  'transposition_input',
  'note_value_palette',
  'voice_options',
  'by_ear_match',
  'by_ear_verify',
  'aural_mcq',
  'keyboard_tap',
]);

export type InteractionType = z.infer<typeof InteractionTypeSchema>;

/** Interaction types the LEARNER marks, not the app. A self-graded item cannot
 *  measure anything, so placement (G6 U10) must never serve one — but
 *  `src/learn/placement.ts` sits in the portable core and cannot import the
 *  interaction registry to ask. The signal therefore lives here, beside the enum
 *  it partitions, and is read off a generated instance's `interaction.type`.
 *
 *  `flashcard` is the only member: the learner says whether they knew it, and a
 *  placement built on that would measure confidence. Adding a self-graded
 *  interaction WITHOUT adding it here is the failure mode this set exists to
 *  make visible. */
export const SELF_GRADED_INTERACTIONS: ReadonlySet<InteractionType> = new Set<InteractionType>(['flashcard']);

export const ExerciseInstanceSchema = z.object({
  id: z.string(),
  template_id: z.string(),
  // 0 is First steps (chromaticly-dhe), the starter level below Grade 1.
  grade: z.number().int().min(0).max(5),
  strand: z.enum(['rhythm', 'pitch', 'scales_keys', 'intervals', 'chords', 'terms_signs', 'context']),
  unit: z.string().optional(),
  prompt: z.string(),
  stimulus: z.object({
    music: z.any().nullable(),
    text: z.string().nullable(),
  }),
  interaction: z.object({
    type: InteractionTypeSchema,
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
    /** Per-distractor misconception copy (never-violate rule 5: feedback names
     *  the mistake that was actually made). Keyed by the same option key
     *  `option_music`/`option_sign` use — the distractor's string form. A
     *  generator that builds its distractors deliberately (note_naming's
     *  clef-confusion vs off-by-one, interval_naming's counted-the-gaps) names
     *  each one here; `incorrect` stays as the fallback for every template that
     *  does not, and for a wrong answer typed rather than picked. */
    by_distractor: z.record(z.string(), z.string()).optional(),
  }),
  srs_tags: z.array(z.string()).default([]),
  kb_version: z.string(),
});

export type ExerciseInstance = z.infer<typeof ExerciseInstanceSchema>;
