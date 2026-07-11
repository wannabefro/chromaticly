// The 7 strands: hue (dark register), colour-vision-safe glyph, and label.
// Mirrors design/README.md's strand glyph pairings and design/tokens/colors.css.
// Never-violate rule 3: strand colour is ALWAYS paired with a glyph or label.

export type Strand =
  | 'rhythm'
  | 'pitch'
  | 'scales_keys'
  | 'intervals'
  | 'chords'
  | 'terms_signs'
  | 'context';

export interface StrandDef {
  hue: string;
  glyph: string;
  label: string;
}

export const STRAND_DEFS: Record<Strand, StrandDef> = {
  rhythm: { hue: '#f0666f', glyph: '𝅘𝅥', label: 'Rhythm' },
  pitch: { hue: '#f0a94f', glyph: '𝄞', label: 'Pitch & Notation' },
  scales_keys: { hue: '#57cf87', glyph: '♯', label: 'Scales & Keys' },
  intervals: { hue: '#2fbfae', glyph: '⟷', label: 'Intervals' },
  chords: { hue: '#46b0e6', glyph: '≡', label: 'Chords' },
  terms_signs: { hue: '#8b8ef2', glyph: '𝆑', label: 'Terms & Signs' },
  context: { hue: '#cb7ad4', glyph: '𝄚', label: 'Music in Context' },
};

/** App-level accent when no single strand is in focus (context violet, per colors.css). */
export const ACCENT = STRAND_DEFS.context.hue;

export function strandDef(strand: Strand): StrandDef {
  return STRAND_DEFS[strand];
}
