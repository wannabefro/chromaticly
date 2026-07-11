// U12 acceptance test for the /lesson/[id] route target: resolves the id
// param to a lesson and hands it to the Lesson runner, or shows not-found.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  router: { back: jest.fn() },
}));

import { act, render } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
import LessonScreen from './LessonScreen';

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

describe('LessonScreen — resolves the id param to a lesson', () => {
  test('renders the Lesson runner for a known id', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'treble-notes' });

    const { getByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <LessonScreen />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(getByTestId('worked-prompt')).toBeTruthy();
  });

  test('renders a not-found state for an unknown id', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'does-not-exist' });

    const { getByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <LessonScreen />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(getByTestId('lesson-not-found')).toBeTruthy();
  });
});
