/** Notation display block — the placeholder contract the real abcjs/VexFlow renderer draws into.
 * ALWAYS light paper, even in dark mode. Never crop a stave.
 * @startingPoint section="Core" subtitle="Paper notation block with play affordance" viewport="360x160"
 */
export interface NotationCardProps {
  /** SVG viewBox height; min comfortable = one 4-bar single-stave line at 360pt */
  height?: number;
  /** Clef glyph (Noto Music): 𝄞 treble, 𝄢 bass, 𝄡 alto/tenor */
  clef?: string;
  /** Small mono caption bottom-right, e.g. "minim" */
  caption?: string;
  /** Every notation display has a play affordance — only disable inside answer options */
  play?: boolean;
  /** 'app' = shadowed paper on dark; 'exam' = flat bordered exam card */
  register?: 'app' | 'exam';
  zoomHint?: boolean;
  /** SVG children rendered over the staff (notes, highlights, ghost slots) */
  children?: React.ReactNode;
}
export declare function NotationCard(props: NotationCardProps): JSX.Element;
