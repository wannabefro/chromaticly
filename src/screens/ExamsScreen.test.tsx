// U6 acceptance tests for the Exams tab (design 3b's paper reached directly from the
// tab bar). Same readiness/hasPaper rules as the level map's inline gate — a paper must
// never be quietly openable from one surface but not the other.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { fireEvent, render } from '@testing-library/react-native';

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
  test('a fresh store lists only the Level 1 gate', async () => {
    const { findByTestId, queryByTestId } = renderExams();
    await findByTestId('exams-screen');

    expect(queryByTestId('exam-gate-level-1')).toBeTruthy();
    expect(queryByTestId('exam-gate-level-2')).toBeNull();
  });

  test('once grade 1\'s exam is cleared, the Level-2 gate appears, disabled per hasExamPaper (D8)', async () => {
    const seed = seedBlob((store) => {
      store.recordExamCleared(1);
      store.unlock('key-signatures-2');
      masterAtoms(store, lessonById('key-signatures-2')!.atoms);
      store.setLesson('key-signatures-2', { completed: true });
    });
    const { findByTestId, getByTestId, getByText } = renderExams(seed);
    await findByTestId('exams-screen');

    const gate = getByTestId('exam-gate-level-2');
    expect(gate.props.onPress).toBeUndefined();
    expect(getByText('Coming soon')).toBeTruthy();
  });

  test('the Level 1 gate is unaffected — still opens once its stars are earned', async () => {
    const seed = seedBlob((store) => {
      for (const lesson of LESSONS_BY_GRADE[1]) {
        store.unlock(lesson.id);
        store.setLesson(lesson.id, { completed: true });
        masterAtoms(store, lesson.atoms);
      }
    });
    const { findByTestId, getByTestId, queryByTestId } = renderExams(seed);
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
