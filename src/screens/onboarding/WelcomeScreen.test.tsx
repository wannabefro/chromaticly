// U9 acceptance test for Welcome (6a): guest is the ONLY path (R1). Nothing in
// the app syncs, so no screen may offer sign-in.

import { fireEvent, render, screen } from '@testing-library/react-native';

import { AbcPlayerContext } from '../../music-surface/abc-player';
import { WelcomeScreen } from './WelcomeScreen';

describe('WelcomeScreen — guest is the only path; the app promises no sync (R1)', () => {
  test('renders the welcome screen, the design tagline, and fires onStart from "Start learning"', () => {
    const onStart = jest.fn();
    const { getByTestId, getByText } = render(<WelcomeScreen onStart={onStart} />);

    expect(getByTestId('welcome-screen')).toBeTruthy();
    // Design step-1 copy (source of truth) — the "Grades 1–5, free." promise.
    expect(getByText('Music theory that you can hear. Grades 1–5, free.')).toBeTruthy();
    fireEvent.press(getByTestId('start-learning'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  // These shipped disabled and labelled "coming soon". Nothing syncs, so they
  // advertised a capability that does not exist. Removed 2026-08-06.
  test('offers no sign-in affordance and makes no sync promise', () => {
    render(<WelcomeScreen onStart={jest.fn()} />);

    for (const testID of ['signin-apple', 'signin-google', 'signin-email']) {
      expect(screen.queryByTestId(testID)).toBeNull();
    }
    expect(screen.queryByText(/sync|sign in/i)).toBeNull();
  });
});

describe('WelcomeScreen — the tagline is demonstrated, not just claimed', () => {
  test('tapping the mark sounds an arpeggio through the shared surface', () => {
    const playAbc = jest.fn();
    const { getByTestId } = render(
      <AbcPlayerContext.Provider value={playAbc}>
        <WelcomeScreen onStart={jest.fn()} />
      </AbcPlayerContext.Provider>,
    );

    fireEvent.press(getByTestId('brand-play'));
    expect(playAbc).toHaveBeenCalledTimes(1);
    expect(playAbc.mock.calls[0][0]).toContain('K:C');
  });

  // The promise is audio, so the affordance must be visible, not a secret.
  test('the mark carries a visible play affordance and says so', () => {
    const { getByTestId, getByText } = render(<WelcomeScreen onStart={jest.fn()} />);

    expect(getByTestId('brand-play-glyph')).toBeTruthy();
    expect(getByText('tap to hear it')).toBeTruthy();
  });

  // No provider means no surface. Silence, never a crash.
  test('with no shared surface mounted the tap is silent, not a crash', () => {
    const { getByTestId } = render(<WelcomeScreen onStart={jest.fn()} />);

    expect(() => fireEvent.press(getByTestId('brand-play'))).not.toThrow();
  });
});
