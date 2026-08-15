// Landed (design step 6): the "3 for 3" payoff + both hand-off CTAs (R6).

import { fireEvent, render } from '@testing-library/react-native';

import { fixedClock } from '../../learn/clock';
import { STRAND_ORDER } from '../../learn/lane-depth';
import { ProgressProvider } from '../../learn/ProgressContext';
import { ProgressStore, type SeededDepth, type SnapshotStorage } from '../../learn/store';
import { strandDef } from '../../ui/theme';
import { LandedScreen } from './LandedScreen';
import { type GemState } from '../../ui/components/MasteryGems';

const CLEAN: GemState[] = ['clean', 'clean', 'clean'];
const DAY = 20_600;

function memoryStorage(): SnapshotStorage {
  const blob = JSON.stringify(new ProgressStore().toSnapshot());
  return { async load() { return blob; }, async save() {} };
}

/** Landed reads the staged vector through the shared derivation, so it needs
 *  the provider even with no board. */
function renderLanded(props: Partial<React.ComponentProps<typeof LandedScreen>> = {}) {
  return render(
    <ProgressProvider storage={memoryStorage()} clock={fixedClock(DAY)}>
      <LandedScreen onContinue={jest.fn()} onExplore={jest.fn()} gems={CLEAN} {...props} />
    </ProgressProvider>,
  );
}

describe('LandedScreen — the first-point payoff and hand-off (R6)', () => {
  test('renders the "3 for 3" copy and both CTAs', () => {
    const { getByTestId, getByText } = renderLanded({ onContinue: jest.fn(), onExplore: jest.fn(), gems: CLEAN });

    expect(getByTestId('landed-screen')).toBeTruthy();
    expect(getByText("You're in. 3 for 3.")).toBeTruthy();
    expect(getByTestId('landed-continue')).toBeTruthy();
    expect(getByTestId('landed-explore')).toBeTruthy();
  });

  // The copy said "your first Rhythm point is on the board" and nothing showed it.
  test('shows one gem per warm-up item, and a retried item is not clean', () => {
    const { getByTestId } = renderLanded({ onContinue: jest.fn(), onExplore: jest.fn(), gems: ['clean', 'hinted', 'clean'] });

    expect(getByTestId('landed-gems')).toBeTruthy();
    expect(getByTestId('gem-1-hinted')).toBeTruthy();
  });

  test('Continue and Explore each fire their handler', () => {
    const onContinue = jest.fn();
    const onExplore = jest.fn();
    const { getByTestId } = renderLanded({ onContinue: onContinue, onExplore: onExplore, gems: CLEAN });

    fireEvent.press(getByTestId('landed-continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('landed-explore'));
    expect(onExplore).toHaveBeenCalledTimes(1);
  });
});

// The screen celebrates a mastery point. Which strand that point is in now depends
// on the level the learner chose, so naming it is a claim that can be wrong
// (chromaticly-6xk).
describe('LandedScreen — it names the strand the warm-up actually drilled', () => {
  test('a First steps learner earned a Pitch point, and the screen says so', () => {
    const { getByText, queryByText } = renderLanded({ onContinue: jest.fn(), onExplore: jest.fn(), gems: ['clean', 'clean', 'clean'], grade: 0 });

    expect(getByText(strandDef('pitch').short)).toBeTruthy();
    expect(queryByText(strandDef('rhythm').short)).toBeNull();
  });

  test('every other grade still reads Rhythm', () => {
    for (const grade of [1, 3, 5]) {
      const { getByText, unmount } = renderLanded({ onContinue: jest.fn(), onExplore: jest.fn(), gems: ['clean'], grade: grade });
      expect(getByText(strandDef('rhythm').short)).toBeTruthy();
      unmount();
    }
  });
});

describe('LandedScreen — the board the copy names (chromaticly-gxn item 2)', () => {
  const seed = (depth: number, seq: number): SeededDepth => ({ depth, day: DAY, seq });
  const staged = { rhythm: seed(2, 1), pitch: seed(3, 2), scales_keys: seed(1, 3) };

  test('the placed route draws all seven lanes, not three loose gems on empty canvas', async () => {
    const { findByTestId, getByTestId } = renderLanded({ staged });

    await findByTestId('landed-board');
    for (const strand of STRAND_ORDER) expect(getByTestId(`landed-row-${strand}`)).toBeTruthy();
  });

  // LaneRow's note slot marks exactly one lane, and this is that lane.
  test('the warm-up strand is the tagged lane, and it is the only one', async () => {
    const { findByTestId, queryByTestId } = renderLanded({ staged });

    await findByTestId('landed-row-rhythm-note');
    for (const strand of STRAND_ORDER) {
      if (strand !== 'rhythm') expect(queryByTestId(`landed-row-${strand}-note`)).toBeNull();
    }
  });

  // First steps seeds nothing, so a board would be seven empty bars — worse than
  // the copy it replaces.
  test('the First-steps route draws no board', () => {
    const { queryByTestId, getByText } = renderLanded({ grade: 0 });

    expect(queryByTestId('landed-board')).toBeNull();
    expect(getByText(/The full lesson picks up right here/)).toBeTruthy();
  });
});
