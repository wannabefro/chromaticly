// U4: NotationCard shows notation on a paper card with a play affordance (rules 1–2).
// WebView is mocked like src/ui/ExerciseLoop.test.tsx so the surface renders headless.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { fireEvent, render } from '@testing-library/react-native';

import type { Music } from '../../music/types';
import { NotationCard } from './NotationCard';

const music: Music = {
  clef: 'treble',
  key_sig: null,
  time_sig: null,
  voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'semibreve' }] }],
};

describe('NotationCard', () => {
  test('renders the notation card with a play affordance by default', () => {
    const { getByTestId } = render(<NotationCard music={music} />);
    expect(getByTestId('notation-card')).toBeTruthy();
    expect(getByTestId('notation-card-play')).toBeTruthy();
  });

  test('omits the play affordance when play=false (e.g. a static answer preview)', () => {
    const { queryByTestId } = render(<NotationCard music={music} play={false} testID="answer-card" />);
    expect(queryByTestId('answer-card-play')).toBeNull();
  });

  test('play control fires without throwing', () => {
    const { getByTestId } = render(<NotationCard music={music} />);
    fireEvent.press(getByTestId('notation-card-play'));
  });
});
