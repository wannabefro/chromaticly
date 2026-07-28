// U12 acceptance test for free practice: it renders a real generated exercise
// and advances the stream on Next. Mocks react-native-webview like
// ExerciseLoop.test.tsx.
//
// G6 U3 changed what makes an exercise available: eligibility is per-ATOM and
// nothing is auto-unlocked, so a fresh store now has nothing to practise. Every
// stream test therefore seeds an attempt first — which is also the point of the
// empty-state test below.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { LESSONS } from '../content/lessons';
import { ProgressProvider } from '../learn/ProgressContext';
import { initialSrs } from '../learn/srs';
import { ProgressStore, type SnapshotStorage } from '../learn/store';
import { Practice } from './Practice';

function memoryStorage(blob: string | null = null): SnapshotStorage & { blob: string | null } {
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

/** A snapshot in which `lessons`' atoms have been attempted — the eligibility
 *  set Practice draws from since G6 U3. */
function attemptedBlob(...lessonIds: string[]): string {
  const store = new ProgressStore();
  for (const id of lessonIds) {
    for (const atom of LESSONS.find((l) => l.id === id)!.atoms) {
      store.setAtom(atom, { mastery: { streak: 1, mastered: false }, srs: initialSrs(0) });
    }
  }
  return JSON.stringify(store.toSnapshot());
}

const rhythmLesson = LESSONS.find((l) => l.strand === 'rhythm')!;
const pitchLesson = LESSONS.find((l) => l.strand === 'pitch')!;

describe('Practice — SRS-driven exercise stream', () => {
  test('renders an exercise from an attempted atom and advances on Continue', async () => {
    const { getByTestId } = render(
      <ProgressProvider storage={memoryStorage(attemptedBlob(pitchLesson.id))}>
        <Practice />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(getByTestId('practice-active')).toBeTruthy(); // stable anchor the E2E waits on
    expect(getByTestId('prompt')).toBeTruthy();

    // select → Check → Continue advances the stream (no separate Next button).
    await act(async () => {
      fireEvent.press(getByTestId('option-0'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('check'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('feedback-sheet-continue'));
    });

    expect(getByTestId('prompt')).toBeTruthy();
  });

  // Practice is retention. With nothing attempted there is nothing to retain, so
  // it says so and points at Learn rather than inventing material the learner has
  // never met (R4).
  test('a learner who has attempted nothing gets the empty state, not a fabricated exercise', async () => {
    const { getByTestId, queryByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <Practice />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(getByTestId('practice-empty')).toBeTruthy();
    expect(queryByTestId('practice-active')).toBeNull();
  });
});

// R9: the lane filter. Cross-lane is the default because interleaving strands IS
// the retention benefit — narrowing is a deliberate act by a learner who knows
// which skill they want to shore up.
describe('Practice — per-lane filter (R9)', () => {
  test('filtering to a lane with no attempted atoms shows that lane’s empty state, and clearing restores the stream', async () => {
    const { getByTestId, queryByTestId } = render(
      <ProgressProvider storage={memoryStorage(attemptedBlob(pitchLesson.id))}>
        <Practice />
      </ProgressProvider>,
    );
    await act(async () => {});
    expect(getByTestId('practice-active')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('practice-filter-rhythm'));
    });
    expect(getByTestId('practice-empty')).toBeTruthy();
    expect(queryByTestId('practice-active')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('practice-filter-clear'));
    });
    expect(getByTestId('practice-active')).toBeTruthy();
  });

  test('filtering to a lane the learner HAS attempted keeps the stream running', async () => {
    const { getByTestId } = render(
      <ProgressProvider storage={memoryStorage(attemptedBlob(pitchLesson.id, rhythmLesson.id))}>
        <Practice />
      </ProgressProvider>,
    );
    await act(async () => {});

    await act(async () => {
      fireEvent.press(getByTestId('practice-filter-rhythm'));
    });
    expect(getByTestId('practice-active')).toBeTruthy();
    expect(getByTestId('prompt')).toBeTruthy();
  });
});
