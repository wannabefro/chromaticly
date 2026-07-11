// U12 acceptance test for the learn map: unlock/lock state driven by the
// progress store, plus the free-practice entry point.

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Link: ({ children, testID }: { children: React.ReactNode; testID?: string }) =>
      React.createElement(Text, { testID }, children),
    // Run the focus callback once on mount, mirroring a screen gaining focus.
    useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), []),
  };
});

import { act, render, waitFor } from '@testing-library/react-native';

import { LESSONS } from '../content/lessons';
import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
import LearnMapScreen from './LearnMapScreen';

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

describe('LearnMapScreen — lesson list reflects unlock/complete state', () => {
  test('the entry lesson is an unlocked link, a later lesson is locked, and free practice is offered', async () => {
    const { getByTestId, findByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <LearnMapScreen />
      </ProgressProvider>,
    );

    const firstLink = await findByTestId(`lesson-link-${LESSONS[0].id}`);
    expect(firstLink).toBeTruthy();

    const laterLesson = LESSONS[LESSONS.length - 1];
    await waitFor(() => expect(getByTestId(`lesson-locked-${laterLesson.id}`)).toBeTruthy());

    expect(getByTestId('practice-link')).toBeTruthy();
  });

  test('shows a loading state before the store is ready', async () => {
    const { getByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <LearnMapScreen />
      </ProgressProvider>,
    );
    expect(getByTestId('learn-loading')).toBeTruthy();
    await act(async () => {});
  });
});
