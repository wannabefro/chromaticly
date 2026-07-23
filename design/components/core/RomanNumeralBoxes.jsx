import React from 'react';

/** Primary-triad / cadence numeral chips. states[i] mirrors AnswerOption states. */
export function RomanNumeralBoxes({ numerals, labels = [], states = [], metas = [], onPick }) {
  const conf = (s) => ({
    default:   { bg: 'var(--surface-card)', border: '1.5px solid var(--border-strong)', color: 'var(--text)', labelColor: 'var(--text-faint)', opacity: 1 },
    selected:  { bg: 'color-mix(in srgb, #46b0e6 14%, transparent)', border: '1.5px solid var(--strand-chords)', color: '#bfe2f5', labelColor: '#8ecdf0', opacity: 1 },
    correct:   { bg: 'color-mix(in srgb, #57cf87 12%, transparent)', border: '1.5px solid var(--correct)', color: '#c9f2d9', labelColor: '#8ce0af', opacity: 1 },
    incorrect: { bg: 'color-mix(in srgb, #f0666f 12%, transparent)', border: '1.5px solid var(--incorrect)', color: '#f6cdcf', labelColor: '#f0949b', opacity: 1 },
    disabled:  { bg: 'var(--surface-card-sunken)', border: '1.5px solid var(--border-strong)', color: 'var(--text-muted)', labelColor: 'var(--text-ghost)', opacity: 0.55 },
  }[s || 'default']);
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {numerals.map((n, i) => {
        const c = conf(states[i]);
        return (
          <div key={i} onClick={() => onPick && onPick(i)} style={{
            flex: 1, minHeight: 'var(--tap-min)', padding: '14px 0 11px', borderRadius: 'var(--radius-control)',
            background: c.bg, border: c.border, opacity: c.opacity, cursor: states[i] === 'disabled' ? 'default' : 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span style={{ fontFamily: 'var(--font-exam)', fontWeight: 700, fontSize: 22, color: c.color }}>{n}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: c.labelColor }}>{metas[i] || labels[i] || ''}</span>
          </div>
        );
      })}
    </div>
  );
}
