// U4: the FeedbackSheet is the designed feedback surface (rule 4, never a toast).
// Incorrect names the misconception AND shows the correct answer with play (A5).

import { StyleSheet, Text } from 'react-native';
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

  // U3 (Grade 3 octave transposition): the partial register sits between correct
  // and incorrect — it must use the hint amber, not either verdict colour, or the
  // "designed middle ground" (rule 4/9b) collapses back into a pass/fail toast.
  test('partial: uses the hint amber accent, not correct green or incorrect red', () => {
    const { getByTestId } = render(
      <FeedbackSheet kind="partial" message="3 of 4 notes correct." badgeLabel="3/4" onContinue={jest.fn()} />,
    );
    const sheet = getByTestId('feedback-sheet-partial');
    const borderColor = StyleSheet.flatten(sheet.props.style).borderTopColor;
    expect(borderColor).not.toBe('#57cf87'); // colors.correct
    expect(borderColor).not.toBe('#f0666f'); // colors.incorrect
    expect(borderColor).toBe('#f0c489'); // colors.hint
  });

  test('partial: badgeLabel overrides the glyph, and defaults to "So close!" when no title is given', () => {
    const { getByText, queryByText } = render(
      <FeedbackSheet kind="partial" message="3 of 4 notes correct." badgeLabel="3/4" onContinue={jest.fn()} />,
    );
    expect(getByText('3/4')).toBeTruthy();
    expect(getByText('So close!')).toBeTruthy();
    expect(queryByText('Correct!')).toBeNull();
    expect(queryByText('Not quite')).toBeNull();
  });

  test('secondary action fires its own callback (not onContinue) and is absent when not provided', () => {
    const onContinue = jest.fn();
    const onFix = jest.fn();
    const { getByTestId, queryByTestId, rerender } = render(
      <FeedbackSheet
        kind="partial"
        message="3 of 4 notes correct."
        onContinue={onContinue}
        secondaryAction={{ label: 'Fix note 3', onPress: onFix }}
      />,
    );
    fireEvent.press(getByTestId('feedback-sheet-secondary'));
    expect(onFix).toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();

    rerender(<FeedbackSheet kind="correct" message="Nice!" onContinue={onContinue} />);
    expect(queryByTestId('feedback-sheet-secondary')).toBeNull();
  });
});
