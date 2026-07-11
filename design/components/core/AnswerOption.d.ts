/** MCQ answer card with all exercise states. Options may contain rendered notation (pass children).
 * @startingPoint section="Core" subtitle="Answer card — default/selected/correct/incorrect" viewport="360x260"
 */
export interface AnswerOptionProps {
  /** A/B/C/D badge letter (replaced by ✓/× in feedback states) */
  letter: string;
  /** Text answer. Use children instead for notation answers (mini-stave). */
  label?: string;
  state?: 'default' | 'selected' | 'correct' | 'incorrect' | 'disabled';
  /** Hue used for the selected state */
  strand?: 'rhythm' | 'pitch' | 'scales' | 'intervals' | 'chords' | 'terms' | 'context';
  /** Right-aligned mono annotation, e.g. "your pick" / "correct" */
  meta?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}
export declare function AnswerOption(props: AnswerOptionProps): JSX.Element;
