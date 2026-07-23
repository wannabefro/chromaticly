// U2 acceptance tests for the level map (design 3a, R1-R4, AE2).

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render, within } from '@testing-library/react-native';

import { LESSONS, LESSONS_BY_GRADE, lessonById } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { MASTERY_THRESHOLD } from '../learn/mastery';
import { ProgressProvider } from '../learn/ProgressContext';
import { initialSrs } from '../learn/srs';
import { ProgressStore, type SnapshotStorage } from '../learn/store';
import { strandDef, type Strand } from '../ui/theme';
import LevelMapScreen from './LevelMapScreen';

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

/** Build a seed blob without going through applyAttempt — direct store surgery,
 *  mirroring src/learn/mastery-rollup.test.ts's masterAtoms convention. */
function seedBlob(mutate: (store: ProgressStore) => void): string {
  const store = new ProgressStore();
  mutate(store);
  return JSON.stringify(store.toSnapshot());
}

function renderMap(seed: string | null = null) {
  return render(
    <ProgressProvider storage={memoryStorage(seed)}>
      <LevelMapScreen />
    </ProgressProvider>,
  );
}

describe('LevelMapScreen — the grade home (R1)', () => {
  test('renders one UnitRow per Level 1 unit with the correct strand glyph + label', async () => {
    const { getByTestId, findByTestId } = renderMap();
    await findByTestId('level-map-screen');

    for (const lesson of LESSONS_BY_GRADE[1]) {
      const row = getByTestId(`unit-row-${lesson.id}`);
      const def = strandDef(lesson.strand as Strand);
      expect(within(row).getByText(def.label)).toBeTruthy();
      expect(within(row).getByText(def.glyph)).toBeTruthy();
      expect(within(row).getByText(lesson.title)).toBeTruthy();
    }
  });

  test('a fully-mastered unit shows 3 filled stars; a partial unit shows the derived count', async () => {
    const first = LESSONS[0];
    const second = LESSONS[1];
    const seed = seedBlob((store) => {
      store.unlock(first.id);
      store.unlock(second.id);
      masterAtoms(store, first.atoms);
      store.setLesson(first.id, { completed: true });
      masterAtoms(store, second.atoms.slice(0, 1)); // 1 of N -> 1 star (below 2/3)
    });

    const { getByTestId, findByTestId } = renderMap(seed);
    await findByTestId('level-map-screen');

    const doneRow = within(getByTestId(`unit-row-${first.id}`));
    expect(doneRow.getByTestId('unit-row-' + first.id + '-stars-star-0-filled')).toBeTruthy();
    expect(doneRow.getByTestId('unit-row-' + first.id + '-stars-star-1-filled')).toBeTruthy();
    expect(doneRow.getByTestId('unit-row-' + first.id + '-stars-star-2-filled')).toBeTruthy();

    const partialRow = within(getByTestId(`unit-row-${second.id}`));
    expect(partialRow.getByTestId('unit-row-' + second.id + '-stars-star-0-filled')).toBeTruthy();
    expect(partialRow.getByTestId('unit-row-' + second.id + '-stars-star-1-empty')).toBeTruthy();
    expect(partialRow.getByTestId('unit-row-' + second.id + '-stars-star-2-empty')).toBeTruthy();
  });

  test('the exam-gate node renders locked with its unlock condition and does nothing on tap (AE2)', async () => {
    const { getByTestId, getByText, findByTestId } = renderMap();
    await findByTestId('level-map-screen');

    const level1 = LEVELS[0];
    const gate = getByTestId(`exam-gate-${level1.id}`);
    expect(getByText(`Practice paper · unlocks at ${level1.unitIds.length} units ★`)).toBeTruthy();
    expect(gate.props.onPress).toBeUndefined();

    await act(async () => {
      fireEvent.press(gate);
    });
    // Still on the map — no exam/lesson screen took over.
    expect(getByTestId('level-map-screen')).toBeTruthy();
  });

  // fyu.2: only content-less Levels 4-5 stay locked/collapsed now — Levels 2-3
  // are reachable on a fresh store (content presence is the only gate) and
  // render expanded, covered by the "Level 2 is dynamically unlocked" describe
  // block below and the Level-3-parity assertions here.
  test('content-less Levels 4-5 render locked with their OWN prerequisite copy and no unit content', async () => {
    const { getByTestId, findByTestId } = renderMap();
    await findByTestId('level-map-screen');

    for (const level of LEVELS.slice(3)) {
      const node = within(getByTestId(`level-node-${level.id}`));
      expect(node.getByText(level.title)).toBeTruthy();
      expect(node.getByText(level.prerequisite!)).toBeTruthy();
    }
  });

  test('Levels 2 and 3 render expanded on a fresh store — reachable by content presence, not an exam gate', async () => {
    const { getByTestId, findByTestId, queryByText } = renderMap();
    await findByTestId('level-map-screen');

    for (const level of [LEVELS[1], LEVELS[2]]) {
      const node = within(getByTestId(`level-node-${level.id}`));
      expect(node.getByText(level.title)).toBeTruthy();
      // A locked node would show its prerequisite copy; an expanded one never does.
      expect(queryByText(level.prerequisite!)).toBeNull();
    }
    expect(getByTestId('unit-row-key-signatures-2')).toBeTruthy();
  });

  // Rule 3 / test scenario 5: one accent hue per screen — the active strand's.
  test('the expanded level accent is the active unit\'s strand hue', async () => {
    const { getByTestId, findByTestId } = renderMap();
    await findByTestId('level-map-screen');

    const accent = getByTestId('level-node-level-1-accent');
    const flatten = (style: unknown) => Object.assign({}, ...(Array.isArray(style) ? style : [style]));
    const firstStrand = strandDef(LESSONS[0].strand as Strand);

    expect(flatten(accent.props.style).backgroundColor).toBe(firstStrand.hue);
  });

  test('tapping the active unit launches its set', async () => {
    const { getByTestId, findByTestId } = renderMap();
    await findByTestId('level-map-screen');

    await act(async () => {
      fireEvent.press(getByTestId(`unit-row-${LESSONS[0].id}`));
    });

    expect(getByTestId('set-runner')).toBeTruthy();
  });
});

// fyu.2: Level 2's visibility is driven by content presence, not a persisted
// exam-clear — the free-grade-access headline user-visible behavior.
describe('LevelMapScreen — Level 2 is reachable by content presence (fyu.2)', () => {
  test('on a fresh store Level 2 renders expanded with its unit row present and tappable, no exam required', async () => {
    const { getByTestId, findByTestId } = renderMap();
    await findByTestId('level-map-screen');

    const level2 = LEVELS[1];
    const node = within(getByTestId(`level-node-${level2.id}`));
    expect(node.queryByText('Clear the Level 1 exam to unlock')).toBeNull();
    expect(getByTestId('unit-row-key-signatures-2')).toBeTruthy();
  });

  test('the grade pill reads the profile\'s working grade, not the highest reachable level (Level 3 is also reachable but the pill still reads Grade 2)', async () => {
    const seed = seedBlob((store) => store.setProfile({ grade: 2, onboardedAt: '2026-07-13T00:00:00.000Z' }));
    const { getByTestId, findByTestId } = renderMap(seed);
    await findByTestId('level-map-screen');

    expect(getByTestId('grade-pill')).toHaveTextContent('Grade 2');
  });

  test('the grade pill defaults to Grade 1 on a fresh store, even though Levels 2 and 3 are also reachable', async () => {
    const { getByTestId, findByTestId } = renderMap();
    await findByTestId('level-map-screen');

    expect(getByTestId('grade-pill')).toHaveTextContent('Grade 1');
  });

  // D8: Grade 2 has no exam paper this slice — the gate must never open onto a
  // paper that doesn't exist, even at full stars, independent of any exam-clear state.
  test('the Level-2 exam gate stays sealed "Coming soon" even at full stars', async () => {
    const seed = seedBlob((store) => {
      store.unlock('key-signatures-2');
      masterAtoms(store, lessonById('key-signatures-2')!.atoms);
      store.setLesson('key-signatures-2', { completed: true });
    });
    const { getByTestId, findByTestId } = renderMap(seed);
    await findByTestId('level-map-screen');

    const gate = getByTestId('exam-gate-level-2');
    expect(gate.props.onPress).toBeUndefined();
    expect(within(gate).getByText('Coming soon')).toBeTruthy();
  });

  test('tapping the Level-2 unit row launches SetRunner on the teach phase', async () => {
    const seed = seedBlob((store) => store.recordExamCleared(1));
    const { getByTestId, findByTestId } = renderMap(seed);
    await findByTestId('level-map-screen');

    await act(async () => {
      fireEvent.press(getByTestId('unit-row-key-signatures-2'));
    });

    expect(getByTestId('teach-phase')).toBeTruthy();
  });
});
