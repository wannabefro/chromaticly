// U10 acceptance for first-run routing (KTD5/A7; U2: home is the level map) —
// the DoD's outer loop:
//   new user   → Welcome → Age gate (13+) → level map
//   returning  → straight to the level map, Welcome never shown
// The returning-user seed is the blob a real onboarding persists, so this guards
// that isOnboarded routing keys off the actual persisted profile, not a flag reset.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
import RootRouter from './RootRouter';

function memoryStorage(seed: string | null = null): SnapshotStorage & { blob: string | null } {
  return {
    blob: seed,
    async load() {
      return this.blob;
    },
    async save(serialized: string) {
      this.blob = serialized;
    },
  };
}

const CURRENT_YEAR = new Date().getFullYear();

describe('RootRouter — first-run routing (A7)', () => {
  test('new user walks Welcome → Age gate → level map', async () => {
    const storage = memoryStorage();
    const { getByTestId, findByTestId } = render(
      <ProgressProvider storage={storage}>
        <RootRouter />
      </ProgressProvider>,
    );

    // Welcome first (ready resolves, no profile).
    expect(await findByTestId('welcome-screen')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('start-learning'));
    });
    expect(getByTestId('age-gate-screen')).toBeTruthy();

    fireEvent.press(getByTestId(`year-${CURRENT_YEAR - 20}`));
    await act(async () => {
      fireEvent.press(getByTestId('age-continue'));
    });

    // Onboarding persisted → context re-renders onboarded → level map (R1: grade home).
    expect(await findByTestId('level-map-screen')).toBeTruthy();
    expect(storage.blob).toContain('"birthYear":' + (CURRENT_YEAR - 20));
  });

  test('returning user skips onboarding and lands on the level map', async () => {
    // Seed the blob a completed onboarding leaves behind.
    const seedStorage = memoryStorage();
    const seedRender = render(
      <ProgressProvider storage={seedStorage}>
        <RootRouter />
      </ProgressProvider>,
    );
    await seedRender.findByTestId('welcome-screen');
    await act(async () => {
      fireEvent.press(seedRender.getByTestId('start-learning'));
    });
    fireEvent.press(seedRender.getByTestId(`year-${CURRENT_YEAR - 20}`));
    await act(async () => {
      fireEvent.press(seedRender.getByTestId('age-continue'));
    });
    await seedRender.findByTestId('level-map-screen');
    const seededBlob = seedStorage.blob;
    seedRender.unmount();

    const { findByTestId, queryByTestId } = render(
      <ProgressProvider storage={memoryStorage(seededBlob)}>
        <RootRouter />
      </ProgressProvider>,
    );

    expect(await findByTestId('level-map-screen')).toBeTruthy();
    expect(queryByTestId('welcome-screen')).toBeNull();
  });
});
