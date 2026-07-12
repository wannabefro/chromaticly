// U10 acceptance for the Day-1 dashboard (6d): the onboarded landing shows the
// Begin hero and the full 7-strand mastery row (A12), and Begin launches the set
// runner in place. WebView mocked like the other exercise-loop tests.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
import DashboardScreen from './DashboardScreen';

function memoryStorage(): SnapshotStorage {
  let blob: string | null = null;
  return {
    async load() {
      return blob;
    },
    async save(serialized: string) {
      blob = serialized;
    },
  };
}

const ALL_STRANDS = ['rhythm', 'pitch', 'scales_keys', 'intervals', 'chords', 'terms_signs', 'context'];

function renderDashboard() {
  return render(
    <ProgressProvider storage={memoryStorage()}>
      <DashboardScreen />
    </ProgressProvider>,
  );
}

describe('DashboardScreen — Day-1 landing (6d)', () => {
  test('shows the Begin hero and all 7 strands (A12: mastery visible on the dashboard)', async () => {
    const { getByTestId } = renderDashboard();
    await act(async () => {});

    expect(getByTestId('dashboard-screen')).toBeTruthy();
    expect(getByTestId('begin-hero')).toBeTruthy();
    expect(getByTestId('strand-mastery')).toBeTruthy();
    for (const s of ALL_STRANDS) {
      expect(getByTestId(`strand-${s}`)).toBeTruthy();
    }
  });

  test('Begin launches the set runner in place', async () => {
    const { getByTestId, queryByTestId } = renderDashboard();
    await act(async () => {});

    await act(async () => {
      fireEvent.press(getByTestId('begin-lesson'));
    });

    expect(getByTestId('set-runner')).toBeTruthy();
    expect(queryByTestId('dashboard-screen')).toBeNull();
  });
});
