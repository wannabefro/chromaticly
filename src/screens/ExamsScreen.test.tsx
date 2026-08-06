// U6 acceptance tests for the Exams tab (design 3b's paper reached directly from the
// tab bar). Free grade access (fyu.3): the gate is advisory, not star-gated. Same
// hasPaper rule as the level map's inline gate — a paper must never be quietly
// openable from one surface but not the other.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, render, within } from '@testing-library/react-native';

import { LESSONS_BY_GRADE, lessonById } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { daysSinceEpoch } from '../learn/clock';
import { atomsFor } from '../learn/lane-depth';
import { MASTERY_THRESHOLD } from '../learn/mastery';
import { ProgressProvider } from '../learn/ProgressContext';
import { initialSrs } from '../learn/srs';
import { ProgressStore, type SnapshotStorage } from '../learn/store';
import ExamsScreen from './ExamsScreen';

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

function masterAtoms(store: ProgressStore, atoms: string[]): void {
  for (const atom of atoms) {
    store.setAtom(atom, { mastery: { streak: MASTERY_THRESHOLD, mastered: true }, srs: initialSrs() });
  }
}

function seedBlob(mutate: (store: ProgressStore) => void): string {
  const store = new ProgressStore();
  mutate(store);
  return JSON.stringify(store.toSnapshot());
}

function renderExams(seed: string | null = null) {
  return render(
    <ProgressProvider storage={memoryStorage(seed)}>
      <ExamsScreen />
    </ProgressProvider>,
  );
}

describe('ExamsScreen — only unlocked levels get a gate (mirrors the map, R-parity)', () => {
  // fyu.2/chromaticly-ehp: reachability is content presence, not an exam gate
  // — every grade 1-5 has content now (Grade 5 shipped its slice), so all five
  // gates list immediately. There is no content-less level left to omit.
  test('a fresh store lists a gate for every content-ful level (1-5) — no content-less level is left to omit', async () => {
    const { findByTestId, queryByTestId } = renderExams();
    await findByTestId('exams-screen');

    expect(queryByTestId('exam-gate-level-1')).toBeTruthy();
    expect(queryByTestId('exam-gate-level-2')).toBeTruthy();
    expect(queryByTestId('exam-gate-level-3')).toBeTruthy();
    expect(queryByTestId('exam-gate-level-4')).toBeTruthy();
    expect(queryByTestId('exam-gate-level-5')).toBeTruthy();
  });

  test('the Level-2 gate is sealed "Coming soon" on a fresh store — no grade-2 exam paper exists yet (D8), independent of any exam-clear state', async () => {
    const seed = seedBlob((store) => {
      masterAtoms(store, lessonById('key-signatures-2')!.atoms);
      store.setLesson('key-signatures-2', { completed: true });
    });
    const { findByTestId, getByTestId } = renderExams(seed);
    await findByTestId('exams-screen');

    const gate = getByTestId('exam-gate-level-2');
    expect(gate.props.onPress).toBeUndefined();
    expect(within(gate).getByText('Coming soon')).toBeTruthy();
  });

  test('the Level 1 gate opens on a fresh store — a real paper is advisory, not star-gated (fyu.3)', async () => {
    const { findByTestId, getByTestId, queryByTestId } = renderExams();
    await findByTestId('exams-screen');

    fireEvent.press(getByTestId('exam-gate-level-1'));
    expect(queryByTestId('exam-start')).toBeTruthy();
  });

  // chromaticly-ehp: Grade 5 shipping content gets it a gate row like every
  // other level, but no Grade-5 exam paper exists yet (hasExamPaper(5) is
  // false) — same sealed "Coming soon" state as the Level-2/3/4 gates, not
  // the old "no gate row at all" behavior a content-less grade had.
  test('the Level-5 gate is sealed "Coming soon" on a fresh store — no grade-5 exam paper exists yet', async () => {
    const { findByTestId, getByTestId } = renderExams();
    await findByTestId('exams-screen');

    const gate = getByTestId('exam-gate-level-5');
    expect(gate.props.onPress).toBeUndefined();
    expect(within(gate).getByText('Coming soon')).toBeTruthy();
  });
});

// Sanity: Level 2's own threshold/unit-count numbers still come off the real content,
// unaffected by the sealed-paper state (D8 only gates onPress + copy, not the numbers).
describe('ExamsScreen — Level 2 sizing still derives from LESSONS_BY_GRADE[2]', () => {
  test('LEVELS[1] has one unit per grade-2 lesson (moves only at content growth, not by surprise)', () => {
    expect(LEVELS.find((l) => l.grade === 2)!.unitIds).toHaveLength(LESSONS_BY_GRADE[2].length);
  });
});

// G6 U8 (7d). The Exams tab now leads with readiness read off the whole depth
// vector, and it is the only place a paper is reached once the level map goes
// (U12). Two invariants matter more than the copy: it never blocks, and it never
// invents a shortfall in a strand the paper does not examine.
describe('ExamsScreen — readiness over the depth vector (7d)', () => {
  const TODAY = daysSinceEpoch(Date.now());

  /** Master a whole (strand, grade) cell, reviewed today so it is not stale (R5).
   *  `initialSrs()` would stamp day zero and decay the cell away before readiness
   *  ever saw it — the fixture has to mean what it says. */
  function holdCell(store: ProgressStore, strand: Parameters<typeof atomsFor>[0], grade: number): void {
    for (const atom of atomsFor(strand, grade)) {
      store.setAtom(atom, {
        mastery: { streak: MASTERY_THRESHOLD, mastered: true },
        srs: { box: 2, lastReviewed: TODAY, nextDue: TODAY + 2 },
      });
    }
  }

  test('a fresh learner sees the readiness card, with every examined skill short', async () => {
    const { findByTestId } = renderExams();
    await findByTestId('exams-screen');

    expect(await findByTestId('readiness-card')).toBeTruthy();
    expect(await findByTestId('readiness-card-short-rhythm')).toBeTruthy();
    expect(await findByTestId('readiness-card-short-terms_signs')).toBeTruthy();
  });

  // R6: the paper is startable at any depth. Asserted at the shallowest possible
  // state, because that is the state a gate would have blocked.
  test('the paper is startable at depth 0 — readiness informs, it never gates', async () => {
    const { findByTestId } = renderExams();
    const sit = await findByTestId('readiness-card-sit');

    expect(sit).toBeTruthy();
    expect(sit.props.accessibilityState?.disabled).toBeFalsy();
    await act(async () => {
      fireEvent.press(sit);
    });
    // The runner's pre-paper screen — reaching it is the proof nothing gated.
    expect(await findByTestId('exam-begin')).toBeTruthy();
  });

  // KTD8 at the surface a learner actually reads. Chords teaches nothing below
  // grade 4 and the paper has no chords section, so it must never be listed as a
  // thing holding them back.
  test('chords is reported as not examined, never as a shortfall', async () => {
    const { findByTestId, queryByTestId } = renderExams(
      seedBlob((store) => {
        for (const strand of ['rhythm', 'pitch', 'scales_keys', 'intervals', 'terms_signs'] as const) {
          holdCell(store, strand, 1);
        }
      }),
    );
    await findByTestId('exams-screen');

    expect(await findByTestId('readiness-card-not-examined')).toHaveTextContent('Chords', { exact: false });
    expect(queryByTestId('readiness-card-short-chords')).toBeNull();
    expect(await findByTestId('readiness-card-headline')).toHaveTextContent('Every skill this paper asks about', {
      exact: false,
    });
  });

  test('tapping a short skill crosses to that lane, carrying the strand', async () => {
    const onOpenLane = jest.fn();
    const { findByTestId } = render(
      <ProgressProvider storage={memoryStorage(null)}>
        <ExamsScreen onOpenLane={onOpenLane} />
      </ProgressProvider>,
    );

    fireEvent.press(await findByTestId('readiness-card-short-pitch'));
    expect(onOpenLane).toHaveBeenCalledWith('pitch');
  });

  // R2: nothing is locked, so the level list is the whole set. The old screen
  // filtered on `isLevelUnlocked`, drawing a distinction that no longer exists.
  test('every EXAMINABLE level is listed, and the source no longer consults isLevelUnlocked', async () => {
    const { findByTestId } = renderExams();
    await findByTestId('exams-screen');

    // Every level that has a gate. First steps has none — see the First steps
    // describe below for why absence rather than a "coming soon" row.
    for (const level of LEVELS.filter((l) => l.examGate != null)) {
      expect(await findByTestId(`exam-gate-${level.id}`)).toBeTruthy();
    }
    const source = readFileSync(join(__dirname, 'ExamsScreen.tsx'), 'utf8');
    expect(source).not.toMatch(/\bisLevelUnlocked\b/);
  });
});

// First steps (chromaticly-dhe) has no exam paper and never will — ABRSM has no
// Grade 0 theory exam. A "coming soon" row for it would advertise something that
// does not exist, so the screen filters on the gate's presence rather than on the
// grade number: the field is the fact, the number is only a proxy for it.
describe('Exams — a level that cannot be sat gets no row', () => {
  test('it renders one gate per examinable level, and none for First steps', async () => {
    const { findByTestId, queryByTestId } = renderExams();
    await findByTestId('exams-screen');

    expect(queryByTestId('exam-gate-level-0')).toBeNull();
    for (const level of LEVELS.filter((l) => l.examGate != null)) {
      expect(queryByTestId(`exam-gate-${level.id}`)).toBeTruthy();
    }
  });

  test('the level with no gate is genuinely in LEVELS — the row is filtered, not the level', () => {
    expect(LEVELS.some((l) => l.grade === 0)).toBe(true);
    expect(LEVELS.find((l) => l.grade === 0)!.examGate).toBeUndefined();
  });
});
