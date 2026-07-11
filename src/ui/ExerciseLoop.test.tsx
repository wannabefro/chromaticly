// U10 acceptance tests for the exercise loop UI. Mocks react-native-webview
// (MusicSurface's dependency) so notation stimuli render without a real
// WebView — see src/music-surface/MusicSurface.test.tsx for the same pattern.

// Counts how many times a WebView is mounted so a test can prove the notation
// surface persists across exercises rather than remounting (the perf refactor).
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

function findOptionIndex(instance: ExerciseInstance, correct: boolean): number {
  const options = assembleOptions(instance);
  const index = options.findIndex((o) => o.correct === correct);
  if (index === -1) throw new Error('no matching option in fixture');
  return index;
}

describe('ExerciseLoop — MCQ grading', () => {
  test('a correct pick shows the correct feedback and fires onResult with correct:true', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={mcqInstance} onResult={onResult} />);

    fireEvent.press(getByTestId(`option-${findOptionIndex(mcqInstance, true)}`));

    expect(getByText(mcqInstance.feedback.correct)).toBeTruthy();
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true, hintsUsed: 0 }),
    );
  });

  test('a wrong pick shows the instance incorrect feedback and fires onResult with correct:false', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={mcqInstance} onResult={onResult} />);

    fireEvent.press(getByTestId(`option-${findOptionIndex(mcqInstance, false)}`));

    expect(getByText(mcqInstance.feedback.incorrect)).toBeTruthy();
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

  test('is case-insensitive and honors accepted_alternatives (e.g. "eb" for "E flat")', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={textInstance} onResult={onResult} />);

    fireEvent.changeText(getByTestId('text-input'), 'eb');
    fireEvent.press(getByTestId('submit'));

    expect(getByText(textInstance.feedback.correct)).toBeTruthy();
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
  });

  test('rejects an answer that matches neither the canonical form nor an alternative', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={textInstance} onResult={onResult} />);

    fireEvent.changeText(getByTestId('text-input'), 'F sharp');
    fireEvent.press(getByTestId('submit'));

    expect(getByText(textInstance.feedback.incorrect)).toBeTruthy();
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });
});

describe('ExerciseLoop — hints', () => {
  test('reveal one at a time behind "Show hint", and hint use is carried into the emitted result', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText, queryByText } = render(
      <ExerciseLoop instance={mcqInstance} onResult={onResult} />,
    );

    // First hint is hidden until the control is pressed.
    expect(queryByText(mcqInstance.hints[0])).toBeNull();

    fireEvent.press(getByTestId('show-hint'));
    expect(getByText(mcqInstance.hints[0])).toBeTruthy();
    expect(queryByText(mcqInstance.hints[1])).toBeNull();

    // Pressing again reveals the next hint.
    fireEvent.press(getByTestId('show-hint'));
    expect(getByText(mcqInstance.hints[1])).toBeTruthy();

    fireEvent.press(getByTestId(`option-${findOptionIndex(mcqInstance, true)}`));

    // A hint-assisted correct must carry hintsUsed > 0 (KTD10: must not read as unaided mastery).
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ hintsUsed: 2 }));
  });

  test('an unused hint control does not inflate hintsUsed', () => {
    const onResult = jest.fn();
    const { getByTestId } = render(<ExerciseLoop instance={mcqInstance} onResult={onResult} />);

    fireEvent.press(getByTestId(`option-${findOptionIndex(mcqInstance, true)}`));

    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ hintsUsed: 0 }));
  });
});

describe('ExerciseLoop — stimulus rendering', () => {
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

  const termInstance: ExerciseInstance = {
    ...mcqInstance,
    id: 'test-term-1',
    stimulus: { music: null, text: 'Allegro' },
  };

  test('a stimulus with music renders MusicSurface (mocked WebView) and a Play control', () => {
    const { getByTestId, queryByTestId } = render(<ExerciseLoop instance={musicInstance} onResult={jest.fn()} />);

    expect(getByTestId('stimulus-music')).toBeTruthy();
    expect(getByTestId('play')).toBeTruthy();
    expect(queryByTestId('stimulus-text')).toBeNull();
  });

  test('a text-only term item does not render notation and shows the text instead', () => {
    const { getByText, queryByTestId } = render(<ExerciseLoop instance={termInstance} onResult={jest.fn()} />);

    expect(getByText('Allegro')).toBeTruthy();
    expect(queryByTestId('stimulus-music')).toBeNull();
    expect(queryByTestId('play')).toBeNull();
  });

  // The invariant behind the persistence refactor: moving to the next exercise
  // must reset grading/interaction state (as a full remount used to) while the
  // notation WebView stays mounted — a remount reloads ~520KB of abcjs and cold-
  // inits the synth, which is the render lag this change removes.
  test('advancing to a new instance resets grading but does not remount the notation surface', () => {
    mockSurface.mounts = 0;
    const next: ExerciseInstance = { ...musicInstance, id: 'test-music-2', prompt: 'Name this note (again).' };
    const { getByTestId, getByText, queryByText, rerender } = render(
      <ExerciseLoop instance={musicInstance} onResult={jest.fn()} />,
    );
    expect(mockSurface.mounts).toBe(1);

    // Grade the first exercise → feedback shows, interaction hidden.
    fireEvent.press(getByTestId(`option-${findOptionIndex(musicInstance, true)}`));
    expect(getByText(musicInstance.feedback.correct)).toBeTruthy();

    // Advance to the next exercise (what Practice/Lesson do on Next, now without a key remount).
    rerender(<ExerciseLoop instance={next} onResult={jest.fn()} />);

    // State reset: feedback gone, a fresh interaction is back.
    expect(queryByText(musicInstance.feedback.correct)).toBeNull();
    expect(getByTestId('option-0')).toBeTruthy();
    // …and the WebView was never torn down.
    expect(mockSurface.mounts).toBe(1);
  });
});
