// First-run routing (U11) — the DoD's outer loop for the measured journey:
//   new user   → Welcome → placement → result → your plan → 3-question warm-up →
//                landed → Continue → lane list
//   skipping   → Welcome → placement → skip screen → plan → warm-up → landed
//   returning  → straight to the lane list, Welcome never shown
//
// The load-bearing invariant is ONE PERSISTENCE POINT (KTD6). Most of the tests
// below exist to prove nothing is written before Landed — on every route, and
// under a double tap. The age gate never appears; it moved to account creation.
//
// Placement items are driven for real, not stubbed. Placement is wider than MCQ
// and a stubbed runner would let the router look right while context is
// unmeasurable.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { generate } from '../engine/generators';
import { placeableStrands } from '../learn/placement';
import { ProgressProvider } from '../learn/ProgressContext';
import { ProgressStore, type SnapshotStorage } from '../learn/store';
import { warmUpFor } from '../learn/warm-up';
import { assembleOptions } from '../ui/grading';
import RootRouter from './RootRouter';

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

function renderRouter(storage = memoryStorage()) {
  return {
    storage,
    ...render(
      <ProgressProvider storage={storage}>
        <RootRouter />
      </ProgressProvider>,
    ),
  };
}

/** Answer whatever interaction is on screen. Generic on purpose — the placement
 *  bank spans MCQ cards, the context passage's bar taps and the chord chips. */
function answerCurrentItem(api: ReturnType<typeof render>) {
  const { queryByTestId, getByTestId } = api;

  if (queryByTestId('mcq')) fireEvent.press(getByTestId('option-0'));
  else if (queryByTestId('find-the-bar')) fireEvent.press(getByTestId('bar-1'));
  else if (queryByTestId('roman-numeral-boxes')) fireEvent.press(getByTestId('roman-numeral-I'));
  else throw new Error('placement served an interaction this helper cannot answer');

  act(() => fireEvent.press(getByTestId('check')));
  act(() => fireEvent.press(getByTestId('feedback-sheet-continue')));
}

/** Welcome → the whole placement pass → the result screen. */
async function walkPlacement(api: ReturnType<typeof render>) {
  await api.findByTestId('welcome-screen');
  await act(async () => fireEvent.press(api.getByTestId('start-learning')));
  await api.findByTestId('placement-intro');
  await act(async () => fireEvent.press(api.getByTestId('placement-start')));

  for (let i = 0; i < placeableStrands().length; i++) {
    if (api.queryByTestId('placement-result')) break;
    answerCurrentItem(api);
  }
  await api.findByTestId('placement-result');
}

/** Read from the warm-up definition, never re-declared — a hardcoded atom here
 *  answers a question the warm-up is no longer asking, and the walk then loops on
 *  retry-until-correct instead of reaching Landing. */
function correctIndexFor(index: number, grade: number | null = null): number {
  const w = warmUpFor(grade);
  const instance = generate(w.template, { grade: w.grade, seed: w.seeds[index], atoms: [w.atom] });
  return assembleOptions(instance).findIndex((o) => o.correct);
}

async function answerWarmUp(api: ReturnType<typeof render>, grade: number | null = null) {
  for (let seed = 0; seed < 3; seed++) {
    await act(async () => fireEvent.press(api.getByTestId(`option-${correctIndexFor(seed, grade)}`)));
    await act(async () => fireEvent.press(api.getByTestId('check')));
    await act(async () => fireEvent.press(api.getByTestId('feedback-sheet-continue')));
  }
}

/** Plan → warm-up → Landing, stopping there. */
async function walkToLanding(api: ReturnType<typeof render>, grade: number | null = null) {
  await api.findByTestId('plan-screen');
  await act(async () => fireEvent.press(api.getByTestId('plan-start-warmup')));
  await api.findByTestId('warm-up-screen');
  await answerWarmUp(api, grade);
  await api.findByTestId('landed-screen');
}

describe('RootRouter — the measured first-run journey (R1, A7, no age gate)', () => {
  test('new user walks Welcome → placement → result → plan → warm-up → landed → lane list', async () => {
    const api = renderRouter();

    await walkPlacement(api);
    await act(async () => fireEvent.press(api.getByTestId('placement-accept')));
    await walkToLanding(api);

    // The age gate never appeared anywhere on the primary path.
    expect(api.queryByTestId('age-gate-screen')).toBeNull();
    expect(api.queryByTestId('under13-block')).toBeNull();

    await act(async () => fireEvent.press(api.getByTestId('landed-continue')));

    expect(await api.findByTestId('lanes-screen')).toBeTruthy();
    expect(api.storage.blob).not.toContain('birthYear');
  });

  // R1: placement seeds seven independent depths. A grade-pill screen on this path
  // would re-assert the single rank the whole model exists to stop.
  test('no grade ladder is offered on the primary path', async () => {
    const api = renderRouter();

    await api.findByTestId('welcome-screen');
    await act(async () => fireEvent.press(api.getByTestId('start-learning')));

    expect(api.queryByTestId('grade-select-screen')).toBeNull();
    for (let g = 1; g <= 5; g++) expect(api.queryByTestId(`grade-pill-${g}`)).toBeNull();
  });

  test('committing writes one seeded depth per measured strand', async () => {
    const api = renderRouter();

    await walkPlacement(api);
    await act(async () => fireEvent.press(api.getByTestId('placement-accept')));
    await walkToLanding(api);
    await act(async () => fireEvent.press(api.getByTestId('landed-continue')));
    await api.findByTestId('lanes-screen');

    const seeded = new ProgressStore(JSON.parse(api.storage.blob as string)).allSeededDepths();
    expect(Object.keys(seeded).sort()).toEqual([...placeableStrands()].sort());
  });

  // The latch that stops a double tap also survived a rejected write, so both
  // CTAs were dead until relaunch.
  test('a failed write says so, and leaves the Landed CTAs live for a retry', async () => {
    const storage = memoryStorage();
    let failWrites = false;
    const save = storage.save.bind(storage);
    storage.save = async (serialized: string) => {
      if (failWrites) throw new Error('sqlite is unavailable');
      await save(serialized);
    };

    const api = renderRouter(storage);
    await walkPlacement(api);
    await act(async () => fireEvent.press(api.getByTestId('placement-accept')));
    await walkToLanding(api);

    failWrites = true;
    await act(async () => fireEvent.press(api.getByTestId('landed-continue')));
    expect(api.queryByTestId('lanes-screen')).toBeNull();
    expect(api.getByTestId('landed-save-failed')).toBeTruthy();
    failWrites = false;

    await act(async () => fireEvent.press(api.getByTestId('landed-continue')));
    expect(await api.findByTestId('lanes-screen')).toBeTruthy();
  });

  test('the "Explore the app" CTA also onboards (both Landing CTAs persist)', async () => {
    const api = renderRouter();

    await walkPlacement(api);
    await act(async () => fireEvent.press(api.getByTestId('placement-accept')));
    await walkToLanding(api);
    await act(async () => fireEvent.press(api.getByTestId('landed-explore')));

    expect(await api.findByTestId('lanes-screen')).toBeTruthy();
    expect(api.storage.blob).not.toBeNull();
  });

  test('returning user skips onboarding and lands on the lane list', async () => {
    const seed = renderRouter();
    await walkPlacement(seed);
    await act(async () => fireEvent.press(seed.getByTestId('placement-accept')));
    await walkToLanding(seed);
    await act(async () => fireEvent.press(seed.getByTestId('landed-continue')));
    await seed.findByTestId('lanes-screen');
    const seededBlob = seed.storage.blob;
    seed.unmount();

    const api = renderRouter(memoryStorage(seededBlob));

    expect(await api.findByTestId('lanes-screen')).toBeTruthy();
    expect(api.queryByTestId('welcome-screen')).toBeNull();
  });
});

// KTD6. Every one of these would still let the screens look correct — that is
// exactly why they are pinned. A half-placed store recovered from a crash is
// worse than none: some lanes seeded, others not, and no way to tell which.
describe('RootRouter — one persistence point, and it is Landed (KTD6)', () => {
  test('nothing is written by the placement pass or the result screen', async () => {
    const api = renderRouter();

    await walkPlacement(api);

    expect(api.storage.blob).toBeNull();
  });

  // The warm-up DOES write, and should — it is real practice, so its attempts
  // belong in the store. What must not exist yet is the ONBOARDING mutation: the
  // profile and the seeded vector. Asserting "the adapter received no write"
  // instead would fail here for a reason that is not a defect.
  test('the plan screen and the warm-up write no profile and no seeded depth', async () => {
    const api = renderRouter();

    await walkPlacement(api);
    await act(async () => fireEvent.press(api.getByTestId('placement-accept')));
    await walkToLanding(api);

    const store = new ProgressStore(JSON.parse(api.storage.blob as string));
    expect(store.getProfile()).toBeNull();
    expect(store.allSeededDepths()).toEqual({});
  });

  test('the skip route also defers its write to Landed', async () => {
    const api = renderRouter();

    await api.findByTestId('welcome-screen');
    await act(async () => fireEvent.press(api.getByTestId('start-learning')));
    await api.findByTestId('placement-intro');
    await act(async () => fireEvent.press(api.getByTestId('placement-skip')));
    await api.findByTestId('grade-select-screen');
    await act(async () => fireEvent.press(api.getByTestId('start-grade')));

    // Choosing a starting point stages it. Writing here would be a second commit
    // site, which is the thing KTD6 exists to prevent.
    expect(api.storage.blob).toBeNull();
  });

  // Two CTAs, an async write, and a re-render. Without the guard the second tap
  // lands before `isOnboarded` flips and the screen unmounts.
  test('two rapid taps on Continue commit once', async () => {
    const storage = memoryStorage();
    let saves = 0;
    const counting = {
      ...storage,
      async save(s: string) {
        saves += 1;
        storage.blob = s;
      },
    };
    const api = renderRouter(counting as typeof storage);

    await walkPlacement(api);
    await act(async () => fireEvent.press(api.getByTestId('placement-accept')));
    await walkToLanding(api);
    // Counted from Landing, because the warm-up's three attempts saved legitimately.
    saves = 0;
    await act(async () => {
      fireEvent.press(api.getByTestId('landed-continue'));
      fireEvent.press(api.getByTestId('landed-continue'));
    });

    expect(saves).toBe(1);
  });

  test('unmounting mid-placement leaves nothing behind and restarts at Welcome', async () => {
    const storage = memoryStorage();
    const first = renderRouter(storage);
    await first.findByTestId('welcome-screen');
    await act(async () => fireEvent.press(first.getByTestId('start-learning')));
    await first.findByTestId('placement-intro');
    await act(async () => fireEvent.press(first.getByTestId('placement-start')));
    answerCurrentItem(first);
    first.unmount();

    expect(storage.blob).toBeNull();

    const second = renderRouter(memoryStorage(storage.blob));
    expect(await second.findByTestId('welcome-screen')).toBeTruthy();
  });
});

// "Skip — start from the beginning" is the CTA that reaches this route, so the
// beginning is what it has to deliver. Before the delta plan, commitOnboarding's
// 1..5 clamp made First steps unreachable from onboarding and nothing failed.
describe('RootRouter — the "I know my grade" route (delta plan finding 3, 5a restored)', () => {
  async function walkSkip(api: ReturnType<typeof render>) {
    await api.findByTestId('welcome-screen');
    await act(async () => fireEvent.press(api.getByTestId('start-learning')));
    await api.findByTestId('placement-intro');
    await act(async () => fireEvent.press(api.getByTestId('placement-skip')));
    await api.findByTestId('grade-select-screen');
  }

  // First steps sits below the ladder, so there is no rung to claim.
  test('First steps commits grade 0, and seeds nothing', async () => {
    const api = renderRouter();

    await walkSkip(api);
    await act(async () => fireEvent.press(api.getByTestId('start-point-0')));
    await act(async () => fireEvent.press(api.getByTestId('start-grade')));
    await walkToLanding(api, 0);
    await act(async () => fireEvent.press(api.getByTestId('landed-continue')));

    const store = new ProgressStore(JSON.parse(api.storage.blob as string));
    expect(store.getProfile()?.grade).toBe(0);
    expect(store.allSeededDepths()).toEqual({});
  });

  // A named grade claims all seven strands, so it seeds the whole vector.
  test('choosing Grade 3 seeds every placeable strand, not just the profile', async () => {
    const api = renderRouter();

    await walkSkip(api);
    await act(async () => fireEvent.press(api.getByTestId('start-point-3')));
    await act(async () => fireEvent.press(api.getByTestId('start-grade')));
    await api.findByTestId('placement-result');
    await act(async () => fireEvent.press(api.getByTestId('placement-accept')));
    await walkToLanding(api);
    await act(async () => fireEvent.press(api.getByTestId('landed-continue')));

    const store = new ProgressStore(JSON.parse(api.storage.blob as string));
    const seeded = store.allSeededDepths();
    expect(Object.keys(seeded).sort()).toEqual([...placeableStrands()].sort());
    expect(seeded.rhythm?.depth).toBe(3);
    // Chords teaches nothing below grade 4, so the claim stops at its own ladder.
    expect(seeded.chords?.depth).toBe(0);
    expect(store.getProfile()?.grade).toBe(3);
  });

  // A claim the learner cannot see is a claim they cannot correct.
  test('a named grade lands on the result screen, framed as a call rather than a measurement', async () => {
    const api = renderRouter();

    await walkSkip(api);
    await act(async () => fireEvent.press(api.getByTestId('start-point-2')));
    await act(async () => fireEvent.press(api.getByTestId('start-grade')));

    await api.findByTestId('placement-result');
    expect(api.getByText('Your call · Grade 2')).toBeTruthy();
    expect(api.queryByText(/Placement · \d+ question/)).toBeNull();
  });

  test('Back returns to the placement pass', async () => {
    const api = renderRouter();

    await walkSkip(api);
    await act(async () => fireEvent.press(api.getByTestId('grade-select-back')));

    expect(await api.findByTestId('placement-intro')).toBeTruthy();
  });

  // The First-steps route must not be opened with notation the learner has never
  // been taught to read — the reason CoachedWarmUp takes a grade at all.
  test('the First-steps route runs the grade-0 warm-up, not the grade-1 one', async () => {
    const api = renderRouter();

    await walkSkip(api);
    await act(async () => fireEvent.press(api.getByTestId('start-point-0')));
    await act(async () => fireEvent.press(api.getByTestId('start-grade')));
    await api.findByTestId('plan-screen');

    expect(api.queryByText(warmUpFor(0).title)).toBeTruthy();
    expect(api.queryByText(warmUpFor(1).title)).toBeNull();
  });
});
