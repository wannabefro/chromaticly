/** Primary action button. Full-width footer CTA; hue follows the current strand.
 * @startingPoint section="Core" subtitle="Footer CTA in strand hue" viewport="360x120"
 */
export interface ButtonProps {
  label: string;
  /** 'primary' filled | 'secondary' text-only | 'exam' serif assessment register */
  variant?: 'primary' | 'secondary' | 'exam';
  /** rhythm | pitch | scales | intervals | chords | terms | context. Omit = neutral white. */
  strand?: 'rhythm' | 'pitch' | 'scales' | 'intervals' | 'chords' | 'terms' | 'context';
  disabled?: boolean;
  onClick?: () => void;
}
export declare function Button(props: ButtonProps): JSX.Element;
