import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { SettingsProvider } from '../../learn/SettingsContext';
import type { SnapshotStorage } from '../../learn/store';
import { SettingsBlock } from './SettingsBlock';

/** In-memory SnapshotStorage that records the last saved blob. */
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

function renderBlock(storage: SnapshotStorage) {
  return render(
    <SettingsProvider storage={storage}>
      <SettingsBlock />
    </SettingsProvider>,
  );
}

describe('SettingsBlock (design 5c)', () => {
  test('shows only the two wired settings — not the three unbuilt ones', async () => {
    const { getByTestId, queryByText } = renderBlock(memoryStorage());
    await act(async () => {}); // flush the async settings load
    expect(getByTestId('setting-notation-medium')).toBeTruthy();
    expect(getByTestId('setting-hand-right')).toBeTruthy();
    // The unbuilt settings must not appear as fake controls (why: a toggle that
    // changes nothing is a lie — they're deferred, not shipped inert).
    expect(queryByText(/Terminology/i)).toBeNull();
    expect(queryByText(/Colour-vision/i)).toBeNull();
    expect(queryByText(/Audio on feedback/i)).toBeNull();
  });

  test('choosing a notation size persists it', async () => {
    const storage = memoryStorage();
    const { getByTestId } = renderBlock(storage);
    await act(async () => {}); // let the async settings load resolve before interacting
    fireEvent.press(getByTestId('setting-notation-large'));
    await waitFor(() => {
      expect(storage.blob).not.toBeNull();
      expect(JSON.parse(storage.blob!).settings.notationScale).toBe('large');
    });
  });

  test('choosing left-handed input persists it', async () => {
    const storage = memoryStorage();
    const { getByTestId } = renderBlock(storage);
    await act(async () => {});
    fireEvent.press(getByTestId('setting-hand-left'));
    await waitFor(() => {
      expect(storage.blob).not.toBeNull();
      expect(JSON.parse(storage.blob!).settings.handedness).toBe('left');
    });
  });
});
