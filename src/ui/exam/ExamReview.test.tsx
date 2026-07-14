// 8b — reviewing the marked paper. The mirror of 8a: there, nothing may be revealed;
// here, the paper is graded and done, so correctness is visible everywhere. What must
// hold is that the review is honest (their answer marked against the right one, the
// misconception named) and that "Next wrong" actually skips what they got right.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { buildExamPaper } from '../../learn/exam';
import { assembleOptions } from '../grading';
import { ExamRunner } from './ExamRunner';

const paper = buildExamPaper(0);

/** Sit the paper, answering the first `wrongCount` questions wrongly and the rest right. */
function sitPaper(getByTestId: (id: string) => any, wrongCount: number) {
  act(() => fireEvent.press(getByTestId('exam-begin')));
  for (let i = 0; i < paper.questions.length; i++) {
    const options = assembleOptions(paper.questions[i].instance);
    const idx = i < wrongCount ? options.findIndex((o) => !o.correct) : options.findIndex((o) => o.correct);
    fireEvent.press(getByTestId(`exam-option-${idx}`));
    fireEvent.press(getByTestId('exam-next'));
  }
}

describe('ExamReview — reviewing the marked paper (8b)', () => {
  test('3d offers Review paper, and it opens the marked script', () => {
    const { getByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    sitPaper(getByTestId, 2);

    expect(getByTestId('exam-results')).toBeTruthy();
    fireEvent.press(getByTestId('exam-review-paper'));

    expect(getByTestId('exam-marked')).toBeTruthy();
    expect(getByTestId('exam-review-summary')).toHaveTextContent(
      `${paper.totalMarks - 2}/${paper.totalMarks} · Distinction · graded`,
    );
  });

  // It opens where the marks were lost, not at Q1 — walking 18 correct answers to
  // reach the two that cost something is not review, it is scrolling.
  test('review opens on the first question they got wrong', () => {
    const { getByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    sitPaper(getByTestId, 2);
    fireEvent.press(getByTestId('exam-review-paper'));

    expect(getByTestId('exam-review-mark')).toHaveTextContent('0/1 mark');
  });

  test('a wrong answer names the misconception and marks their pick against the right one', () => {
    const { getByTestId, getByText } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    sitPaper(getByTestId, 1);
    fireEvent.press(getByTestId('exam-review-paper'));

    expect(getByTestId('exam-review-why')).toHaveTextContent(paper.questions[0].instance.feedback.incorrect);
    expect(getByText('your answer')).toBeTruthy();
    expect(getByText('correct')).toBeTruthy();
  });

  test('"Next wrong" skips the questions they got right', () => {
    const { getByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    // Wrong on Q1 and Q2 only; everything after is correct.
    sitPaper(getByTestId, 2);
    fireEvent.press(getByTestId('exam-review-paper'));

    fireEvent.press(getByTestId('exam-review-next-wrong')); // Q1 -> Q2, not Q1 -> Q2 by accident
    expect(getByTestId('exam-review-mark')).toHaveTextContent('0/1 mark');

    // No wrong answers left: the button is spent rather than looping back round.
    expect(getByTestId('exam-review-next-wrong').props.accessibilityState?.disabled).toBe(true);
  });

  test('a blank is reviewed as a blank, not as a wrong answer', () => {
    const { getByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    act(() => fireEvent.press(getByTestId('exam-begin')));
    fireEvent.press(getByTestId('exam-next')); // skip Q1
    for (let i = 1; i < paper.questions.length; i++) {
      const options = assembleOptions(paper.questions[i].instance);
      fireEvent.press(getByTestId(`exam-option-${options.findIndex((o) => o.correct)}`));
      fireEvent.press(getByTestId('exam-next'));
    }
    fireEvent.press(getByTestId('exam-submit')); // through 8a — Q1 is unanswered
    fireEvent.press(getByTestId('exam-review-paper'));

    expect(getByTestId('exam-review-why')).toHaveTextContent('You left this one blank.');
  });
});
