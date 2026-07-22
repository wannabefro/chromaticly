/** Inline audio play affordance — solid triangle in a circle. Used on every notation display,
 * in lessons, flashcards and feedback panels. Min visual size 26px; keep tap target ≥44px via padding.
 */
export interface PlayButtonProps {
  size?: number;
  /** Tint with a strand hue; omit for neutral */
  strand?: 'rhythm' | 'pitch' | 'scales' | 'intervals' | 'chords' | 'terms' | 'context';
  /** true when sitting on the light paper card (solid dark fill + shadow) */
  onPaper?: boolean;
  /** Dimmed + non-interactive when there is nothing to play yet (e.g. the
   *  transposition answer card's "hear yours" until ≥1 note is placed). */
  disabled?: boolean;
  onClick?: () => void;
}
export declare function PlayButton(props: PlayButtonProps): JSX.Element;
