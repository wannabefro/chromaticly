// U4: the FeedbackSheet is the designed feedback surface (rule 4, never a toast).
// Incorrect names the misconception AND shows the correct answer with play (A5).

import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { FeedbackSheet } from './FeedbackSheet';

describe('FeedbackSheet', () => {
  test('correct: shows the affirming state and Continue fires onContinue', () => {
    const onContinue = jest.fn();
    const { getByTestId, getByText } = render(
      <FeedbackSheet kind="correct" message="That note sits in the top space." onContinue={onContinue} />,
    );
    expect(getByTestId('feedback-sheet-correct')).toBeTruthy();
    expect(getByText('Correct!')).toBeTruthy();
    fireEvent.press(getByTestId('feedback-sheet-continue'));
    expect(onContinue).toHaveBeenCalled();
  });

  test('incorrect: names the misconception and renders the correct answer node', () => {
    const onContinue = jest.fn();
    const { getByTestId, getByText } = render(
      <FeedbackSheet
        kind="incorrect"
        message="That's the bass-clef name — check the clef sign."
        correctAnswer={<Text testID="correct-answer-node">B on the middle line</Text>}
        onContinue={onContinue}
      />,
    );
    expect(getByTestId('feedback-sheet-incorrect')).toBeTruthy();
    expect(getByText("That's the bass-clef name — check the clef sign.")).toBeTruthy();
    // A5: the correct answer is shown, not just named.
    expect(getByTestId('correct-answer-node')).toBeTruthy();
    fireEvent.press(getByTestId('feedback-sheet-continue'));
    expect(onContinue).toHaveBeenCalled();
  });
});
