// 302.3.5 by-ear card: tapping the strong beats. The point of the card is that
// the answer is heard, not seen — so the beats must not advertise which of them
// are strong before they're found, and finding them all must confirm the rule.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { fireEvent, render } from '@testing-library/react-native';

import type { TeachRhythm } from '../content/teach-rhythm';
import { TheoryInSound } from './TheoryInSound';

// Two bars of 3/4 — strong beats are grid indices 0 and 3.
const rhythm: TeachRhythm = {
  timeSignature: '3/4',
  notes: ['crotchet', 'quaver', 'quaver', 'crotchet', 'minim', 'crotchet'],
};

function renderCard() {
  return render(<TheoryInSound prompt="Tap the strong beats." rhythm={rhythm} strand="rhythm" />);
}

describe('TheoryInSound — tap the strong beats you hear (302.3.5)', () => {
  test('renders a play affordance and one tappable cell per beat', () => {
    const { getByTestId } = renderCard();
    expect(getByTestId('theory-in-sound')).toBeTruthy();
    expect(getByTestId('theory-play')).toBeTruthy();
    for (let i = 0; i < 6; i++) expect(getByTestId(`theory-beat-${i}`)).toBeTruthy();
  });

  test('no beat is marked strong before it is found — the answer is heard, not seen', () => {
    const { queryByTestId } = renderCard();
    expect(queryByTestId('theory-beat-0-strong')).toBeNull();
    expect(queryByTestId('theory-beat-3-strong')).toBeNull();
    expect(queryByTestId('theory-feedback')).toBeNull();
  });

  test('finding every downbeat confirms the rule', () => {
    const { getByTestId, queryByTestId } = renderCard();
    fireEvent.press(getByTestId('theory-beat-0'));
    expect(queryByTestId('theory-feedback')).toBeNull(); // one of two — not done yet

    fireEvent.press(getByTestId('theory-beat-3'));
    expect(getByTestId('theory-beat-0-strong')).toBeTruthy();
    expect(getByTestId('theory-beat-3-strong')).toBeTruthy();
    expect(getByTestId('theory-feedback').props.children).toContain('first beat of every bar');
  });

  test('tapping a weak beat is corrected warmly, never marked strong', () => {
    const { getByTestId, queryByTestId } = renderCard();
    fireEvent.press(getByTestId('theory-beat-1')); // beat 2 of bar 1

    expect(queryByTestId('theory-beat-1-strong')).toBeNull();
    const feedback = getByTestId('theory-feedback').props.children as string;
    expect(feedback).toContain('Not quite');
    expect(feedback).not.toMatch(/wrong/i);
  });
});
