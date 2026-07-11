/** Feedback bottom sheet ("wrong answers teach"). Correct: reinforcement + optional why-expander.
 * Incorrect: message MUST name the misconception; pass the rendered correct answer (NotationCard with play).
 * Always includes the ⚑ report affordance. Content behind dims to 0.55 while shown.
 */
export interface FeedbackSheetProps {
  kind: 'correct' | 'incorrect';
  /** Defaults: "Correct!" / "Not quite" */
  title?: string;
  /** Correct: brief reinforcement. Incorrect: names the misconception. */
  message: React.ReactNode;
  /** Optional "why this works" expander (correct) */
  whyText?: React.ReactNode;
  /** Incorrect only: rendered correct answer — a NotationCard with play */
  correctAnswer?: React.ReactNode;
  onContinue?: () => void;
}
export declare function FeedbackSheet(props: FeedbackSheetProps): JSX.Element;
