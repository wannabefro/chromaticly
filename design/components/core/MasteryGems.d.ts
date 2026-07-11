/** Per-item mastery gems on the set-complete screen. Filled = clean solve,
 * outlined = hint used (dimmed gem), red outline = missed.
 */
export interface MasteryGemsProps {
  items: Array<'clean' | 'hinted' | 'missed'>;
  /** Gem hue — usually the strand hue */
  hue?: string;
  size?: number;
}
export declare function MasteryGems(props: MasteryGemsProps): JSX.Element;
