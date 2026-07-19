// 302.2 exam flow (design 3b/3c/3d, rule 4): a silent MCQ paper, graded
// objectively and banded. Guards that answering the whole paper right bands
// Distinction and answering wrong bands below-pass, and that there is NO
// per-item feedback (assessment mode = zero gamification).
//
// U5 (grade2-new-major-keys, D7): ExamRunner now reads recordExamResult from
// useProgressContext, so every render needs a ProgressProvider — mirroring
// SetRunner.test.tsx's memoryStorage + wrapper pattern.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { buildExamPaper, examMinutes, examSeconds } from '../../learn/exam';
import { ProgressProvider } from '../../learn/ProgressContext';
import { ProgressStore, type SnapshotStorage } from '../../learn/store';
import { assembleOptions } from '../grading';
import { ExamRunner, type ExamRunnerProps } from './ExamRunner';

const paper = buildExamPaper(0);

function memoryStorage(): SnapshotStorage & { blob: string | null } {
  return {
    blob: null as string | null,
    async load() {
      return this.blob;
    },
    async save(serialized: string) {
      this.blob = serialized;
    },
  };
}

/** Render ExamRunner inside a real ProgressProvider and flush the store's
 *  async load, so recordExamResult has a live store by the time a test
 *  drives the paper to results. */
async function renderExam(props: Partial<ExamRunnerProps> = {}) {
  const storage = memoryStorage();
  const utils = render(
    <ProgressProvider storage={storage}>
      <ExamRunner grade={1} onExit={jest.fn()} paperSeed={0} {...props} />
    </ProgressProvider>,
  );
  await act(async () => {});
  return { storage, ...utils };
}

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
  test('start screen shows marks, sections, and the band thresholds', async () => {
    const { getByTestId, getByText } = await renderExam();
    expect(getByTestId('exam-start')).toBeTruthy();
    expect(getByText('Practice Exam Paper')).toBeTruthy();
    expect(getByText('MARKS')).toBeTruthy();
    expect(getByText('SECTIONS')).toBeTruthy();
    expect(getByText('MINUTES')).toBeTruthy();
    expect(getByText(String(paper.totalMarks))).toBeTruthy();
    expect(getByText(String(examMinutes(paper)))).toBeTruthy();
    expect(getByTestId('exam-begin')).toBeTruthy();
  });

  test('answering the whole paper correctly bands Distinction with full marks', async () => {
    const { getByTestId, queryByTestId } = await renderExam();

    act(() => fireEvent.press(getByTestId('exam-begin')));
    expect(getByTestId('exam-paper')).toBeTruthy();

    answerPaper(getByTestId, queryByTestId, true);

    expect(getByTestId('exam-results')).toBeTruthy();
    expect(getByTestId('exam-band').props.children).toBe('Distinction');
    // Total renders "<n> / <marks>"; the score node carries the raw total.
    expect(getByTestId('exam-total')).toBeTruthy();
  });

  test('answering the whole paper incorrectly bands below pass', async () => {
    const { getByTestId, queryByTestId } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));
    answerPaper(getByTestId, queryByTestId, false);

    expect(getByTestId('exam-band').props.children).toBe('Not yet passed');
  });

  // A blank used to be impossible (Next was disabled until you picked). 8a exists
  // precisely to catch blanks, so a question can now be left and come back to — as in
  // a real paper. The button says what it will do.
  test('a question can be skipped and returned to, and the CTA says so', async () => {
    const { getByTestId } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));

    expect(getByTestId('exam-next')).toHaveTextContent('Skip');
    fireEvent.press(getByTestId('exam-option-0'));
    expect(getByTestId('exam-next')).toHaveTextContent('Next');
  });

  test('Back to Learn from results exits', async () => {
    const onExit = jest.fn();
    const { getByTestId, queryByTestId } = await renderExam({ onExit });
    act(() => fireEvent.press(getByTestId('exam-begin')));
    answerPaper(getByTestId, queryByTestId, true);
    fireEvent.press(getByTestId('exam-back-to-learn'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

// D7: the exam-clear fact is written the moment the paper reaches results —
// this is the unlock signal Level 2 depends on (D6's ensureLevelRootsUnlocked
// runs inside recordExamResult).
describe('ExamRunner — records the exam result on entering results (D7, U5)', () => {
  test('a passing tally clears the exam and unlocks the grade-2 root, exactly once', async () => {
    const { getByTestId, queryByTestId, storage } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));
    answerPaper(getByTestId, queryByTestId, true);

    expect(getByTestId('exam-results')).toBeTruthy();
    // A re-render while still on `results` must not record a second time —
    // the fired-once ref guards it even though the effect's own deps are stable.
    await act(async () => {});

    const store = new ProgressStore(JSON.parse(storage.blob as string));
    expect(store.isExamCleared(1)).toBe(true);
    expect(store.isUnlocked('key-signatures-2')).toBe(true);
  });

  test('a below-pass tally records nothing — the exam stays uncleared and Level 2 stays locked', async () => {
    const { getByTestId, queryByTestId, storage } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));
    answerPaper(getByTestId, queryByTestId, false);

    expect(getByTestId('exam-band').props.children).toBe('Not yet passed');
    // ExamRunner never writes progress on any other path, so a below-pass
    // band recording nothing means the store is never even saved.
    expect(storage.blob).toBeNull();
  });
});

describe('exam conditions — the clock, the counter and flag-for-review (302.24)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  // Rule 4: the counter tracks progress, never a score. A learner who has answered
  // three questions wrong must read "3 answered", not "0" — the paper is silent
  // about correctness until it is submitted.
  test('the mark counter counts answers given, never marks earned', async () => {
    const { getByTestId } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));

    for (let i = 0; i < 3; i++) {
      const options = assembleOptions(paper.questions[i].instance);
      fireEvent.press(getByTestId(`exam-option-${options.findIndex((o) => !o.correct)}`));
      fireEvent.press(getByTestId('exam-next'));
    }

    expect(getByTestId('exam-marks')).toHaveTextContent(`3 / ${paper.totalMarks} marks answered`);
  });

  test('the clock counts down from the paper’s budget and never pauses', async () => {
    const { getByTestId } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));
    expect(getByTestId('exam-timer')).toHaveTextContent(`${examMinutes(paper)}:00`);

    act(() => jest.advanceTimersByTime(65_000));
    expect(getByTestId('exam-timer')).toHaveTextContent(`${examMinutes(paper) - 2}:55`);
  });

  // Running out of time submits the paper as it stands — that's what "no timer
  // pauses" means. Unanswered questions simply score nothing.
  test('running out of time submits the paper as it stands', async () => {
    const { getByTestId, queryByTestId } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));
    expect(queryByTestId('exam-results')).toBeNull();

    act(() => jest.advanceTimersByTime(examSeconds(paper) * 1000));

    expect(getByTestId('exam-results')).toBeTruthy();
    expect(getByTestId('exam-band').props.children).toBe('Not yet passed');
  });

  test('finishing with nothing flagged submits straight to results', async () => {
    const { getByTestId, queryByTestId } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));
    answerPaper(getByTestId, queryByTestId, true);

    expect(queryByTestId('exam-review')).toBeNull();
    expect(getByTestId('exam-results')).toBeTruthy();
  });

  // A flag has to lead somewhere: the paper isn't submitted until the learner has
  // had the chance to revisit what they marked.
  test('a flagged question routes through review before the paper is submitted', async () => {
    const { getByTestId, getByText, queryByTestId } = await renderExam();
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

  // 8a: a blank costs a mark, a flag is only a note to self — so an unanswered
  // question is surfaced too, and ranks ahead of the flags.
  test('an unanswered question routes through review and is named there', async () => {
    const { getByTestId, getByText, queryByTestId } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));

    fireEvent.press(getByTestId('exam-next')); // skip Q1 — leave it blank
    for (let i = 1; i < paper.questions.length; i++) {
      fireEvent.press(getByTestId('exam-option-0'));
      fireEvent.press(getByTestId('exam-next'));
    }

    expect(queryByTestId('exam-results')).toBeNull();
    expect(getByText('You left 1 question unanswered.')).toBeTruthy();
    // Submit is demoted while anything is outstanding.
    expect(getByTestId('exam-review-flagged')).toHaveTextContent('Review flagged & unanswered (1)');
    expect(getByTestId('exam-submit')).toHaveTextContent('Submit paper now');
  });

  test('a review row jumps to the question that needs attention', async () => {
    const { getByTestId } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));

    fireEvent.press(getByTestId('exam-next')); // Q1 blank — it is in the rhythm section
    for (let i = 1; i < paper.questions.length; i++) {
      fireEvent.press(getByTestId('exam-option-0'));
      fireEvent.press(getByTestId('exam-next'));
    }

    fireEvent.press(getByTestId(`exam-review-section-${paper.questions[0].section}`));
    expect(getByTestId('exam-paper')).toBeTruthy();
    expect(getByTestId('exam-marks')).toHaveTextContent(`${paper.questions.length - 1} / ${paper.totalMarks} marks answered`);

    // Answering the blank settles the paper: Submit is primary again, nothing outstanding.
    fireEvent.press(getByTestId('exam-option-0'));
    for (let i = 1; i < paper.questions.length; i++) fireEvent.press(getByTestId('exam-next'));
    fireEvent.press(getByTestId('exam-next'));
    expect(getByTestId('exam-results')).toBeTruthy();
  });

  // Rule 4 again, on the screen most tempted to break it: review is about what still
  // needs attention, never about how the learner is doing.
  test('the review screen never leaks correctness', async () => {
    const { getByTestId, queryByText } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));

    fireEvent.press(getByTestId('exam-flag'));
    for (let i = 0; i < paper.questions.length; i++) {
      const options = assembleOptions(paper.questions[i].instance);
      fireEvent.press(getByTestId(`exam-option-${options.findIndex((o) => !o.correct)}`)); // all wrong
      fireEvent.press(getByTestId('exam-next'));
    }

    expect(getByTestId('exam-review')).toBeTruthy();
    for (const leak of ['correct', 'Correct', 'incorrect', 'wrong', '0/20', 'Not yet passed']) {
      expect(queryByText(new RegExp(leak))).toBeNull();
    }
  });

  test('submit from review grades the paper', async () => {
    const { getByTestId, queryByTestId } = await renderExam();
    act(() => fireEvent.press(getByTestId('exam-begin')));
    fireEvent.press(getByTestId('exam-flag'));
    answerPaper(getByTestId, queryByTestId, true);

    fireEvent.press(getByTestId('exam-submit'));
    expect(getByTestId('exam-band').props.children).toBe('Distinction');
  });
});
