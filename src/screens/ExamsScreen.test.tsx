// U6 acceptance tests for the Exams tab (design 3b's paper reached directly from the
// tab bar). Free grade access (fyu.3): the gate is advisory, not star-gated. Same
// hasPaper rule as the level map's inline gate — a paper must never be quietly
// openable from one surface but not the other.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { fireEvent, render, within } from '@testing-library/react-native';

import { LESSONS_BY_GRADE, lessonById } from '../content/lessons';
import { LEVELS } from '../content/levels';
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
  // fyu.2: reachability is content presence, not an exam gate — a fresh store
  // already has Levels 1-3 reachable (each has content), so all three gates
  // list immediately; content-less Levels 4-5 still never get a gate.
  test('a fresh store lists a gate for every content-ful level (1, 2, 3), and nothing for content-less Levels 4-5', async () => {
    const { findByTestId, queryByTestId } = renderExams();
    await findByTestId('exams-screen');

    expect(queryByTestId('exam-gate-level-1')).toBeTruthy();
    expect(queryByTestId('exam-gate-level-2')).toBeTruthy();
    expect(queryByTestId('exam-gate-level-3')).toBeTruthy();
    expect(queryByTestId('exam-gate-level-4')).toBeNull();
    expect(queryByTestId('exam-gate-level-5')).toBeNull();
  });

  test('the Level-2 gate is sealed "Coming soon" on a fresh store — no grade-2 exam paper exists yet (D8), independent of any exam-clear state', async () => {
    const seed = seedBlob((store) => {
      store.unlock('key-signatures-2');
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
});

// Sanity: Level 2's own threshold/unit-count numbers still come off the real content,
// unaffected by the sealed-paper state (D8 only gates onPress + copy, not the numbers).
describe('ExamsScreen — Level 2 sizing still derives from LESSONS_BY_GRADE[2]', () => {
  test('LEVELS[1] has one unit per grade-2 lesson (moves only at content growth, not by surprise)', () => {
    expect(LEVELS[1].unitIds).toHaveLength(LESSONS_BY_GRADE[2].length);
  });
});
