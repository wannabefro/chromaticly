import React from 'react';

const STRANDS = {
  rhythm: '#f0666f', pitch: '#f0a94f', scales: '#57cf87', intervals: '#2fbfae',
  chords: '#46b0e6', terms: '#8b8ef2', context: '#cb7ad4',
};

export function AnswerOption({ letter, label, state = 'default', strand = 'pitch', meta, children, onClick }) {
  const hue = STRANDS[strand];
  const conf = {
    default:   { border: '1.5px solid var(--border-strong)', bg: 'var(--surface-card)', badgeBg: 'transparent', badgeBorder: '1.5px solid #3a4150', badgeColor: 'var(--text-muted)', color: 'var(--text)' },
    selected:  { border: `1.5px solid ${hue}`, bg: `color-mix(in srgb, ${hue} 12%, transparent)`, badgeBg: hue, badgeBorder: 'none', badgeColor: 'rgba(0,0,0,0.8)', color: 'var(--text)' },
    correct:   { border: '1.5px solid var(--correct)', bg: 'color-mix(in srgb, #57cf87 12%, transparent)', badgeBg: 'var(--correct)', badgeBorder: 'none', badgeColor: 'var(--correct-deep)', color: '#c9f2d9' },
    incorrect: { border: '1.5px solid var(--incorrect)', bg: 'color-mix(in srgb, #f0666f 12%, transparent)', badgeBg: 'var(--incorrect)', badgeBorder: 'none', badgeColor: 'var(--incorrect-deep)', color: '#f6cdcf' },
    disabled:  { border: '1.5px solid var(--border)', bg: 'var(--surface-card-sunken)', badgeBg: 'transparent', badgeBorder: '1.5px solid var(--border-strong)', badgeColor: 'var(--text-ghost)', color: 'var(--text-faint)' },
  }[state];
  const badgeText = state === 'correct' ? '✓' : state === 'incorrect' ? '×' : letter;
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '15px 16px', minHeight: 'var(--tap-min)',
      background: conf.bg, border: conf.border, borderRadius: 'var(--radius-button)',
      cursor: state === 'disabled' ? 'default' : 'pointer', fontFamily: 'var(--font-ui)',
      opacity: state === 'disabled' ? 0.7 : 1,
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: '50%', flex: '0 0 auto',
        background: conf.badgeBg, border: conf.badgeBorder, color: conf.badgeColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
      }}>{badgeText}</span>
      {children || <span style={{ fontSize: 16, fontWeight: state === 'default' ? 600 : 700, color: conf.color }}>{label}</span>}
      {meta && <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: conf.color, opacity: 0.8 }}>{meta}</span>}
    </div>
  );
}
