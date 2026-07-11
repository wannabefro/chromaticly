// U3 acceptance tests for the MCQ option card.

import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AnswerOption } from './AnswerOption';

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
});
