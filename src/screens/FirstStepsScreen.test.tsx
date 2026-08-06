// First steps as the Learn tab at grade 0 (chromaticly-dhe, council finding 1).
//
// The invariant this suite exists for is REACHABILITY: before this screen the
// picker offered grade 0, the profile stored it, and no mounted screen could open
// the five lessons. So the load-bearing assertions are that every lesson renders
// and that tapping one hands back a real Lesson — not that the copy is right.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { LESSONS_BY_GRADE } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { LANE_FLOOR_GRADE, laneDepths, STRAND_ORDER } from '../learn/lane-depth';
import { ProgressProvider } from '../learn/ProgressContext';
import { MASTERY_THRESHOLD } from '../learn/mastery';
import { initialSrs } from '../learn/srs';
import { ProgressStore, type SnapshotStorage } from '../learn/store';
import { FIRST_STEPS_GRADE, FirstStepsScreen, NEXT_GRADE } from './FirstStepsScreen';

const GRADE_0_LESSONS = LESSONS_BY_GRADE[FIRST_STEPS_GRADE]!;

function storageWith(seed: (store: ProgressStore) => void): SnapshotStorage {
  const store = new ProgressStore();
  seed(store);
  const blob = JSON.stringify(store.toSnapshot());
  return { async load() { return blob; }, async save() {} };
}

function renderScreen(
  seed: (store: ProgressStore) => void = () => {},
  handlers: { onOpenLesson?: jest.Mock; onAdvance?: jest.Mock } = {},
) {
  const onOpenLesson = handlers.onOpenLesson ?? jest.fn();
  const onAdvance = handlers.onAdvance ?? jest.fn();
  const view = render(
    <ProgressProvider storage={storageWith(seed)}>
      <FirstStepsScreen onOpenLesson={onOpenLesson} onAdvance={onAdvance} />
    </ProgressProvider>,
  );
  return { ...view, onOpenLesson, onAdvance };
}

/** Write the mastered state directly — deriveStars reads only MasteryState.mastered,
 *  the same shortcut mastery-rollup.test.ts takes. */
function master(store: ProgressStore, lessonId: string) {
  const lesson = GRADE_0_LESSONS.find((l) => l.id === lessonId)!;
  for (const atom of lesson.atoms) {
    store.setAtom(atom, { mastery: { streak: MASTERY_THRESHOLD, mastered: true }, srs: initialSrs() });
  }
}

describe('FirstStepsScreen — the five lessons are openable, which is the whole point', () => {
  test('every grade-0 lesson gets a row', async () => {
    const { getByTestId, findByTestId } = renderScreen();
    await findByTestId('first-steps-screen');

    expect(GRADE_0_LESSONS.length).toBe(5);
    for (const lesson of GRADE_0_LESSONS) expect(getByTestId(`first-steps-unit-${lesson.id}`)).toBeTruthy();
  });

  // The chain is authored (`unlocks`), and a screen that reorders it would teach
  // the stave before the alphabet it is written in.
  test('the rows follow the authored unlock chain, first to last', async () => {
    const { getByTestId, findByTestId } = renderScreen();
    await findByTestId('first-steps-screen');

    let id: string | null = GRADE_0_LESSONS.find((l) => !GRADE_0_LESSONS.some((o) => o.unlocks === l.id))!.id;
    const chain: string[] = [];
    while (id) {
      chain.push(id);
      id = GRADE_0_LESSONS.find((l) => l.id === id)!.unlocks;
    }
    expect(chain).toEqual(GRADE_0_LESSONS.map((l) => l.id));
    expect(getByTestId(`first-steps-unit-${chain[0]}`)).toBeTruthy();
  });

  test('tapping a row hands the shell that lesson, so the runner can open it', async () => {
    const { getByTestId, findByTestId, onOpenLesson } = renderScreen();
    await findByTestId('first-steps-screen');

    fireEvent.press(getByTestId(`first-steps-unit-${GRADE_0_LESSONS[0].id}`));

    expect(onOpenLesson).toHaveBeenCalledTimes(1);
    expect(onOpenLesson.mock.calls[0][0].id).toBe(GRADE_0_LESSONS[0].id);
    expect(onOpenLesson.mock.calls[0][0].grade).toBe(FIRST_STEPS_GRADE);
  });

  test('the progress readout counts finished lessons, and says there is no exam', async () => {
    const { getByTestId, findByTestId } = renderScreen((store) => master(store, GRADE_0_LESSONS[0].id));
    await findByTestId('first-steps-screen');

    expect(getByTestId('first-steps-progress')).toHaveTextContent('1 of 5 done · no exam');
  });
});

describe('FirstStepsScreen — leaving, by choice or by finishing', () => {
  // R2: entry is never withdrawn. Someone who over-estimated how little they knew
  // must be able to leave without finishing, and without being asked why.
  test('an unfinished level offers a skip, and no completion card', async () => {
    const { getByTestId, queryByTestId, findByTestId, onAdvance } = renderScreen();
    await findByTestId('first-steps-screen');

    expect(queryByTestId('first-steps-complete')).toBeNull();
    fireEvent.press(getByTestId('first-steps-skip'));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  test('a finished level replaces the skip with the hand-off, so the exit is the same door', async () => {
    const seed = (store: ProgressStore) => GRADE_0_LESSONS.forEach((l) => master(store, l.id));
    const { getByTestId, queryByTestId, findByTestId, onAdvance } = renderScreen(seed);
    await waitFor(() => expect(getByTestId('first-steps-complete')).toBeTruthy());

    expect(queryByTestId('first-steps-skip')).toBeNull();
    fireEvent.press(getByTestId('first-steps-advance'));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  test('both exits name the level rather than a grade number', async () => {
    const { getByText, queryByText, findByTestId } = renderScreen();
    await findByTestId('first-steps-screen');

    expect(getByText(new RegExp(LEVELS.find((l) => l.grade === NEXT_GRADE)!.title))).toBeTruthy();
    expect(queryByText(/grade 0/i)).toBeNull();
  });
});

// Why this screen exists rather than a sixth lane. Both facts below are the design
// ruling made structural, and either one flipping would put grade 0 back into a
// model it is deliberately outside.
describe('FirstStepsScreen — grade 0 is navigable WITHOUT reaching the lane matrix', () => {
  test('the readiness firewall is untouched: no lane sees grade 0', () => {
    const store = new ProgressStore();
    const depths = laneDepths(store, Date.parse('2026-08-06'));

    expect(LANE_FLOOR_GRADE).toBe(1);
    for (const strand of STRAND_ORDER) {
      expect(depths[strand].contentGrades).not.toContain(FIRST_STEPS_GRADE);
    }
  });

  test('the level is real content, so the screen is not drawing an empty list', () => {
    expect(LEVELS.find((l) => l.grade === FIRST_STEPS_GRADE)!.unitIds).toEqual(GRADE_0_LESSONS.map((l) => l.id));
  });
});
