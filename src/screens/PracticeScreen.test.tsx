// PracticeScreen is now a thin ProgressProvider-context wrapper around the
// real Practice stream (src/ui/Practice, covered in depth by its own test).
// This only proves the route mounts inside a provider and exposes its testID.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_props: Record<string, unknown>, _ref: unknown) => null) };
});

import { act, render } from '@testing-library/react-native';

import { LESSONS } from '../content/lessons';
import { ProgressProvider } from '../learn/ProgressContext';
import { initialSrs } from '../learn/srs';
import { ProgressStore, type SnapshotStorage } from '../learn/store';
import PracticeScreen from './PracticeScreen';

/** Practice draws only from ATTEMPTED atoms since G6 U3, so a fresh store renders
 *  the empty state. Seed one attempt so the route mounts a real exercise. */
function attemptedBlob(): string {
  const store = new ProgressStore();
  for (const atom of LESSONS[0].atoms) {
    store.setAtom(atom, { mastery: { streak: 1, mastered: false }, srs: initialSrs(0) });
  }
  return JSON.stringify(store.toSnapshot());
}

function memoryStorage(): SnapshotStorage & { blob: string | null } {
  return {
    blob: attemptedBlob() as string | null,
    async load() {
      return this.blob;
    },
    async save(serialized: string) {
      this.blob = serialized;
    },
  };
}

describe('PracticeScreen — mounts the real Practice stream', () => {
  test('renders the practice-screen wrapper and a generated exercise', async () => {
    const { getByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <PracticeScreen />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(getByTestId('practice-screen')).toBeTruthy();
    expect(getByTestId('prompt')).toBeTruthy();
  });
});
