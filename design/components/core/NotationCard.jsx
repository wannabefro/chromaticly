import React from 'react';
import { PlayButton } from './PlayButton.jsx';

/** Placeholder contract for the real abcjs/VexFlow renderer.
    Draws staff lines + clef; real renderer draws into the same box. */
export function NotationCard({ height = 94, clef = '𝄞', caption, play = true, register = 'app', zoomHint = false, children }) {
  const isExam = register === 'exam';
  return (
    <div style={{
      position: 'relative', background: isExam ? 'var(--exam-card)' : 'var(--paper)',
      border: isExam ? '1px solid var(--exam-border)' : 'none',
      borderRadius: 'var(--radius-paper)', padding: '16px 14px 12px',
      boxShadow: isExam ? 'none' : 'var(--shadow-paper)',
    }}>
      <svg width="100%" height={height} viewBox={`0 0 300 ${height}`} preserveAspectRatio="xMidYMid meet">
        {[0, 1, 2, 3, 4].map(i => (
          <line key={i} x1="20" x2="280"
            y1={height - 70 + i * 16} y2={height - 70 + i * 16}
            stroke="var(--paper-line)" strokeWidth="1.4" />
        ))}
        <text x="26" y={height - 12} fontFamily="var(--font-music)" fontSize={height * 0.7} fill="var(--paper-ink)">{clef}</text>
        {children /* real renderer / notes overlay here */}
      </svg>
      <div style={{ position: 'absolute', right: 12, bottom: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
        {zoomHint && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--paper-muted)' }}>pinch to zoom</span>}
        {caption && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--paper-muted)' }}>{caption}</span>}
        {play && <PlayButton onPaper />}
      </div>
    </div>
  );
}
