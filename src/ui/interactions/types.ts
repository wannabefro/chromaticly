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
import type { SrsGrade } from '../../learn/srs';
import type { Music } from '../../music/types';
import type { BarlineMarks } from '../../music-surface/bridge';
import type { Strand } from '../theme';

export interface InteractionComponentProps<Response> {
  instance: ExerciseInstance;
  response: Response;
  graded: boolean | null;
  strand: Strand;
  onResponseChange: (response: Response) => void;
  /** Self-graded interactions (flashcard) call this directly with the picked
   *  grade instead of relying on `grade()`'s boolean verdict — the shared Check
   *  button and FeedbackSheet never fire for these (U7), so this is the only
   *  way a self-graded interaction reports its outcome upward. Unused by
   *  checked interactions (mcq/text_input/true_false). */
  onSelfGrade?: (grade: SrsGrade) => void;
  /** Plays a Music the interaction builds itself (e.g. transposition_input's
   *  answer-so-far), against the persistent stimulus surface — the "hear yours"
   *  affordance (D9). Lands here so the protocol changes once; ExerciseLoop
   *  only wires a real implementation from U7 onward, so this stays undefined
   *  (and unused) until then. */
  onPlayMusic?: (music: Music) => void;
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
  /** Pins the input to the sticky footer instead of the scrolling body. A tall
   *  stimulus otherwise pushes it off-screen with nothing saying so: the
   *  three-system context passage did exactly that (chromaticly-sr6). */
  stickyInput?: boolean;
  /** `true` — uses the shared Check button. `false` — the interaction owns its
   *  own submission affordance (e.g. flashcard's self-grade buttons) and the
   *  shared Check button is hidden. */
  submits: boolean;
  /** The FeedbackSheet's correct-answer render for an incorrect attempt. `response`
   *  is optional (bivariant method-syntax keeps existing one-arg implementations
   *  assignable, D5) — only per-item-graded interactions (transposition_input)
   *  need it; the rest ignore the second argument entirely. */
  correctAnswerView(instance: ExerciseInstance, response?: Response): ReactNode;
  /** Optional score-tap protocol (design 4c). An interaction whose answer is a
   *  position in the notation (find-the-bar) implements these so the loop can wire
   *  the persistent NotationCard both ways without knowing the interaction type:
   *  a tap in the score updates the response, and the response tints a bar. */
  onSurfaceTap?(bar: number, response: Response): Response;
  /** Which bar (1-indexed) the current response should tint in the score, or null. */
  surfaceHighlight?(response: Response): number | null;
  /** tap_placement: a position BETWEEN two notes, which no bar index addresses. */
  usesSurfaceGaps?: boolean;
  onSurfaceGapTap?(gap: number, response: Response): Response;
  surfaceBarlines?(
    instance: ExerciseInstance,
    response: Response,
    graded: boolean | null,
  ): { gaps: number[]; marks: BarlineMarks };
  /** Per-item feedback summary (D5): non-null only when some but not all items are
   *  correct — drives the amber `partial` FeedbackSheet instead of the plain
   *  incorrect one. All-right and all-wrong both return null (those route to the
   *  existing correct/incorrect sheets, unchanged). */
  partialFeedback?(
    instance: ExerciseInstance,
    response: Response,
  ): { correct: number; total: number; message: string; fixLabel: string } | null;
  /** Overrides the shared Check button's label (e.g. "Check — 2 notes left").
   *  Falls back to "Check" when absent. */
  checkLabel?(instance: ExerciseInstance, response: Response): string;
  /** The ANSWER VALUE the response stands for, when the response is not itself
   *  the answer — mcq's response is an option index, not the picked note name.
   *  Only `feedback.by_distractor` consumes it (chromaticly-7tb), to name which
   *  mistake was made.
   *
   *  This must not be inferred at the call site. An mcq index and an
   *  interval_naming answer are both numbers, so passing a raw index into the
   *  lookup would let index 2 read the copy written for "a 2nd" — right shape,
   *  wrong meaning, and nothing would fail. Absent means the response IS the
   *  answer (text_input) or there is no single answer to diagnose (true_false,
   *  transposition_input). */
  selectedValue?(instance: ExerciseInstance, response: Response): unknown;
  /** Re-entry into fix mode (D6): "Fix note k" clears the wrong item(s) back to
   *  unanswered and locks the right ones, returning the new response. The loop
   *  resets `graded` to null after calling this but never launders the verdict —
   *  see `everFailed` at the call site. */
  beginFix?(instance: ExerciseInstance, response: Response): Response;
}
