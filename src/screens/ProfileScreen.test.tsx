// 302.8 — Profile (design 5c). The screen whose whole job is telling the learner where
// they stand, so the numbers on it have to be true: readiness is derived from the same
// stars the exam gate itself counts, and it must never claim the paper is open when it
// is not (or the reverse).

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { render, waitFor } from '@testing-library/react-native';

import { LESSONS_BY_GRADE } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { ProgressProvider } from '../learn/ProgressContext';
import { initialSrs } from '../learn/srs';
import { ProgressStore, type SnapshotStorage } from '../learn/store';
import ProfileScreen from './ProfileScreen';

/** A snapshot with every atom of `masteredLessons` mastered. */
function seeded(masteredLessons: string[]): string {
  const store = new ProgressStore();
  store.setProfile({ grade: 1, onboardedAt: '2026-07-14T00:00:00.000Z' });
  for (const lesson of LESSONS_BY_GRADE[1]) {
    store.unlock(lesson.id);
    if (!masteredLessons.includes(lesson.id)) continue;
    store.setLesson(lesson.id, { completed: true });
    for (const atom of lesson.atoms) {
      store.setAtom(atom, { mastery: { streak: 3, mastered: true }, srs: initialSrs() });
    }
  }
  return JSON.stringify(store.toSnapshot());
}

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

function renderProfile(blob: string | null) {
  return render(
    <ProgressProvider storage={memoryStorage(blob)}>
      <ProfileScreen />
    </ProgressProvider>,
  );
}

const LEVEL1 = LEVELS.find((l) => l.unlocked)!;

describe('ProfileScreen — where the learner stands (5c)', () => {
  test('a fresh learner is 0% ready and is told what holds them back', async () => {
    const { getByTestId } = renderProfile(seeded([]));

    await waitFor(() => expect(getByTestId('readiness-percent')).toHaveTextContent('0%'));
    expect(getByTestId('readiness-note')).not.toHaveTextContent('The practice paper is open.');
  });

  // The one thing this screen must never do: claim the paper is open when the gate is
  // shut, or shut when it is open. Both come from the same star count.
  test('readiness agrees with the exam gate, because it is the same star count', async () => {
    const { getByTestId } = renderProfile(seeded(LEVEL1.unitIds));

    await waitFor(() => expect(getByTestId('readiness-percent')).toHaveTextContent('100%'));
    expect(getByTestId('readiness-note')).toHaveTextContent('The practice paper is open.');
  });

  test('partial mastery reads as partial, not as ready', async () => {
    const half = LEVEL1.unitIds.slice(0, Math.floor(LEVEL1.unitIds.length / 2));
    const { getByTestId } = renderProfile(seeded(half));

    await waitFor(() => {
      const percent = getByTestId('readiness-percent').props.children.join('');
      expect(Number(percent.replace('%', ''))).toBeGreaterThan(0);
      expect(Number(percent.replace('%', ''))).toBeLessThan(100);
    });
    expect(getByTestId('readiness-note')).not.toHaveTextContent('The practice paper is open.');
  });

  test('the fact collection counts what has actually been collected', async () => {
    const { getByTestId } = renderProfile(seeded([]));
    await waitFor(() => expect(getByTestId('profile-facts')).toHaveTextContent(`0 of ${LESSONS_BY_GRADE[1].length}`));
  });

  // Design 6b (302.13): a named account shows its name, a guest still shows "Guest".
  test('a named account shows the name in place of Guest', async () => {
    const store = new ProgressStore();
    store.setProfile({ grade: 1, onboardedAt: '2026-07-18T00:00:00.000Z', name: 'Maya' });
    const { getByText, queryByText } = renderProfile(JSON.stringify(store.toSnapshot()));
    await waitFor(() => expect(getByText('Maya')).toBeTruthy());
    expect(queryByText('Guest')).toBeNull();
  });

  test('a guest (no name) still shows "Guest"', async () => {
    const { getByText } = renderProfile(seeded([]));
    await waitFor(() => expect(getByText('Guest')).toBeTruthy());
  });

  // Only Grade 1 has content, so the profile says so rather than offering a switch that
  // would land the learner in an empty grade.
  test('grades without content are shown locked, not offered', async () => {
    const { getByTestId } = renderProfile(seeded([]));
    await waitFor(() => expect(getByTestId('profile-grade-1')).toBeTruthy());

    expect(getByTestId('profile-grade-note')).toHaveTextContent('Only Grade 1 has content so far — Grades 2–5 are coming.');
    for (const level of LEVELS.filter((l) => !l.unlocked)) {
      expect(getByTestId(`profile-grade-${level.grade}`)).toBeTruthy();
    }
  });
});
