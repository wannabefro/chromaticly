// 302.3.5 by-ear card: tapping the strong beats. The point of the card is that
// the answer is heard, not seen — so the beats must not advertise which of them
// are strong before they're found, and finding them all must confirm the rule.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

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

/** The card is by ear: nothing can be answered until it has been heard (8c state 1). */
function playFirst(getByTestId: (id: string) => any) {
  fireEvent.press(getByTestId('theory-play'));
}

describe('TheoryInSound — tap the strong beats you hear (302.3.5, design 8c)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

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

  // State 1: the cells are inert until the learner has actually listened. Tapping
  // before playing would be guessing at a card whose whole point is hearing.
  test('the beats cannot be answered until the rhythm has been played', () => {
    const { getByTestId, queryByTestId } = renderCard();
    expect(getByTestId('theory-beat-0').props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(getByTestId('theory-beat-0'));
    expect(queryByTestId('theory-beat-0-strong')).toBeNull();

    playFirst(getByTestId);
    expect(getByTestId('theory-beat-0').props.accessibilityState?.disabled).toBe(false);
  });

  test('finding every downbeat confirms the rule', () => {
    const { getByTestId } = renderCard();
    playFirst(getByTestId);

    fireEvent.press(getByTestId('theory-beat-0'));
    expect(getByTestId('theory-feedback')).toHaveTextContent('1 of 2 found');

    fireEvent.press(getByTestId('theory-beat-3'));
    expect(getByTestId('theory-beat-0-strong')).toBeTruthy();
    expect(getByTestId('theory-beat-3-strong')).toBeTruthy();
    expect(getByTestId('theory-feedback').props.children).toContain('first beat of every bar');
  });

  // State 3: a wrong tap is a nudge to listen again, never a failure — no red, and it
  // settles back rather than leaving a mark the learner cannot undo.
  test('a wrong tap nudges, settles back, and never marks the beat strong', () => {
    const { getByTestId, queryByTestId } = renderCard();
    playFirst(getByTestId);

    fireEvent.press(getByTestId('theory-beat-1')); // beat 2 of bar 1 — weak
    expect(queryByTestId('theory-beat-1-strong')).toBeNull();
    const feedback = getByTestId('theory-feedback').props.children as string;
    expect(feedback).toContain('Listen again');
    expect(feedback).not.toMatch(/wrong|not quite/i);

    act(() => jest.advanceTimersByTime(2000));
    expect(getByTestId('theory-feedback')).toHaveTextContent('0 of 2 found');
  });

  // The earlier build made a wrong tap permanent, so it had to keep gating the
  // success message. 8c settles it back instead — a learner who strays and then
  // hears it correctly still lands on the completion state.
  test('straying once does not spoil the completion state', () => {
    const { getByTestId } = renderCard();
    playFirst(getByTestId);

    fireEvent.press(getByTestId('theory-beat-1')); // weak
    act(() => jest.advanceTimersByTime(2000)); // pulse settles
    fireEvent.press(getByTestId('theory-beat-0'));
    fireEvent.press(getByTestId('theory-beat-3'));

    expect(getByTestId('theory-feedback').props.children).toContain('first beat of every bar');
  });
});
