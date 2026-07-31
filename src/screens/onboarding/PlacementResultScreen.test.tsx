// Placement result (7c). The screen's real contract is not "it renders seven rows"
// — it is that the preview and the post-commit Learn tab cannot disagree (R3), and
// that nothing is written until the learner has been through the rest of onboarding
// (KTD6).

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { fixedClock } from '../../learn/clock';
import { laneDepths, STRAND_ORDER } from '../../learn/lane-depth';
import { ProgressProvider } from '../../learn/ProgressContext';
import { ProgressStore, type SeededDepth, type SnapshotStorage } from '../../learn/store';
import { strandDef } from '../../ui/theme';
import { PlacementResultScreen } from './PlacementResultScreen';

const DAY = 20_600;

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

function seed(depth: number, seq: number): SeededDepth {
  return { depth, day: DAY, seq };
}

function renderResult(
  staged: Record<string, SeededDepth> = { rhythm: seed(3, 1), pitch: seed(3, 2), terms_signs: seed(4, 3) },
  overrides: { onRetest?: (s: string) => void; onAccept?: () => void; asked?: number; storage?: ReturnType<typeof memoryStorage> } = {},
) {
  const storage = overrides.storage ?? memoryStorage(JSON.stringify(new ProgressStore().toSnapshot()));
  return {
    storage,
    staged,
    ...render(
      <ProgressProvider storage={storage} clock={fixedClock(DAY)}>
        <PlacementResultScreen
          staged={staged}
          asked={overrides.asked ?? Object.keys(staged).length}
          onRetest={overrides.onRetest ?? jest.fn()}
          onAccept={overrides.onAccept ?? jest.fn()}
        />
      </ProgressProvider>,
    ),
  };
}

describe('PlacementResultScreen — seven depths, honestly uneven (7c, R7)', () => {
  test('renders a row for every strand, measured or not', async () => {
    const { findByTestId, getByTestId } = renderResult();
    await findByTestId('placement-result');

    for (const strand of STRAND_ORDER) expect(getByTestId(`placement-row-${strand}`)).toBeTruthy();
  });

  // R1: the whole point of the vector is that there is no single answer to "what
  // grade are you". A headline grade here would undo it on the first screen.
  test('no headline grade is asserted anywhere', async () => {
    const { findByTestId, queryByText } = renderResult();
    await findByTestId('placement-result');

    expect(queryByText(/^Grade \d/)).toBeNull();
    expect(queryByText(/you're a grade/i)).toBeNull();
  });

  // The property this screen exists to guarantee.
  //
  // A freshly-stamped seed and its preview are equal by construction — the seed
  // branch of laneDepths returns the claim as given — so equality proves nothing.
  // Decay is where the derivation becomes visible, and it is not a contrived case:
  // this same screen is the re-test surface (R7a), where a staged seed is compared
  // against lanes that have been ageing for weeks.
  test('the depths come from laneDepths over the staged seeds, not from the staged numbers', async () => {
    // 70 days is two full SEED_INTERVAL_DAYS windows, so a depth-4 claim has shed
    // two grades and now reads 2. A screen rendering `staged.depth` shows 4.
    const staged = { pitch: { depth: 4, day: DAY - 70, seq: 1 } };
    const { findByTestId, getByLabelText } = renderResult(staged);
    await findByTestId('placement-result');

    const derived = (() => {
      const s = new ProgressStore();
      s.setSeededDepth('pitch', staged.pitch);
      return laneDepths(s, DAY).pitch;
    })();
    expect(derived.depth).toBe(2); // the fixture is only meaningful if this holds
    expect(derived.decayedFrom).toBe(4);

    // LaneRow's label carries both numbers, so this asserts the rendered row agrees
    // with the derivation rather than with the input.
    expect(getByLabelText(`${strandDef('pitch').label}, grade 2, was grade 4`)).toBeTruthy();
  });

  test('a strand the pass never asked about is named, not drawn as an empty lane', async () => {
    const { findByTestId, getByTestId } = renderResult({ rhythm: seed(3, 1) });
    await findByTestId('placement-result');

    const line = getByTestId('placement-not-asked');
    // "Not asked" is a fact about the pass; "not started" would be a claim about
    // the learner that placement never made.
    expect(line).toHaveTextContent(strandDef('chords').label, { exact: false });
    expect(line).not.toHaveTextContent(strandDef('rhythm').label, { exact: false });
  });

  test('every strand measured means no not-asked line at all', async () => {
    const staged = Object.fromEntries(STRAND_ORDER.map((s, i) => [s, seed(2, i + 1)]));
    const { findByTestId, queryByTestId } = renderResult(staged);
    await findByTestId('placement-result');

    expect(queryByTestId('placement-not-asked')).toBeNull();
  });

  test('the question count is what was actually asked, not a hardcoded eight', async () => {
    const { findByTestId, getByText } = renderResult({ rhythm: seed(3, 1) }, { asked: 7 });
    await findByTestId('placement-result');

    expect(getByText('Placement · 7 questions')).toBeTruthy();
  });

  // R5 continuity. The drop has to be pre-announced or it reads as a bug later.
  test('the copy pre-warns that skills drift back down', async () => {
    const { findByTestId, getByTestId } = renderResult();
    await findByTestId('placement-result');

    expect(getByTestId('placement-drift-tip')).toHaveTextContent(/slide back down/, { exact: false });
  });

  test('tapping a row asks to re-test that strand only', async () => {
    const onRetest = jest.fn();
    const { findByTestId, getByTestId } = renderResult(undefined, { onRetest });
    await findByTestId('placement-result');

    fireEvent.press(getByTestId('placement-row-intervals'));
    expect(onRetest).toHaveBeenCalledTimes(1);
    expect(onRetest).toHaveBeenCalledWith('intervals');
  });

  test('accepting continues onboarding', async () => {
    const onAccept = jest.fn();
    const { findByTestId, getByTestId } = renderResult(undefined, { onAccept });
    await findByTestId('placement-result');

    fireEvent.press(getByTestId('placement-accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  // KTD6: the commit is at Landed, after the warm-up. Persisting here would make a
  // half-finished onboarding indistinguishable from a completed one.
  test('nothing is persisted by viewing or re-testing on this screen', async () => {
    const storage = memoryStorage(JSON.stringify(new ProgressStore().toSnapshot()));
    const before = storage.blob;
    const { findByTestId, getByTestId } = renderResult(undefined, { storage });
    await findByTestId('placement-result');

    fireEvent.press(getByTestId('placement-row-pitch'));
    fireEvent.press(getByTestId('placement-accept'));

    await waitFor(() => expect(storage.blob).toBe(before));
  });
});
