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

    expect(getByTestId('prompt')).toBeTruthy();
    expect(queryByTestId('practice-next')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('option-0'));
    });

    expect(getByTestId('practice-next')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('practice-next'));
    });

    expect(getByTestId('prompt')).toBeTruthy();
    expect(queryByTestId('practice-next')).toBeNull();
  });
});
