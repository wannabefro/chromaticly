// Coached warm-up (design steps 4–5): the 3-question on-ramp. Invariants guarded:
// it draws a REAL first Rhythm mastery point (records the note_value_compare atom),
// it NEVER completes a lesson (KTD3), retry-until-correct always ends 3/3
// (KTD3b), onComplete fires only after the 3rd correct, and all gamification +
// hints are suppressed (R4).

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { generate } from '../engine/generators';
import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
import { warmUpFor } from '../learn/warm-up';
import { CoachedWarmUp } from './CoachedWarmUp';
import { assembleOptions } from './grading';

function memoryStorage(): SnapshotStorage & { blob: string | null } {
  return {
    blob: null as string | null,
    async load() {
      return this.blob;
    },
    async save(serialized: string) {
      this.blob = serialized;
    },
  };
}

const WARM_UP_ATOM = 'note_value_compare';

/** The shuffled option index of the correct / wrong answer for a warm-up seed. */
function correctIndexFor(seed: number): number {
  const instance = generate(WARM_UP_ATOM, { grade: 1, seed, atoms: [WARM_UP_ATOM] });
  return assembleOptions(instance).findIndex((o) => o.correct);
}
function wrongIndexFor(seed: number): number {
  return correctIndexFor(seed) === 0 ? 1 : 0; // 2-option MCQ
}

async function answer(getByTestId: (id: string) => any, optionIndex: number) {
  await act(async () => fireEvent.press(getByTestId(`option-${optionIndex}`)));
  await act(async () => fireEvent.press(getByTestId('check')));
  await act(async () => fireEvent.press(getByTestId('feedback-sheet-continue')));
}

function renderWarmUp(grade: number | null = 1) {
  const storage = memoryStorage();
  const onComplete = jest.fn();
  const utils = render(
    <ProgressProvider storage={storage}>
      <CoachedWarmUp onComplete={onComplete} onClose={jest.fn()} grade={grade} />
    </ProgressProvider>,
  );
  return { ...utils, storage, onComplete };
}

/** The correct option index for a grade-0 warm-up seed. Its MCQ has 3 options,
 *  not 2, so the grade-1 helpers above cannot be reused. */
function firstStepsCorrectIndex(seed: number): number {
  const w = warmUpFor(0);
  const instance = generate(w.template, { grade: w.grade, seed, atoms: [w.atom] });
  return assembleOptions(instance).findIndex((o) => o.correct);
}

describe('CoachedWarmUp — a 3-question coached on-ramp (R4, R5, KTD3)', () => {
  test('renders the warm-up shell, the 1/3 counter, the coach mark, and the notation stimulus', async () => {
    const { getByTestId } = renderWarmUp();
    await act(async () => {});

    expect(getByTestId('warm-up-screen')).toBeTruthy();
    expect(getByTestId('warmup-count').props.children).toEqual([1, '/', 3]);
    expect(getByTestId('warmup-coach')).toBeTruthy();
    expect(getByTestId('stimulus-music')).toBeTruthy(); // notation → carries a play affordance
  });

  test('Check is disabled until an option is selected', async () => {
    const { getByTestId } = renderWarmUp();
    await act(async () => {});

    expect(getByTestId('check').props.accessibilityState?.disabled).toBe(true);
    await act(async () => fireEvent.press(getByTestId(`option-${correctIndexFor(0)}`)));
    expect(getByTestId('check').props.accessibilityState?.disabled).toBe(false);
  });

  test('hints and gamification are suppressed for the whole warm-up (R4)', async () => {
    const { getByTestId, queryByTestId } = renderWarmUp();
    await act(async () => {});

    expect(queryByTestId('hints')).toBeNull();
    for (const id of ['set-gems', 'score-ring', 'set-count', 'set-complete']) {
      expect(queryByTestId(id)).toBeNull();
    }
    expect(getByTestId('warm-up-screen')).toBeTruthy();
  });

  test('answering all three correctly advances 1/3 → 2/3 → 3/3 and calls onComplete once', async () => {
    const { getByTestId, onComplete } = renderWarmUp();
    await act(async () => {});

    expect(getByTestId('warmup-count').props.children).toEqual([1, '/', 3]);
    await answer(getByTestId, correctIndexFor(0));
    expect(getByTestId('warmup-count').props.children).toEqual([2, '/', 3]);
    await answer(getByTestId, correctIndexFor(1));
    expect(getByTestId('warmup-count').props.children).toEqual([3, '/', 3]);
    expect(onComplete).not.toHaveBeenCalled(); // not until the 3rd is answered

    await answer(getByTestId, correctIndexFor(2));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(['clean', 'clean', 'clean']);
  });

  // LandedScreen draws these. A retried item must not come back looking clean, or
  // the reward screen overstates what the learner actually did.
  test('a retried item reports hinted, and only that item', async () => {
    const { getByTestId, onComplete } = renderWarmUp();
    await act(async () => {});

    await answer(getByTestId, wrongIndexFor(0)); // miss the first item, then retry it
    await answer(getByTestId, correctIndexFor(0));
    await answer(getByTestId, correctIndexFor(1));
    await answer(getByTestId, correctIndexFor(2));

    expect(onComplete).toHaveBeenCalledWith(['hinted', 'clean', 'clean']);
  });

  test('onComplete never fires after Check alone — only after the 3rd feedback Continue', async () => {
    const { getByTestId, onComplete } = renderWarmUp();
    await act(async () => {});

    await answer(getByTestId, correctIndexFor(0));
    await answer(getByTestId, correctIndexFor(1));
    // Third item: select + check, but do NOT continue yet.
    await act(async () => fireEvent.press(getByTestId(`option-${correctIndexFor(2)}`)));
    await act(async () => fireEvent.press(getByTestId('check')));
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => fireEvent.press(getByTestId('feedback-sheet-continue')));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('an incorrect answer re-presents the same item and does not advance or complete (retry, KTD3b)', async () => {
    const { getByTestId, onComplete } = renderWarmUp();
    await act(async () => {});

    // Miss the first question → still 1/3, not advanced, not complete.
    await answer(getByTestId, wrongIndexFor(0));
    expect(getByTestId('warmup-count').props.children).toEqual([1, '/', 3]);
    expect(onComplete).not.toHaveBeenCalled();

    // The retried same question is answerable and advances.
    await answer(getByTestId, correctIndexFor(0));
    expect(getByTestId('warmup-count').props.children).toEqual([2, '/', 3]);
  });

  test('draws a real Rhythm mastery point (records the atom) and never completes a lesson (KTD3)', async () => {
    const { getByTestId, storage } = renderWarmUp();
    await act(async () => {});

    await answer(getByTestId, correctIndexFor(0));
    await answer(getByTestId, correctIndexFor(1));
    await answer(getByTestId, correctIndexFor(2));

    // The standalone atom was recorded and mastered (3 in a row). Crucially, the
    // warm-up completed NO lesson — in particular not the note-values lesson,
    // whose atoms it deliberately does not draw from (KTD3).
    const snapshot = JSON.parse(storage.blob as string);
    expect(snapshot.atoms[WARM_UP_ATOM]).toBeDefined();
    expect(snapshot.atoms[WARM_UP_ATOM].mastery.mastered).toBe(true);
    expect(snapshot.lessons).toEqual({}); // no lesson marked complete
    expect(Object.keys(snapshot.atoms)).toEqual([WARM_UP_ATOM]); // nothing else touched
  });
});

// The First steps warm-up (chromaticly-6xk). A learner who picks that level has
// never read music, and the grade-1 warm-up opens with "which of these two
// noteheads lasts longer?" — under retry-until-correct, a question they cannot
// read is not an on-ramp, it is a wall they brute-force until they guess.
describe('CoachedWarmUp — at grade 0 the on-ramp is readable without notation', () => {
  test('it draws no notation at all, which is the whole reason for the swap', async () => {
    const { queryByTestId, getByTestId } = renderWarmUp(0);
    await act(async () => {});

    expect(getByTestId('warm-up-screen')).toBeTruthy();
    expect(queryByTestId('stimulus-music')).toBeNull();
  });

  // The coach mark promises audio. With no notation there is no play control, so
  // the promise would point at nothing.
  test('the "tap play" coach mark is withheld when there is nothing to play', async () => {
    const { queryByTestId } = renderWarmUp(0);
    await act(async () => {});

    expect(queryByTestId('warmup-coach')).toBeNull();
  });

  test('it records the First steps atom, and never the grade-1 one', async () => {
    const { getByTestId, storage, onComplete } = renderWarmUp(0);
    await act(async () => {});

    for (const seed of [0, 1, 2]) await answer(getByTestId, firstStepsCorrectIndex(seed));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const snapshot = JSON.parse(storage.blob!);
    expect(Object.keys(snapshot.atoms)).toEqual([warmUpFor(0).atom]);
    expect(Object.keys(snapshot.atoms)).not.toContain(WARM_UP_ATOM);
  });

  // The point of the single-atom design (KTD3b). The swap must not cost it.
  test('the mastery guarantee survives the swap: one atom, mastered, after 3 of 3', async () => {
    const { getByTestId, storage } = renderWarmUp(0);
    await act(async () => {});

    for (const seed of [0, 1, 2]) await answer(getByTestId, firstStepsCorrectIndex(seed));

    const snapshot = JSON.parse(storage.blob!);
    expect(snapshot.atoms[warmUpFor(0).atom].mastery.mastered).toBe(true);
  });

  test('retry-until-correct still holds — a wrong answer re-presents rather than advancing', async () => {
    const { getByTestId } = renderWarmUp(0);
    await act(async () => {});

    const wrong = firstStepsCorrectIndex(0) === 0 ? 1 : 0;
    await answer(getByTestId, wrong);

    expect(getByTestId('warmup-count').props.children).toEqual([1, '/', 3]);
  });

  test('every other grade is untouched and still drills the grade-1 atom', async () => {
    for (const grade of [1, 3, 5]) {
      expect(warmUpFor(grade).atom).toBe(WARM_UP_ATOM);
    }
  });
});
