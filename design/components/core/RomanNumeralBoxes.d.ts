/** Roman-numeral chips for primary-triad recognition (I/IV/V) and cadence boxes (5g).
 * Numerals set in Source Serif; ALWAYS paired with letter-name labels beneath —
 * colour never carries meaning alone.
 * @startingPoint section="Core" subtitle="I / IV / V triad chips with states" viewport="360x110"
 */
export interface RomanNumeralBoxesProps {
  /** e.g. ['I','IV','V'] or ['I','II','IV','V'] for cadence pickers */
  numerals: string[];
  /** Letter-name labels beneath each numeral, e.g. ['C','F','G'] (required in a stated key) */
  labels?: string[];
  /** Per-chip state; defaults to 'default' */
  states?: Array<'default' | 'selected' | 'correct' | 'incorrect' | 'disabled'>;
  /** Per-chip meta overriding labels post-Check, e.g. ['✓ C–E–G','× your pick',''] */
  metas?: string[];
  onPick?: (index: number) => void;
}
export declare function RomanNumeralBoxes(props: RomanNumeralBoxesProps): JSX.Element;
