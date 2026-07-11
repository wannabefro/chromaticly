// U6 acceptance tests for the reskinned exercise item. Flow is select → Check →
// FeedbackSheet → Continue (Check disabled until a pick; onResult fires at Continue).
// WebView is mocked and mounts are counted to prove the notation surface persists
// across items rather than remounting (the perf refactor's invariant).

const mockSurface = { mounts: 0 };
jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: React.forwardRef((_props: Record<string, unknown>, _ref: unknown) => {
      React.useEffect(() => {
        mockSurface.mounts += 1;
      }, []);
      return null;
    }),
  };
});

import { fireEvent, render } from '@testing-library/react-native';

import type { ExerciseInstance } from '../engine/schema';
import { ExerciseLoop } from './ExerciseLoop';
import { assembleOptions } from './grading';

const mcqInstance: ExerciseInstance = {
  id: 'test-mcq-1',
  template_id: 'note_naming',
  grade: 1,
  strand: 'pitch',
  prompt: 'Name this note.',
  stimulus: { music: null, text: null },
  interaction: { type: 'mcq', config: {} },
  answer: { canonical: 'C', accepted_alternatives: [] },
  distractors: ['D', 'E'],
  hints: ['Count up from middle C.', 'It sits on the bottom line.'],
  feedback: { correct: 'Nice!', incorrect: 'Not quite — try again.' },
  srs_tags: ['pitch:test'],
  kb_version: 'test',
};

function optionIndex(instance: ExerciseInstance, correct: boolean): number {
  const options = assembleOptions(instance);
  const index = options.findIndex((o) => o.correct === correct);
  if (index === -1) throw new Error('no matching option in fixture');
  return index;
}

describe('ExerciseLoop — MCQ select → Check → feedback', () => {
  test('Check is disabled until an option is selected', () => {
    const { getByTestId } = render(<ExerciseLoop instance={mcqInstance} onResult={jest.fn()} />);
    // Check exists but is disabled pre-selection.
    expect(getByTestId('check').props.accessibilityState?.disabled).toBe(true);
  });

  test('a correct pick, then Check, shows correct feedback; Continue fires onResult correct:true', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={mcqInstance} onResult={onResult} />);

    fireEvent.press(getByTestId(`option-${optionIndex(mcqInstance, true)}`));
    fireEvent.press(getByTestId('check'));

    expect(getByText(mcqInstance.feedback.correct)).toBeTruthy();
    expect(onResult).not.toHaveBeenCalled(); // not until Continue

    fireEvent.press(getByTestId('feedback-sheet-continue'));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true, hintsUsed: 0 }));
  });

  test('a wrong pick, then Check, shows incorrect feedback and fires onResult correct:false', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={mcqInstance} onResult={onResult} />);

    fireEvent.press(getByTestId(`option-${optionIndex(mcqInstance, false)}`));
    fireEvent.press(getByTestId('check'));

    expect(getByText(mcqInstance.feedback.incorrect)).toBeTruthy();
    fireEvent.press(getByTestId('feedback-sheet-continue'));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });
});

describe('ExerciseLoop — text_input grading', () => {
  const textInstance: ExerciseInstance = {
    ...mcqInstance,
    id: 'test-text-1',
    interaction: { type: 'text_input', config: {} },
    answer: { canonical: 'E flat', accepted_alternatives: ['Eb', 'E♭'] },
  };

  test('is case-insensitive and honors accepted_alternatives ("eb" for "E flat")', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={textInstance} onResult={onResult} />);

    fireEvent.changeText(getByTestId('text-input'), 'eb');
    fireEvent.press(getByTestId('check'));

    expect(getByText(textInstance.feedback.correct)).toBeTruthy();
    fireEvent.press(getByTestId('feedback-sheet-continue'));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
  });

  test('rejects an answer matching neither canonical nor an alternative', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={textInstance} onResult={onResult} />);

    fireEvent.changeText(getByTestId('text-input'), 'F sharp');
    fireEvent.press(getByTestId('check'));

    expect(getByText(textInstance.feedback.incorrect)).toBeTruthy();
    fireEvent.press(getByTestId('feedback-sheet-continue'));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });
});

describe('ExerciseLoop — hints', () => {
  test('reveal one at a time; hint use carries into the emitted result (KTD10)', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText, queryByText } = render(
      <ExerciseLoop instance={mcqInstance} onResult={onResult} />,
    );

    expect(queryByText(mcqInstance.hints[0])).toBeNull();
    fireEvent.press(getByTestId('show-hint'));
    expect(getByText(mcqInstance.hints[0])).toBeTruthy();
    fireEvent.press(getByTestId('show-hint'));
    expect(getByText(mcqInstance.hints[1])).toBeTruthy();

    fireEvent.press(getByTestId(`option-${optionIndex(mcqInstance, true)}`));
    fireEvent.press(getByTestId('check'));
    fireEvent.press(getByTestId('feedback-sheet-continue'));

    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ hintsUsed: 2 }));
  });
});

describe('ExerciseLoop — stimulus + surface persistence', () => {
  const musicInstance: ExerciseInstance = {
    ...mcqInstance,
    id: 'test-music-1',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: null,
        time_sig: null,
        voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'semibreve' }] }],
      },
      text: null,
    },
  };

  test('a music stimulus renders a NotationCard with a play control', () => {
    const { getByTestId } = render(<ExerciseLoop instance={musicInstance} onResult={jest.fn()} />);
    expect(getByTestId('stimulus-music')).toBeTruthy();
    expect(getByTestId('notation-card-play')).toBeTruthy();
  });

  test('advancing to a new instance resets state without remounting the notation surface', () => {
    mockSurface.mounts = 0;
    const next: ExerciseInstance = { ...musicInstance, id: 'test-music-2', prompt: 'Name this note (again).' };
    const { getByTestId, queryByTestId, rerender } = render(
      <ExerciseLoop instance={musicInstance} onResult={jest.fn()} />,
    );
    expect(mockSurface.mounts).toBe(1);

    // Grade correct (no answer-card mounted), continue, advance.
    fireEvent.press(getByTestId(`option-${optionIndex(musicInstance, true)}`));
    fireEvent.press(getByTestId('check'));
    expect(getByTestId('feedback-sheet-correct')).toBeTruthy();

    rerender(<ExerciseLoop instance={next} onResult={jest.fn()} />);

    // Feedback cleared, a fresh Check is back, and the surface was never torn down.
    expect(queryByTestId('feedback-sheet-correct')).toBeNull();
    expect(getByTestId('check')).toBeTruthy();
    expect(mockSurface.mounts).toBe(1);
  });
});
