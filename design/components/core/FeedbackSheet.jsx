import React from 'react';
import { Button } from './Button.jsx';

/** Full-bleed feedback bottom sheet — a designed component, never a toast. */
export function FeedbackSheet({ kind = 'correct', title, message, whyText, correctAnswer, onContinue }) {
  const isCorrect = kind === 'correct';
  const hue = isCorrect ? 'var(--correct)' : 'var(--incorrect)';
  const bg = isCorrect ? 'var(--correct-surface)' : 'var(--incorrect-surface)';
  const headColor = isCorrect ? '#8ce0af' : '#f0a94f';
  return (
    <div style={{
      background: bg, borderTop: `2px solid ${hue}`, borderRadius: '24px 24px 0 0',
      padding: '20px 22px 30px', display: 'flex', flexDirection: 'column', gap: 13,
      boxShadow: 'var(--shadow-sheet)', fontFamily: 'var(--font-ui)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: '50%', background: hue,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isCorrect ? 'var(--correct-deep)' : 'var(--incorrect-deep)', fontWeight: 800, fontSize: 15,
        }}>{isCorrect ? '✓' : '!'}</span>
        <span style={{ fontSize: 19, fontWeight: 800, color: headColor }}>{title || (isCorrect ? 'Correct!' : 'Not quite')}</span>
        <span title="Report this exercise" style={{ marginLeft: 'auto', fontSize: 16, opacity: 0.45, cursor: 'pointer' }}>⚑</span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: isCorrect ? '#bcd8c6' : '#e2c9cb' }}>{message}</div>
      {whyText && (
        <details style={{ fontSize: 13, color: headColor }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', fontFamily: 'var(--font-mono)', fontSize: 12 }}>▸ why this works</summary>
          <div style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.5 }}>{whyText}</div>
        </details>
      )}
      {correctAnswer /* NotationCard rendering the right answer, with play — required on incorrect */}
      <Button label={isCorrect ? 'Continue' : 'Got it'} onClick={onContinue} />
    </div>
  );
}
