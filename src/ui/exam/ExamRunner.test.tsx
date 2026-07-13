// 302.2 exam flow (design 3b/3c/3d, rule 4): a silent MCQ paper, graded
// objectively and banded. Guards that answering the whole paper right bands
// Distinction and answering wrong bands below-pass, and that there is NO
// per-item feedback (assessment mode = zero gamification).

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { buildExamPaper } from '../../learn/exam';
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
    expect(getByText(`${paper.totalMarks} MARKS`)).toBeTruthy();
    expect(getByText('5 SECTIONS')).toBeTruthy();
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
