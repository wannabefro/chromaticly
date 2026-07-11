/** Slim segmented progress bar — one segment per item in the set ("one question, one screen").
 * Current segment is an outlined hollow pill; correct/incorrect recolour past segments.
 */
export interface ProgressSegmentsProps {
  states: Array<'done' | 'current' | 'todo' | 'correct' | 'incorrect'>;
  strand?: 'rhythm' | 'pitch' | 'scales' | 'intervals' | 'chords' | 'terms' | 'context';
  /** 'exam' renders the muted section-navigator variant */
  register?: 'app' | 'exam';
}
export declare function ProgressSegments(props: ProgressSegmentsProps): JSX.Element;
