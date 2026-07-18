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
  /** Compact label for tight spots like the radar legend (design 6d). */
  short: string;
}

export const STRAND_DEFS: Record<Strand, StrandDef> = {
  rhythm: { hue: '#f0666f', glyph: '𝅘𝅥', label: 'Rhythm', short: 'Rhythm' },
  pitch: { hue: '#f0a94f', glyph: '𝄞', label: 'Pitch & Notation', short: 'Pitch' },
  scales_keys: { hue: '#57cf87', glyph: '♯', label: 'Scales & Keys', short: 'Scales' },
  intervals: { hue: '#2fbfae', glyph: '⟷', label: 'Intervals', short: 'Intervals' },
  chords: { hue: '#46b0e6', glyph: '≡', label: 'Chords', short: 'Chords' },
  terms_signs: { hue: '#8b8ef2', glyph: '𝆑', label: 'Terms & Signs', short: 'Terms' },
  context: { hue: '#cb7ad4', glyph: '𝄚', label: 'Music in Context', short: 'Context' },
};

/** Canonical strand order — the radar's vertices and legend follow this (rhythm at
 *  top, clockwise), matching design 6d. */
export const STRAND_ORDER: Strand[] = [
  'rhythm',
  'pitch',
  'scales_keys',
  'intervals',
  'chords',
  'terms_signs',
  'context',
];

/** App-level accent when no single strand is in focus (context violet, per colors.css). */
export const ACCENT = STRAND_DEFS.context.hue;

export function strandDef(strand: Strand): StrandDef {
  return STRAND_DEFS[strand];
}
