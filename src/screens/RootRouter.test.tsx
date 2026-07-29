// First-run routing (U7) — the DoD's outer loop for the new journey:
//   new user   → Welcome → grade select → your plan → 3-question warm-up →
//                landed → Continue → lane list
//   returning  → straight to the lane list, Welcome never shown
// Invariants guarded: the age gate never appears on the primary path (it moved to
// account creation), and BOTH Landing CTAs mark the guest onboarded.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { generate } from '../engine/generators';
import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
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

function correctIndexFor(seed: number): number {
  const instance = generate('note_value_compare', { grade: 1, seed, atoms: ['note_value_compare'] });
  return assembleOptions(instance).findIndex((o) => o.correct);
}

async function answerWarmUp(getByTestId: (id: string) => any) {
  for (let seed = 0; seed < 3; seed++) {
    await act(async () => fireEvent.press(getByTestId(`option-${correctIndexFor(seed)}`)));
    await act(async () => fireEvent.press(getByTestId('check')));
    await act(async () => fireEvent.press(getByTestId('feedback-sheet-continue')));
  }
}

/** Walk Welcome → grade → plan → warm-up (3 correct) → Landing, stopping there. */
async function walkToLanding(getByTestId: (id: string) => any, findByTestId: (id: string) => Promise<any>) {
  await findByTestId('welcome-screen');
  await act(async () => fireEvent.press(getByTestId('start-learning')));
  await findByTestId('grade-select-screen');
  await act(async () => fireEvent.press(getByTestId('start-grade')));
  await findByTestId('plan-screen');
  await act(async () => fireEvent.press(getByTestId('plan-start-warmup')));
  await findByTestId('warm-up-screen');
  await answerWarmUp(getByTestId);
  await findByTestId('landed-screen');
}

describe('RootRouter — new first-run journey (A7, no age gate)', () => {
  test('new user walks Welcome → grade → plan → warm-up → landed → Continue → lane list', async () => {
    const storage = memoryStorage();
    const { getByTestId, findByTestId, queryByTestId } = render(
      <ProgressProvider storage={storage}>
        <RootRouter />
      </ProgressProvider>,
    );

    await walkToLanding(getByTestId, findByTestId);

    // The age gate never appeared anywhere on the primary path.
    expect(queryByTestId('age-gate-screen')).toBeNull();
    expect(queryByTestId('under13-block')).toBeNull();

    await act(async () => fireEvent.press(getByTestId('landed-continue')));

    expect(await findByTestId('lanes-screen')).toBeTruthy();
    // Onboarding persisted the selected grade, not a birth year.
    expect(storage.blob).toContain('"grade":1');
    expect(storage.blob).not.toContain('birthYear');
  });

  test('the "Explore the app" CTA also onboards (both Landing CTAs persist)', async () => {
    const storage = memoryStorage();
    const { getByTestId, findByTestId } = render(
      <ProgressProvider storage={storage}>
        <RootRouter />
      </ProgressProvider>,
    );

    await walkToLanding(getByTestId, findByTestId);
    await act(async () => fireEvent.press(getByTestId('landed-explore')));

    expect(await findByTestId('lanes-screen')).toBeTruthy();
    expect(storage.blob).toContain('"grade":1');
  });

  test('returning user skips onboarding and lands on the lane list', async () => {
    // Seed the blob a completed onboarding leaves behind, then reload from it.
    const seedStorage = memoryStorage();
    const seed = render(
      <ProgressProvider storage={seedStorage}>
        <RootRouter />
      </ProgressProvider>,
    );
    await walkToLanding(seed.getByTestId, seed.findByTestId);
    await act(async () => fireEvent.press(seed.getByTestId('landed-continue')));
    await seed.findByTestId('lanes-screen');
    const seededBlob = seedStorage.blob;
    seed.unmount();

    const { findByTestId, queryByTestId } = render(
      <ProgressProvider storage={memoryStorage(seededBlob)}>
        <RootRouter />
      </ProgressProvider>,
    );

    expect(await findByTestId('lanes-screen')).toBeTruthy();
    expect(queryByTestId('welcome-screen')).toBeNull();
  });
});
