/** Strand identifier: colour square + mono overline label (+ optional glyph for colour-vision-safe mode).
 * Colour must never appear without its label or glyph.
 */
export interface StrandChipProps {
  strand: 'rhythm' | 'pitch' | 'scales' | 'intervals' | 'chords' | 'terms' | 'context';
  /** Override the default strand name */
  label?: string;
  /** Uppercase + tracked mono (default). false = plain mono */
  overline?: boolean;
  /** Append the strand glyph (colour-vision-safe pairing) */
  showGlyph?: boolean;
}
export declare function StrandChip(props: StrandChipProps): JSX.Element;
