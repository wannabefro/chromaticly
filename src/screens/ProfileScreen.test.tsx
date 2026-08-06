// 302.8 — Profile (design 5c). The screen whose whole job is telling the learner where
// they stand, so the numbers on it have to be true: readiness is derived from the same
// stars the exam gate itself counts, and it must never claim the paper is open when it
// is not (or the reverse).

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { LESSONS, LESSONS_BY_GRADE } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { daysSinceEpoch } from '../learn/clock';
import { ProgressProvider } from '../learn/ProgressContext';
import { initialSrs } from '../learn/srs';
import { ProgressStore, type SnapshotStorage } from '../learn/store';
import ProfileScreen from './ProfileScreen';

/** A snapshot with every atom of `masteredLessons` mastered AND reviewed today.
 *
 *  The review date is not decoration. Readiness reads lane depth, and a lane decays
 *  when its atoms go stale (R5) — so an atom stamped `initialSrs()` (reviewed on day
 *  zero) reads as years overdue against the real clock and drops its whole cell,
 *  making a fully-mastered fixture report five shortfalls. The old star-based
 *  readiness ignored SRS entirely and never noticed. Stamping a real review day is
 *  what makes "mastered" mean mastered here. */
function seeded(masteredLessons: string[]): string {
  const store = new ProgressStore();
  const today = daysSinceEpoch(Date.now());
  store.setProfile({ grade: 1, onboardedAt: '2026-07-14T00:00:00.000Z' });
  for (const lesson of LESSONS_BY_GRADE[1]) {
    if (!masteredLessons.includes(lesson.id)) continue;
    store.setLesson(lesson.id, { completed: true });
    for (const atom of lesson.atoms) {
      store.setAtom(atom, {
        mastery: { streak: 3, mastered: true },
        srs: { box: 2, lastReviewed: today, nextDue: today + 2 },
      });
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

describe('ProfileScreen — where the learner stands (5c, readiness amended by 7d)', () => {
  // Readiness stopped being a percentage at G6 U8. The percentage answered "how far
  // through grade 1 are you"; these answer the question a learner about to sit a
  // paper actually has — which skills does it ask about, and where am I short.
  test('a fresh learner is told which skills the paper asks about and what being short costs', async () => {
    const { getByTestId } = renderProfile(seeded([]));

    await waitFor(() => expect(getByTestId('profile-readiness-card')).toBeTruthy());
    expect(getByTestId('profile-readiness-card-headline')).toHaveTextContent('below grade 1', { exact: false });
    expect(getByTestId('profile-readiness-card-headline')).toHaveTextContent('20 of 20 marks', { exact: false });
    expect(getByTestId('profile-readiness-card-short-rhythm')).toBeTruthy();
  });

  test('mastering every grade-1 lesson clears every shortfall', async () => {
    const { getByTestId, queryByTestId } = renderProfile(seeded(LEVEL1.unitIds));

    await waitFor(() => expect(getByTestId('profile-readiness-card')).toBeTruthy());
    expect(getByTestId('profile-readiness-card-headline')).toHaveTextContent('Every skill this paper asks about', { exact: false });
    expect(queryByTestId('profile-readiness-card-short-rhythm')).toBeNull();
    expect(queryByTestId('profile-readiness-card-short-pitch')).toBeNull();
  });

  // KTD8, the false-shortfall regression, asserted where a learner would meet it.
  // Chords teaches nothing below grade 4 and the paper has no chords section, so a
  // learner who has mastered all of grade 1 must not be told chords holds them back.
  test('chords and context are named as NOT EXAMINED, never as shortfalls', async () => {
    const { getByTestId, queryByTestId } = renderProfile(seeded(LEVEL1.unitIds));

    await waitFor(() => expect(getByTestId('profile-readiness-card')).toBeTruthy());
    expect(getByTestId('profile-readiness-card-not-examined')).toHaveTextContent('Chords', { exact: false });
    expect(getByTestId('profile-readiness-card-not-examined')).toHaveTextContent('Context', { exact: false });
    expect(queryByTestId('profile-readiness-card-short-chords')).toBeNull();
    expect(queryByTestId('profile-readiness-card-short-context')).toBeNull();
  });

  test('a short skill is one tap from the lane that repairs it', async () => {
    const onDrillStrand = jest.fn();
    const { getByTestId } = render(
      <ProgressProvider storage={memoryStorage(seeded([]))}>
        <ProfileScreen onDrillStrand={onDrillStrand} />
      </ProgressProvider>,
    );

    await waitFor(() => expect(getByTestId('profile-readiness-card-short-rhythm')).toBeTruthy());
    fireEvent.press(getByTestId('profile-readiness-card-short-rhythm'));
    expect(onDrillStrand).toHaveBeenCalledWith('rhythm');
  });

  test('the fact collection counts what has actually been collected, across every content-ful grade (1-5), not just the working grade', async () => {
    const { getByTestId } = renderProfile(seeded([]));
    // Derived from LESSONS, not a hand-summed grade list. The screen's own rule is
    // "the collection is the whole curriculum", and First steps (grade 0) joined it
    // — its lessons draw real stars and real mastery, so a collection that ignored
    // them would sit still while the learner finished five lessons.
    const totalContentfulLessons = LESSONS.length;
    await waitFor(() => expect(getByTestId('profile-facts')).toHaveTextContent(`0 of ${totalContentfulLessons}`));
  });

  // fyu.2 supersedes D13 phase 2's exam-gated variant: grade-2 through grade-5
  // join the fact-card total and strand radar ALREADY on a fresh store —
  // content presence is the only gate now, so recording an exam clear moves nothing.
  test('grades 2-5 already join the fact-card total and strand radar on a fresh store; recording the grade-1 exam changes nothing', async () => {
    // Derived from LESSONS, not a hand-summed grade list. The screen's own rule is
    // "the collection is the whole curriculum", and First steps (grade 0) joined it
    // — its lessons draw real stars and real mastery, so a collection that ignored
    // them would sit still while the learner finished five lessons.
    const totalContentfulLessons = LESSONS.length;
    const fresh = renderProfile(seeded(['key-signatures']));
    await waitFor(() => expect(fresh.getByTestId('profile-facts')).toHaveTextContent(`0 of ${totalContentfulLessons}`));

    // Since G6 U4 the radar is a projection of `laneDepths` (R3): held grades over
    // CONTENT-BEARING grades. `key-signatures` is the whole grade-1 scales_keys
    // cell. `key-signatures` is one of THREE scales_keys lessons at grade 1 now
    // (degrees-1 and tonic-triads-1 joined it), so grade 1 is only partly held —
    // laneDepths counts a grade as held when every atom in it is, which makes
    // the ratio 0 of five content grades.
    //
    // This read 0% until the fixture started stamping a real review date, and it was
    // right by accident: every atom was written with `initialSrs()` (reviewed on day
    // zero), so the cell was held and then decayed away (R5) before the radar saw
    // it. A fixture that says "mastered" and renders "0%" was hiding the decay rule
    // rather than testing the ratio.
    const expectedPct = 0;
    await waitFor(() =>
      expect(within(fresh.getByTestId('radar-legend-scales_keys')).getByText(`${expectedPct}%`)).toBeTruthy(),
    );

    const store = new ProgressStore();
    store.setProfile({ grade: 1, onboardedAt: '2026-07-14T00:00:00.000Z' });
    for (const lesson of LESSONS_BY_GRADE[1]) {
      if (lesson.id !== 'key-signatures') continue;
      store.setLesson(lesson.id, { completed: true });
      const today = daysSinceEpoch(Date.now());
      for (const atom of lesson.atoms) {
        store.setAtom(atom, { mastery: { streak: 3, mastered: true }, srs: { box: 2, lastReviewed: today, nextDue: today + 2 } });
      }
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

  // R1/F8: there is no single current grade any more, so nothing on this screen may
  // assert one. Asserted as ABSENCE of the three surfaces that did — a heading, a
  // five-pill switcher and a working-grade row — because a screen that quietly grew
  // one back would otherwise look fine.
  test('no grade heading, no grade pills, no working-grade row (R1)', async () => {
    const { findByTestId, queryByTestId, queryByText } = renderProfile(seeded([]));
    await findByTestId('profile-screen');

    for (const grade of [1, 2, 3, 4, 5]) {
      expect(queryByTestId(`profile-grade-${grade}`)).toBeNull();
    }
    expect(queryByTestId('profile-grade-note')).toBeNull();
    expect(queryByTestId('profile-working-grade')).toBeNull();
    expect(queryByTestId('profile-working-grade-picker')).toBeNull();
    expect(queryByText('Grade 1')).toBeNull();
  });
});

// The two derivations U12 deletes. Profile was their last non-map caller, so this
// asserts the import is gone rather than that the screen renders — a lingering
// import compiles fine and would silently block U12.
describe('ProfileScreen — the level-gate derivations are unreferenced (precondition for U12)', () => {
  test('the source imports neither currentLevel nor isLevelUnlocked', () => {
    const source = readFileSync(join(__dirname, 'ProfileScreen.tsx'), 'utf8');
    expect(source).not.toMatch(/\bcurrentLevel\b/);
    expect(source).not.toMatch(/\bisLevelUnlocked\b/);
  });
});
