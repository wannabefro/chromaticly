// U12 acceptance test for free practice: it renders a real generated exercise
// and advances the stream on Next. Mocks react-native-webview like
// ExerciseLoop.test.tsx.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
import { Practice } from './Practice';

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

describe('Practice — SRS-driven exercise stream', () => {
  test('renders an exercise from an unlocked template and advances on Next', async () => {
    const { getByTestId, queryByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <Practice />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(getByTestId('practice-active')).toBeTruthy(); // stable anchor the E2E waits on
    expect(getByTestId('prompt')).toBeTruthy();

    // select → Check → Continue advances the stream (no separate Next button).
    await act(async () => {
      fireEvent.press(getByTestId('option-0'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('check'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('feedback-sheet-continue'));
    });

    expect(getByTestId('prompt')).toBeTruthy();
  });
});
