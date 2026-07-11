import React from 'react';

const STRANDS = {
  rhythm: '#f0666f', pitch: '#f0a94f', scales: '#57cf87', intervals: '#2fbfae',
  chords: '#46b0e6', terms: '#8b8ef2', context: '#cb7ad4',
};

/** Slim per-question progress segments. states[i]: 'done' | 'current' | 'todo' | 'correct' | 'incorrect' */
export function ProgressSegments({ states, strand = 'pitch', register = 'app' }) {
  const hue = STRANDS[strand];
  const isExam = register === 'exam';
  const color = (s) => {
    if (isExam) return { done: 'var(--exam-band-pass)', current: 'var(--exam-ink)', todo: 'var(--exam-border-strong)', correct: '#57cf87', incorrect: '#e0575e' }[s];
    return {
      done: hue, current: 'var(--border-strong)', todo: 'var(--border-strong)',
      correct: 'var(--correct)', incorrect: 'var(--incorrect)',
    }[s];
  };
  return (
    <div style={{ display: 'flex', gap: 4, flex: 1 }}>
      {states.map((s, i) => (
        <span key={i} style={{
          flex: s === 'current' && isExam ? 1.4 : 1, height: 6, borderRadius: 'var(--radius-chip)',
          background: s === 'current' && !isExam ? 'transparent' : color(s),
          boxShadow: s === 'current' && !isExam ? `inset 0 0 0 1.5px ${hue}` : 'none',
        }} />
      ))}
    </div>
  );
}
