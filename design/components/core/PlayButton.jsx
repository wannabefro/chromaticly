import React from 'react';

const STRANDS = {
  rhythm: '#f0666f', pitch: '#f0a94f', scales: '#57cf87', intervals: '#2fbfae',
  chords: '#46b0e6', terms: '#8b8ef2', context: '#cb7ad4',
};

export function PlayButton({ size = 34, strand, onPaper = false, onClick }) {
  const hue = strand ? STRANDS[strand] : null;
  const bg = onPaper ? (hue || 'var(--paper-ink)') : (hue ? `color-mix(in srgb, ${hue} 14%, transparent)` : 'rgba(255,255,255,0.1)');
  const border = !onPaper && hue ? `1.5px solid ${hue}` : 'none';
  const tri = onPaper ? 'var(--paper)' : (hue || 'var(--text)');
  const s = size, t = Math.round(size * 0.32);
  return (
    <button onClick={onClick} aria-label="Play audio" style={{
      all: 'unset', cursor: 'pointer', width: s, height: s, borderRadius: '50%',
      background: bg, border, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: onPaper ? '0 2px 6px rgba(0,0,0,0.22)' : 'none', flex: '0 0 auto',
    }}>
      <svg width={t} height={t * 1.1} viewBox="0 0 10 11"><polygon points="0,0 10,5.5 0,11" fill={tri} /></svg>
    </button>
  );
}
