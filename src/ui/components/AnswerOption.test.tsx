// U3/U4 acceptance tests for the MCQ option card.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: React.forwardRef((_props: Record<string, unknown>, _ref: unknown) => null),
  };
});

import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { Music } from '../../music/types';
import { AnswerOption } from './AnswerOption';

const G_MAJOR: Music = {
  clef: 'treble',
  key_sig: 'G_major',
  time_sig: null,
  voices: [{ events: [{ type: 'note', pitch: 'G4', dur: 'semibreve' }] }],
};

describe('AnswerOption', () => {
  test('renders the letter badge and label', () => {
    const { getByText } = render(<AnswerOption letter="A" label="1 beat" />);

    expect(getByText('A')).toBeTruthy();
    expect(getByText('1 beat')).toBeTruthy();
  });

  test('fires onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <AnswerOption letter="A" label="1 beat" onPress={onPress} testID="option-a" />,
    );

    fireEvent.press(getByTestId('option-a'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // Invariant: a correct card swaps the letter for a check mark, never showing
  // the raw letter — so downstream can rely on the ✓ to signal correctness.
  test('state="correct" swaps the badge for a check mark instead of the letter', () => {
    const { getByText, queryByText } = render(
      <AnswerOption letter="B" label="2 beats" state="correct" meta="correct" />,
    );

    expect(getByText('✓')).toBeTruthy();
    expect(queryByText('B')).toBeNull();
  });

  // Invariant: an incorrect card swaps the letter for a cross, never showing
  // the raw letter — so downstream can rely on the × to signal a miss.
  test('state="incorrect" swaps the badge for a cross instead of the letter', () => {
    const { getByText, queryByText } = render(
      <AnswerOption letter="D" label="4 beats" state="incorrect" meta="your pick" />,
    );

    expect(getByText('×')).toBeTruthy();
    expect(queryByText('D')).toBeNull();
  });

  test('state="selected" renders with the strand hue and keeps showing the letter', () => {
    const { getByText } = render(
      <AnswerOption letter="B" label="2 beats" state="selected" strand="rhythm" />,
    );

    expect(getByText('B')).toBeTruthy();
  });

  test('renders children instead of the text label when provided (notation answers)', () => {
    const { getByText, queryByText } = render(
      <AnswerOption letter="A" label="unused">
        <Text>mini notation</Text>
      </AnswerOption>,
    );

    expect(getByText('mini notation')).toBeTruthy();
    expect(queryByText('unused')).toBeNull();
  });

  // U4/AD5: a notation-answer option (e.g. a key signature) renders a mini
  // stave instead of text, and that stave never carries the play affordance —
  // play is reserved for stimulus/FeedbackSheet notation (rule 9).
  describe('music prop (notation-answer options)', () => {
    test('renders a NotationCard instead of the text label when music is set', () => {
      const { getByTestId, queryByText } = render(
        <AnswerOption letter="A" label="G major" music={G_MAJOR} testID="option-a" />,
      );

      expect(getByTestId('option-a-notation')).toBeTruthy();
      expect(queryByText('G major')).toBeNull();
    });

    test('the notation is play-disabled — no play button inside the option', () => {
      const { queryByTestId } = render(
        <AnswerOption letter="A" label="G major" music={G_MAJOR} testID="option-a" />,
      );

      expect(queryByTestId('option-a-notation-play')).toBeNull();
    });

    test('falls back to the text label when music is not set', () => {
      const { getByText, queryByTestId } = render(
        <AnswerOption letter="A" label="G major" testID="option-a" />,
      );

      expect(getByText('G major')).toBeTruthy();
      expect(queryByTestId('option-a-notation')).toBeNull();
    });
  });
});
