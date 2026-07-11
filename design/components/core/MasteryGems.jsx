import React from 'react';

/** Diamond gems, one per item: 'clean' | 'hinted' | 'missed' */
export function MasteryGems({ items, hue = '#2fbfae', size = 22 }) {
  const conf = (s) => ({
    clean: { background: hue, border: 'none' },
    hinted: { background: `color-mix(in srgb, ${hue} 25%, var(--surface))`, border: `1.5px solid ${hue}` },
    missed: { background: 'color-mix(in srgb, #f0666f 18%, var(--surface))', border: '1.5px solid var(--incorrect)' },
  }[s]);
  return (
    <div style={{ display: 'flex', gap: Math.round(size * 0.4) }}>
      {items.map((s, i) => (
        <span key={i} title={s} style={{
          width: size, height: size, transform: 'rotate(45deg)',
          borderRadius: Math.round(size * 0.22), boxSizing: 'border-box', ...conf(s),
        }} />
      ))}
    </div>
  );
}
