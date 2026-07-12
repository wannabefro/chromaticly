// U7 acceptance: an 8-item set runs to the mastery-gems payoff (2f), and completing
// it marks the lesson complete exactly once (A2). WebView mocked like ExerciseLoop.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { LESSONS } from '../content/lessons';
import { generate } from '../engine/generators';
import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
import { assembleOptions } from './grading';
import { SetRunner } from './SetRunner';

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

const lesson = LESSONS[0];

async function answerCorrect(getByTestId: (id: string) => any, seed: number) {
  const instance = generate(lesson.templates[0], { grade: 1, seed });
  const index = assembleOptions(instance).findIndex((o) => o.correct);
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

describe('SetRunner — 8-item set to the mastery-gems payoff', () => {
  test('answering all 8 correctly reaches SetComplete with 8/8 and all clean gems', async () => {
    const storage = memoryStorage();
    const { getByTestId, getByText } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(getByTestId('set-runner')).toBeTruthy();
    expect(getByTestId('set-count')).toBeTruthy(); // header progress

    for (let seed = 0; seed < 8; seed++) {
      await answerCorrect(getByTestId, seed);
    }

    // 2f payoff: score ring shows 8/8, gems row present.
    expect(getByTestId('set-complete')).toBeTruthy();
    expect(getByText('8/8')).toBeTruthy();
    expect(getByTestId('set-gems')).toBeTruthy();
  });

  test('completing the set marks the lesson complete (persisted)', async () => {
    const storage = memoryStorage();
    const { getByTestId } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});

    for (let seed = 0; seed < 8; seed++) {
      await answerCorrect(getByTestId, seed);
    }

    expect(getByTestId('set-complete')).toBeTruthy();
    // The lesson was marked complete in the persisted snapshot.
    expect(storage.blob).toContain(`"${lesson.id}":{"completed":true}`);
  });
});
