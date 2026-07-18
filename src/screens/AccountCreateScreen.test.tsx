import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ProgressProvider } from '../learn/ProgressContext';
import { ProgressStore, type SnapshotStorage } from '../learn/store';
import { AccountCreateScreen } from './AccountCreateScreen';

function memoryStorage(blob: string | null): SnapshotStorage & { blob: string | null } {
  return {
    blob,
    async load() {
      return this.blob;
    },
    async save(serialized: string) {
      this.blob = serialized;
    },
  };
}

/** A named account is an upgrade of an already-onboarded profile (setName no-ops otherwise). */
function onboardedBlob(): string {
  const store = new ProgressStore();
  store.setProfile({ grade: 1, onboardedAt: '2026-07-18T00:00:00.000Z' });
  return JSON.stringify(store.toSnapshot());
}

async function renderScreen() {
  const onCreated = jest.fn();
  const onCancel = jest.fn();
  const storage = memoryStorage(onboardedBlob());
  const utils = render(
    <ProgressProvider storage={storage}>
      <AccountCreateScreen onCreated={onCreated} onCancel={onCancel} />
    </ProgressProvider>,
  );
  await act(async () => {}); // let the settings/progress load resolve before interacting
  return { onCreated, onCancel, storage, ...utils };
}

describe('AccountCreateScreen (design 6b, 302.13)', () => {
  test('Continue is disabled until a name is entered — an empty submit creates nothing', async () => {
    const { getByTestId, onCreated, storage } = await renderScreen();
    fireEvent.press(getByTestId('account-create-submit')); // disabled → no-op
    expect(onCreated).not.toHaveBeenCalled();
    expect(storage.blob).not.toContain('"name"');
  });

  test('entering a name creates the account (persisted) and calls onCreated', async () => {
    const { getByTestId, onCreated, storage } = await renderScreen();
    fireEvent.changeText(getByTestId('account-name-input'), 'Maya');
    fireEvent.press(getByTestId('account-create-submit'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(JSON.parse(storage.blob as string).profile.name).toBe('Maya');
  });

  test('a whitespace-padded name is trimmed before persisting', async () => {
    const { getByTestId, storage } = await renderScreen();
    fireEvent.changeText(getByTestId('account-name-input'), '  Maya  ');
    fireEvent.press(getByTestId('account-create-submit'));
    await waitFor(() => expect(JSON.parse(storage.blob as string).profile.name).toBe('Maya'));
  });

  // KTD7: bailing out must NOT create an account (so the nudge stays eligible later).
  test('backing out creates no account and calls onCancel', async () => {
    const { getByTestId, onCancel, onCreated, storage } = await renderScreen();
    fireEvent.press(getByTestId('account-create-back'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();
    expect(storage.blob).not.toContain('"name"');
  });

  // Honest-copy guard: no auth/email/OAuth/sync language ships (the whole point of the plan).
  test('never shows password / email / OAuth / sync affordances', async () => {
    const { queryByText } = await renderScreen();
    expect(queryByText(/password/i)).toBeNull();
    expect(queryByText(/email/i)).toBeNull();
    expect(queryByText(/sync/i)).toBeNull();
    expect(queryByText(/Apple|Google/)).toBeNull();
  });
});
