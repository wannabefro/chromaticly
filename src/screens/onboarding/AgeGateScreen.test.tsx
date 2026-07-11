// U9 acceptance test for Age gate (6b): 13+ persists the profile and hands off;
// under-13 shows a soft-block with no forward path — the invariant this guards
// is that a blocked minor can never reach onboarded state (R2, A11).

import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { ProgressProvider } from '../../learn/ProgressContext';
import type { SnapshotStorage } from '../../learn/store';
import { AgeGateScreen } from './AgeGateScreen';

const CURRENT_YEAR = 2026;

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

describe('AgeGateScreen — 13+ onboards, under-13 soft-blocks with no path forward (R2, A11)', () => {
  test('selecting a 13+ birth year and continuing onboards and hands off', async () => {
    const onOnboarded = jest.fn();
    const { getByTestId, findByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <AgeGateScreen onOnboarded={onOnboarded} currentYear={CURRENT_YEAR} />
      </ProgressProvider>,
    );

    const adultYear = CURRENT_YEAR - 20;
    fireEvent.press(await findByTestId(`year-${adultYear}`));
    fireEvent.press(getByTestId('age-continue'));

    await waitFor(() => expect(onOnboarded).toHaveBeenCalledTimes(1));
  });

  test('selecting an under-13 birth year shows the soft-block and never onboards', async () => {
    const onOnboarded = jest.fn();
    const { getByTestId, findByTestId, queryByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <AgeGateScreen onOnboarded={onOnboarded} currentYear={CURRENT_YEAR} />
      </ProgressProvider>,
    );

    const childYear = CURRENT_YEAR - 8;
    fireEvent.press(await findByTestId(`year-${childYear}`));
    fireEvent.press(getByTestId('age-continue'));

    await waitFor(() => expect(getByTestId('under13-block')).toBeTruthy());
    expect(queryByTestId('age-gate-screen')).toBeNull();
    expect(onOnboarded).not.toHaveBeenCalled();
  });
});
