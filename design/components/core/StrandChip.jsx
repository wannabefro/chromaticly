import React from 'react';

const STRANDS = {
  rhythm: { hue: '#f0666f', glyph: '𝅘𝅥', label: 'Rhythm & Metre' },
  pitch: { hue: '#f0a94f', glyph: '𝄞', label: 'Pitch & Notation' },
  scales: { hue: '#57cf87', glyph: '♯', label: 'Scales & Keys' },
  intervals: { hue: '#2fbfae', glyph: '⟷', label: 'Intervals' },
  chords: { hue: '#46b0e6', glyph: '≡', label: 'Chords & Harmony' },
  terms: { hue: '#8b8ef2', glyph: '𝆑', label: 'Terms & Signs' },
  context: { hue: '#cb7ad4', glyph: '𝄚', label: 'Music in Context' },
};

export function StrandChip({ strand = 'pitch', label, overline = true, showGlyph = false }) {
  const s = STRANDS[strand];
  const text = label || s.label;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-swatch)', background: s.hue, flex: '0 0 auto' }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        letterSpacing: overline ? 'var(--tracking-overline)' : 0,
        textTransform: overline ? 'uppercase' : 'none',
        color: `color-mix(in srgb, ${s.hue} 65%, var(--text))`,
      }}>{text}</span>
      {showGlyph && <span style={{ fontFamily: 'var(--font-music)', fontSize: 13, color: s.hue }}>{s.glyph}</span>}
    </span>
  );
}

export const STRAND_DEFS = STRANDS;
