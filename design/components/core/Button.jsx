import React from 'react';

const STRANDS = {
  rhythm: 'var(--strand-rhythm)', pitch: 'var(--strand-pitch)', scales: 'var(--strand-scales)',
  intervals: 'var(--strand-intervals)', chords: 'var(--strand-chords)', terms: 'var(--strand-terms)',
  context: 'var(--strand-context)',
};

export function Button({ label, variant = 'primary', strand, disabled = false, onClick }) {
  const hue = strand ? STRANDS[strand] : 'var(--text)';
  const styles = {
    primary: { background: hue, color: strand ? 'rgba(0,0,0,0.82)' : 'var(--bg)' },
    secondary: { background: 'transparent', color: 'var(--text-muted)' },
    exam: { background: 'var(--exam-ink)', color: 'var(--exam-bg)', fontFamily: 'var(--font-exam)' },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      all: 'unset', boxSizing: 'border-box', cursor: disabled ? 'default' : 'pointer',
      width: '100%', textAlign: 'center', fontFamily: 'var(--font-ui)', fontWeight: 700,
      fontSize: 16, padding: 15, borderRadius: 'var(--radius-button)',
      opacity: disabled ? 0.4 : 1, ...styles,
    }}>{label}</button>
  );
}
