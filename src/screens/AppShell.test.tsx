// 302.7 — the tab shell (design 2a). Before this the level map WAS the app: Practice
// had a route nothing linked to and the exam could only be reached by scrolling to the
// bottom of the map. What must hold is that all four tabs are reachable, and that the
// bar gets out of the way when a screen takes over — an exam paper offering a tab out
// of itself mid-paper would be a way to dodge the clock.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
import AppShell from './AppShell';

function memoryStorage(): SnapshotStorage & { blob: string | null } {
  return {
    blob: null,
    async load() {
      return this.blob;
    },
    async save(serialized: string) {
      this.blob = serialized;
    },
  };
}

function renderShell() {
  return render(
    <ProgressProvider storage={memoryStorage()}>
      <AppShell />
    </ProgressProvider>,
  );
}

describe('AppShell — the tab shell (302.7)', () => {
  test('opens on Learn, with all four tabs reachable', async () => {
    const { getByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    expect(getByTestId('tab-learn').props.accessibilityState?.selected).toBe(true);
    for (const tab of ['learn', 'practice', 'exams', 'profile']) {
      expect(getByTestId(`tab-${tab}`)).toBeTruthy();
    }
  });

  test('each tab shows its own screen', async () => {
    const { getByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-exams')));
    await waitFor(() => expect(getByTestId('exams-screen')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-profile')));
    await waitFor(() => expect(getByTestId('profile-screen')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-learn')));
    await waitFor(() => expect(getByTestId('level-map-screen')).toBeTruthy());
  });

  // An exercise is immersive, and an exam paper especially so: a tab bar over a timed
  // paper is a way to walk out of it mid-question. The bar gets out of the way.
  test('the tab bar disappears once a lesson takes over the screen', async () => {
    const { getByTestId, queryByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    // fyu.3: the tap now also switches the working grade (setGrade), so the
    // handler is async — await it inside act() rather than firing bare.
    await act(async () => {
      fireEvent.press(getByTestId('unit-row-treble-notes'));
    });

    await waitFor(() => expect(getByTestId('set-runner')).toBeTruthy());
    expect(queryByTestId('tab-bar')).toBeNull();
  });

  // Profile's readiness card is about the paper, so it takes you there.
  test('Profile’s exam-readiness card opens the Exams tab', async () => {
    const { getByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-profile')));
    await waitFor(() => expect(getByTestId('profile-readiness')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('profile-readiness')));
    await waitFor(() => expect(getByTestId('exams-screen')).toBeTruthy());
  });
});
