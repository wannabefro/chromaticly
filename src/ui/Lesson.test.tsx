// U12 acceptance tests for the lesson runner: worked example → exercises →
// completion. Mocks react-native-webview so MusicSurface (ExerciseLoop's and
// the worked example's notation) renders headless — see ExerciseLoop.test.tsx.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { LESSONS, lessonById } from '../content/lessons';
import { generate } from '../engine/generators';
import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
import { assembleOptions } from './grading';
import { Lesson } from './Lesson';

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

const trebleNotes = lessonById('treble-notes')!;

// New flow: select the correct option → Check → Continue (advances). Continue is
// the FeedbackSheet's advance affordance; there is no separate Next button.
async function answerCorrect(getByTestId: (id: string) => any, seed: number) {
  const instance = generate(trebleNotes.templates[0], { grade: 1, seed, atoms: [] });
  const options = assembleOptions(instance);
  const index = options.findIndex((o) => o.correct);
  await act(async () => {
    fireEvent.press(getByTestId(`option-${index}`));
  });
  await act(async () => {
    fireEvent.press(getByTestId('check'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('feedback-sheet-continue'));
  });
}

describe('Lesson — worked example then exercises', () => {
  test('shows the worked example first; Start begins the exercise stream', async () => {
    const { getByTestId, queryByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <Lesson lesson={trebleNotes} />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(getByTestId('worked-prompt')).toBeTruthy();
    expect(getByTestId('worked-answer')).toBeTruthy();
    expect(queryByTestId('prompt')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('start-lesson'));
    });

    expect(getByTestId('prompt')).toBeTruthy();
  });

  test('5 hint-free correct answers across exercises reaches the completion view', async () => {
    const { getByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <Lesson lesson={trebleNotes} />
      </ProgressProvider>,
    );
    await act(async () => {});

    await act(async () => {
      fireEvent.press(getByTestId('start-lesson'));
    });

    for (let seed = 0; seed < 5; seed++) {
      await answerCorrect(getByTestId, seed);
    }

    expect(getByTestId('lesson-complete')).toBeTruthy();
    expect(getByTestId('unlock-message')).toBeTruthy();
  });
});

describe('Lesson — a lesson with no worked example starts on exercises immediately', () => {
  test('renders the first exercise without a Start step', async () => {
    const lastLesson = LESSONS[LESSONS.length - 1];
    const { getByTestId, queryByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <Lesson lesson={{ ...lastLesson, worked_example: null }} />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(queryByTestId('start-lesson')).toBeNull();
    expect(getByTestId('prompt')).toBeTruthy();
  });
});
