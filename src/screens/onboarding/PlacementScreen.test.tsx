// Placement (A1/A2) — the mixed pass, and the same runner as a per-skill ladder.
//
// The tests drive REAL generated items through the real `ExerciseLoop`, rather
// than stubbing the loop. That is deliberate and it is the point of the unit: the
// placement bank is wider than MCQ, and an implementation built on `AnswerOption`
// would leave context unmeasurable while every stubbed test still passed.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { fixedClock } from '../../learn/clock';
import { ladderFor, placeableStrands, startPlacement, currentItem } from '../../learn/placement';
import { ProgressProvider } from '../../learn/ProgressContext';
import { ProgressStore, type SeededDepth, type SnapshotStorage } from '../../learn/store';
import { PlacementScreen } from './PlacementScreen';

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

function renderPlacement(
  props: Partial<React.ComponentProps<typeof PlacementScreen>> = {},
  storage = memoryStorage(JSON.stringify(new ProgressStore().toSnapshot())),
) {
  const onDone = props.onDone ?? jest.fn();
  return {
    onDone,
    storage,
    ...render(
      <ProgressProvider storage={storage} clock={fixedClock(DAY)}>
        <PlacementScreen onSkip={jest.fn()} {...props} onDone={onDone} />
      </ProgressProvider>,
    ),
  };
}

/** Answer whatever interaction is on screen, then walk the feedback sheet.
 *  Deliberately generic: the whole point is that placement is not MCQ-only. */
function answerCurrentItem(api: ReturnType<typeof render>) {
  const { queryByTestId, getByTestId } = api;

  // Three different input shapes across seven strands, which is the finding this
  // helper encodes: MCQ cards, the context passage's bar taps, and the chord
  // numeral chips. Anything built against `AnswerOption` reaches only the first.
  if (queryByTestId('mcq')) fireEvent.press(getByTestId('option-0'));
  else if (queryByTestId('find-the-bar')) fireEvent.press(getByTestId('bar-1'));
  else if (queryByTestId('roman-numeral-boxes')) fireEvent.press(getByTestId('roman-numeral-I'));
  else throw new Error('placement served an interaction this helper cannot answer');

  act(() => fireEvent.press(getByTestId('check')));
  act(() => fireEvent.press(getByTestId('feedback-sheet-continue')));
}

describe('PlacementScreen — the ask (A1)', () => {
  test('the question count is derived from the placeable strands, not hardcoded', async () => {
    const { findByTestId, getByText } = renderPlacement();
    await findByTestId('placement-intro');

    expect(getByText(`Measure me — ${placeableStrands().length} questions`)).toBeTruthy();
  });

  // KTD3/R7: skipping seeds nothing at all, so promising grade 1 would be a claim
  // the app does not keep — every lane reads its derived depth, which is 0.
  test('skip is a visible peer action and does not promise grade 1', async () => {
    const onSkip = jest.fn();
    const { findByTestId, getByTestId, queryByText } = renderPlacement({ onSkip });
    await findByTestId('placement-intro');

    expect(queryByText(/start everything at grade 1/i)).toBeNull();
    fireEvent.press(getByTestId('placement-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  test('Start moves to the first item', async () => {
    const { findByTestId, getByTestId } = renderPlacement();
    await findByTestId('placement-intro');

    fireEvent.press(getByTestId('placement-start'));
    expect(getByTestId('placement-item')).toBeTruthy();
  });
});

describe('PlacementScreen — the mixed pass (A2)', () => {
  test('hints are never offered — a hinted answer measures the hint', async () => {
    const { findByTestId, getByTestId, queryByText } = renderPlacement();
    await findByTestId('placement-intro');
    fireEvent.press(getByTestId('placement-start'));

    expect(queryByText(/show hint/i)).toBeNull();
  });

  test('the counter counts up over the pass', async () => {
    const api = renderPlacement();
    await api.findByTestId('placement-intro');
    fireEvent.press(api.getByTestId('placement-start'));

    const total = placeableStrands().length;
    expect(api.getByTestId('placement-counter')).toHaveTextContent(`1/${total}`);
    answerCurrentItem(api);
    expect(api.getByTestId('placement-counter')).toHaveTextContent(`2/${total}`);
  });

  test('answering every item reports one staged seed per strand and the count asked', async () => {
    const onDone = jest.fn();
    const api = renderPlacement({ onDone });
    await api.findByTestId('placement-intro');
    fireEvent.press(api.getByTestId('placement-start'));

    const strands = placeableStrands();
    for (let i = 0; i < strands.length; i++) answerCurrentItem(api);

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const [staged, asked] = onDone.mock.calls[0] as [Record<string, SeededDepth>, number];
    expect(Object.keys(staged).sort()).toEqual([...strands].sort());
    expect(asked).toBe(strands.length);
  });

  // The assertion an AnswerOption-only implementation fails, and nowhere else.
  // context's only placement template generates `find_the_bar`, which needs
  // score-tap wiring rather than answer cards.
  test('the context item is answerable, so all seven strands can be seeded', async () => {
    // Prove the premise first, or this test could pass by context never appearing.
    const contextItem = (() => {
      let session = startPlacement();
      for (let i = 0; i < session.walks.length; i++) {
        const item = currentItem(session, i);
        if (item?.strand === 'context') return item;
        session = { ...session, index: session.index + 1 };
      }
      return null;
    })();
    expect(contextItem?.instance.interaction.type).toBe('find_the_bar');

    const onDone = jest.fn();
    const api = renderPlacement({ onDone });
    await api.findByTestId('placement-intro');
    fireEvent.press(api.getByTestId('placement-start'));
    for (let i = 0; i < placeableStrands().length; i++) answerCurrentItem(api);

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(Object.keys(onDone.mock.calls[0][0] as Record<string, SeededDepth>)).toContain('context');
  });

  test('every staged seed carries a day and its own increasing seq', async () => {
    const onDone = jest.fn();
    const api = renderPlacement({ onDone });
    await api.findByTestId('placement-intro');
    fireEvent.press(api.getByTestId('placement-start'));
    for (let i = 0; i < placeableStrands().length; i++) answerCurrentItem(api);

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const staged = onDone.mock.calls[0][0] as Record<string, SeededDepth>;
    const seqs = Object.values(staged).map((s) => s.seq);

    expect(new Set(seqs).size).toBe(seqs.length); // reserved per strand, never shared
    for (const seed of Object.values(staged)) expect(seed.day).toBe(DAY);
  });

  // KTD6: the commit is a later step, after the coached warm-up.
  test('completing the whole pass persists nothing', async () => {
    const storage = memoryStorage(JSON.stringify(new ProgressStore().toSnapshot()));
    const before = storage.blob;
    const api = renderPlacement({}, storage);
    await api.findByTestId('placement-intro');
    fireEvent.press(api.getByTestId('placement-start'));
    for (let i = 0; i < placeableStrands().length; i++) answerCurrentItem(api);

    await waitFor(() => expect(storage.blob).toBe(before));
  });
});

describe('PlacementScreen — the per-skill re-test ladder (R7a)', () => {
  test('a re-test goes straight to its question, skipping the expectation screen', async () => {
    const { findByTestId, queryByTestId } = renderPlacement({ retestStrand: 'scales_keys' });
    await findByTestId('placement-item');

    expect(queryByTestId('placement-intro')).toBeNull();
  });

  // B2's "3 of ~4": the never-revisit rule usually stops a short ladder early, so a
  // bare "/4" would promise questions the walk will never ask.
  test('the ladder total is marked approximate', async () => {
    const { findByTestId, getByTestId } = renderPlacement({ retestStrand: 'scales_keys' });
    await findByTestId('placement-item');

    expect(getByTestId('placement-counter')).toHaveTextContent('1/~4');
  });

  test('it measures that strand alone and reports exactly one seed', async () => {
    const onDone = jest.fn();
    const api = renderPlacement({ retestStrand: 'chords', onDone });
    await api.findByTestId('placement-item');

    // chords' ladder is [4, 5], so under the never-revisit rule it asks at most two.
    for (let i = 0; i < ladderFor('chords').length && !onDone.mock.calls.length; i++) answerCurrentItem(api);

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(Object.keys(onDone.mock.calls[0][0] as Record<string, SeededDepth>)).toEqual(['chords']);
  });

  test('a re-test still writes nothing — the caller commits it', async () => {
    const storage = memoryStorage(JSON.stringify(new ProgressStore().toSnapshot()));
    const before = storage.blob;
    const onDone = jest.fn();
    const api = renderPlacement({ retestStrand: 'chords', onDone }, storage);
    await api.findByTestId('placement-item');
    for (let i = 0; i < ladderFor('chords').length && !onDone.mock.calls.length; i++) answerCurrentItem(api);

    await waitFor(() => expect(storage.blob).toBe(before));
  });
});
