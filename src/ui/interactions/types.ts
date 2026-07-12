// The interaction protocol (U3/AD1): every interaction type — mcq/text_input now,
// true_false/flashcard/stave_input/tap_placement later — implements this contract
// so the registry (registry.ts) can dispatch on interaction.type instead of a
// hardcoded isMcq boolean. Response is generic because each interaction owns a
// different shape (a selected index, raw text, a per-bar boolean[], a self-grade
// enum, a {pitch,position,duration}) — the loop never assumes one.
//
// Member functions are declared with method syntax (not `field: (..) => T`) so
// TS checks their parameters bivariantly; that's what lets INTERACTIONS hold
// specs with different concrete Response types under one Partial<Record<...>>
// without `any` casts.

import type { ReactNode } from 'react';

import type { ExerciseInstance } from '../../engine/schema';
import type { Strand } from '../theme';

export interface InteractionComponentProps<Response> {
  instance: ExerciseInstance;
  response: Response;
  graded: boolean | null;
  strand: Strand;
  onResponseChange: (response: Response) => void;
}

export interface InteractionSpec<Response = unknown> {
  /** Renders the interaction's input UI. Owns its own response shape. */
  Component(props: InteractionComponentProps<Response>): ReactNode;
  /** The reset/initial value — drives per-item remount without tearing down the
   *  persistent NotationCard surface (ExerciseLoop's instance-change reset). */
  emptyResponse(instance: ExerciseInstance): Response;
  /** Whether the shared "Check" button should be enabled. */
  canCheck(response: Response): boolean;
  /** `null` means self-graded (no correct/incorrect verdict — e.g. the future
   *  flashcard) and routes to a different path than the shared correct/incorrect
   *  FeedbackSheet; a boolean is the verdict for a checked interaction. */
  grade(instance: ExerciseInstance, response: Response): boolean | null;
  /** `true` — uses the shared Check button. `false` — the interaction owns its
   *  own submission affordance (e.g. flashcard's self-grade buttons) and the
   *  shared Check button is hidden. */
  submits: boolean;
  /** The FeedbackSheet's correct-answer render for an incorrect attempt. */
  correctAnswerView(instance: ExerciseInstance): ReactNode;
}
