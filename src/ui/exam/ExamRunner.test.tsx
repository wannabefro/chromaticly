// 302.2 exam flow (design 3b/3c/3d, rule 4): a silent MCQ paper, graded
// objectively and banded. Guards that answering the whole paper right bands
// Distinction and answering wrong bands below-pass, and that there is NO
// per-item feedback (assessment mode = zero gamification).

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { buildExamPaper, examMinutes, examSeconds } from '../../learn/exam';
import { assembleOptions } from '../grading';
import { ExamRunner } from './ExamRunner';

const paper = buildExamPaper(0);

/** Walk the whole paper, picking the correct or an incorrect option per question. */
function answerPaper(getByTestId: (id: string) => any, queryByTestId: (id: string) => any, pickCorrect: boolean) {
  for (let i = 0; i < paper.questions.length; i++) {
    const options = assembleOptions(paper.questions[i].instance);
    const correct = options.findIndex((o) => o.correct);
    const idx = pickCorrect ? correct : options.findIndex((o) => !o.correct);
    fireEvent.press(getByTestId(`exam-option-${idx}`));
    // No feedback sheet ever appears in exam mode.
    expect(queryByTestId('feedback-sheet')).toBeNull();
    fireEvent.press(getByTestId('exam-next'));
  }
}

describe('ExamRunner — silent Grade-1 paper, objectively banded (302.2)', () => {
  test('start screen shows marks, sections, and the band thresholds', () => {
    const { getByTestId, getByText } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    expect(getByTestId('exam-start')).toBeTruthy();
    expect(getByText('Practice Exam Paper')).toBeTruthy();
    expect(getByText('MARKS')).toBeTruthy();
    expect(getByText('SECTIONS')).toBeTruthy();
    expect(getByText('MINUTES')).toBeTruthy();
    expect(getByText(String(paper.totalMarks))).toBeTruthy();
    expect(getByText(String(examMinutes(paper)))).toBeTruthy();
    expect(getByTestId('exam-begin')).toBeTruthy();
  });

  test('answering the whole paper correctly bands Distinction with full marks', () => {
    const { getByTestId, queryByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);

    act(() => fireEvent.press(getByTestId('exam-begin')));
    expect(getByTestId('exam-paper')).toBeTruthy();

    answerPaper(getByTestId, queryByTestId, true);

    expect(getByTestId('exam-results')).toBeTruthy();
    expect(getByTestId('exam-band').props.children).toBe('Distinction');
    // Total renders "<n> / <marks>"; the score node carries the raw total.
    expect(getByTestId('exam-total')).toBeTruthy();
  });

  test('answering the whole paper incorrectly bands below pass', () => {
    const { getByTestId, queryByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    act(() => fireEvent.press(getByTestId('exam-begin')));
    answerPaper(getByTestId, queryByTestId, false);

    expect(getByTestId('exam-band').props.children).toBe('Not yet passed');
  });

  test('Next is disabled until an option is picked (no accidental skips)', () => {
    const { getByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    act(() => fireEvent.press(getByTestId('exam-begin')));
    expect(getByTestId('exam-next').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(getByTestId('exam-option-0'));
    expect(getByTestId('exam-next').props.accessibilityState?.disabled).toBe(false);
  });

  test('Back to Learn from results exits', () => {
    const onExit = jest.fn();
    const { getByTestId, queryByTestId } = render(<ExamRunner grade={1} onExit={onExit} paperSeed={0} />);
    act(() => fireEvent.press(getByTestId('exam-begin')));
    answerPaper(getByTestId, queryByTestId, true);
    fireEvent.press(getByTestId('exam-back-to-learn'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('exam conditions — the clock, the counter and flag-for-review (302.24)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  // Rule 4: the counter tracks progress, never a score. A learner who has answered
  // three questions wrong must read "3 answered", not "0" — the paper is silent
  // about correctness until it is submitted.
  test('the mark counter counts answers given, never marks earned', () => {
    const { getByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    act(() => fireEvent.press(getByTestId('exam-begin')));

    for (let i = 0; i < 3; i++) {
      const options = assembleOptions(paper.questions[i].instance);
      fireEvent.press(getByTestId(`exam-option-${options.findIndex((o) => !o.correct)}`));
      fireEvent.press(getByTestId('exam-next'));
    }

    expect(getByTestId('exam-marks')).toHaveTextContent(`3 / ${paper.totalMarks} marks answered`);
  });

  test('the clock counts down from the paper’s budget and never pauses', () => {
    const { getByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    act(() => fireEvent.press(getByTestId('exam-begin')));
    expect(getByTestId('exam-timer')).toHaveTextContent(`${examMinutes(paper)}:00`);

    act(() => jest.advanceTimersByTime(65_000));
    expect(getByTestId('exam-timer')).toHaveTextContent(`${examMinutes(paper) - 2}:55`);
  });

  // Running out of time submits the paper as it stands — that's what "no timer
  // pauses" means. Unanswered questions simply score nothing.
  test('running out of time submits the paper as it stands', () => {
    const { getByTestId, queryByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    act(() => fireEvent.press(getByTestId('exam-begin')));
    expect(queryByTestId('exam-results')).toBeNull();

    act(() => jest.advanceTimersByTime(examSeconds(paper) * 1000));

    expect(getByTestId('exam-results')).toBeTruthy();
    expect(getByTestId('exam-band').props.children).toBe('Not yet passed');
  });

  test('finishing with nothing flagged submits straight to results', () => {
    const { getByTestId, queryByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    act(() => fireEvent.press(getByTestId('exam-begin')));
    answerPaper(getByTestId, queryByTestId, true);

    expect(queryByTestId('exam-review')).toBeNull();
    expect(getByTestId('exam-results')).toBeTruthy();
  });

  // A flag has to lead somewhere: the paper isn't submitted until the learner has
  // had the chance to revisit what they marked.
  test('a flagged question routes through review before the paper is submitted', () => {
    const { getByTestId, getByText, queryByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    act(() => fireEvent.press(getByTestId('exam-begin')));

    fireEvent.press(getByTestId('exam-flag'));
    expect(getByTestId('exam-flag')).toHaveTextContent('⚑ flagged');
    answerPaper(getByTestId, queryByTestId, true);

    expect(queryByTestId('exam-results')).toBeNull();
    expect(getByTestId('exam-review')).toBeTruthy();
    expect(getByText('You flagged 1 question.')).toBeTruthy();

    // Review jumps back to the flagged question, still on the paper.
    fireEvent.press(getByTestId('exam-review-flagged'));
    expect(getByTestId('exam-paper')).toBeTruthy();
    expect(getByTestId('exam-flag')).toHaveTextContent('⚑ flagged');
  });

  test('submit from review grades the paper', () => {
    const { getByTestId, queryByTestId } = render(<ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} />);
    act(() => fireEvent.press(getByTestId('exam-begin')));
    fireEvent.press(getByTestId('exam-flag'));
    answerPaper(getByTestId, queryByTestId, true);

    fireEvent.press(getByTestId('exam-submit'));
    expect(getByTestId('exam-band').props.children).toBe('Distinction');
  });
});
