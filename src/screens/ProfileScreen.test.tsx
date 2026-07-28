// 302.8 — Profile (design 5c). The screen whose whole job is telling the learner where
// they stand, so the numbers on it have to be true: readiness is derived from the same
// stars the exam gate itself counts, and it must never claim the paper is open when it
// is not (or the reverse).

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

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

function renderProfileCapturingStorage(blob: string | null) {
  const storage = memoryStorage(blob);
  const utils = render(
    <ProgressProvider storage={storage}>
      <ProfileScreen />
    </ProgressProvider>,
  );
  return { ...utils, storage };
}

const LEVEL1 = LEVELS.find((l) => l.grade === 1)!; // Level 1 is unconditionally unlocked (D5)

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

  // fyu.2/chromaticly-ehp: reachability is content presence (`isLevelUnlocked`),
  // not the working grade — every grade 1-5 is reachable on a fresh store now
  // that Grade 5 shipped its content, so the fact-card denominator spans every
  // content-ful grade's lessons from the start.
  test('the fact collection counts what has actually been collected, across every content-ful grade (1-5), not just the working grade', async () => {
    const { getByTestId } = renderProfile(seeded([]));
    const totalContentfulLessons =
      LESSONS_BY_GRADE[1].length +
      LESSONS_BY_GRADE[2].length +
      LESSONS_BY_GRADE[3].length +
      LESSONS_BY_GRADE[4].length +
      LESSONS_BY_GRADE[5].length;
    await waitFor(() => expect(getByTestId('profile-facts')).toHaveTextContent(`0 of ${totalContentfulLessons}`));
  });

  // fyu.2 supersedes D13 phase 2's exam-gated variant: grade-2 through grade-5
  // join the fact-card total and strand radar ALREADY on a fresh store —
  // content presence is the only gate now, so recording an exam clear moves nothing.
  test('grades 2-5 already join the fact-card total and strand radar on a fresh store; recording the grade-1 exam changes nothing', async () => {
    const totalContentfulLessons =
      LESSONS_BY_GRADE[1].length +
      LESSONS_BY_GRADE[2].length +
      LESSONS_BY_GRADE[3].length +
      LESSONS_BY_GRADE[4].length +
      LESSONS_BY_GRADE[5].length;
    const fresh = renderProfile(seeded(['key-signatures']));
    await waitFor(() => expect(fresh.getByTestId('profile-facts')).toHaveTextContent(`0 of ${totalContentfulLessons}`));

    // Since G6 U4 the radar is a projection of `laneDepths` (R3), so its unit is
    // the GRADE CELL, not the atom: one lesson of a multi-lesson grade-1 cell does
    // not hold that cell, and the lane reads 0% until it does.
    const expectedPct = 0;
    await waitFor(() =>
      expect(within(fresh.getByTestId('radar-legend-scales_keys')).getByText(`${expectedPct}%`)).toBeTruthy(),
    );

    const store = new ProgressStore();
    store.setProfile({ grade: 1, onboardedAt: '2026-07-14T00:00:00.000Z' });
    for (const lesson of LESSONS_BY_GRADE[1]) {
      if (lesson.id !== 'key-signatures') continue;
      store.setLesson(lesson.id, { completed: true });
      for (const atom of lesson.atoms) store.setAtom(atom, { mastery: { streak: 3, mastered: true }, srs: initialSrs() });
    }
    store.recordExamCleared(1);
    const afterExam = renderProfile(JSON.stringify(store.toSnapshot()));
    await waitFor(() => expect(afterExam.getByTestId('profile-facts')).toHaveTextContent(`0 of ${totalContentfulLessons}`));
    await waitFor(() =>
      expect(within(afterExam.getByTestId('radar-legend-scales_keys')).getByText(`${expectedPct}%`)).toBeTruthy(),
    );
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

  // fyu.3 / chromaticly-ehp: every grade (1-5) now has content and is a free
  // choice, not a gated climb — the note says all grades are open, no lock.
  test('every grade renders as a free, open choice — no locked/coming-soon grade', async () => {
    const { getByTestId } = renderProfile(seeded([]));
    await waitFor(() => expect(getByTestId('profile-grade-1')).toBeTruthy());

    expect(getByTestId('profile-grade-note')).toHaveTextContent(
      'All five grades are open — switch any time, and your progress is kept.',
    );
    for (const level of LEVELS.filter((l) => l.grade !== 1)) {
      expect(getByTestId(`profile-grade-${level.grade}`)).toBeTruthy();
    }
  });
});

// fyu.3: the "Working grade" settings row (design 5c) is the profile-side switch —
// same `setGrade` the level map's taps use, so this is never a second rule.
describe('ProfileScreen — Working grade switch (design 5c, fyu.3)', () => {
  test('tapping the working-grade row opens a picker of startable grades', async () => {
    const { getByTestId, findByTestId, queryByTestId } = renderProfile(seeded([]));
    await findByTestId('profile-screen');

    expect(getByTestId('profile-working-grade')).toHaveTextContent('Grade 1', { exact: false });
    expect(queryByTestId('profile-working-grade-picker')).toBeNull();

    fireEvent.press(getByTestId('profile-working-grade'));
    expect(getByTestId('profile-working-grade-picker')).toBeTruthy();
    expect(getByTestId('profile-working-grade-option-2')).toBeTruthy();
    expect(getByTestId('profile-working-grade-option-3')).toBeTruthy();
  });

  test('choosing a grade from the picker switches the working grade and persists it', async () => {
    const { getByTestId, findByTestId, storage } = renderProfileCapturingStorage(seeded([]));
    await findByTestId('profile-screen');

    fireEvent.press(getByTestId('profile-working-grade'));
    await act(async () => {
      fireEvent.press(getByTestId('profile-working-grade-option-2'));
    });

    await waitFor(() => expect(getByTestId('profile-working-grade')).toHaveTextContent('Grade 2', { exact: false }));
    await waitFor(() => {
      expect(storage.blob).not.toBeNull();
      expect(JSON.parse(storage.blob!).profile.grade).toBe(2);
    });
    // Everything else — the readiness card, the grade-1 pill — reads the new
    // working grade too, not a second, disagreeing source of truth.
    expect(getByTestId('profile-grade-2')).toBeTruthy();
  });
});
