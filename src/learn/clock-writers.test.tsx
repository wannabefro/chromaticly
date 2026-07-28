// G6 U1: every SRS writer records on the shared day clock, and scheduling
// survives a restart.
//
// Why this file exists separately from the per-screen tests: the old design kept
// a `useRef(0)` tick counter per screen, so "the clock" was really three clocks
// that all restarted at 0. Counting those refs undercounts the work — there are
// three refs but FIVE write sites, three of them inside SetRunner alone (binary
// result, passage sub-result, flashcard grade). A conversion that misses one
// leaves two time bases writing into the same persisted `nextDue`, which no
// single-path test can see. These tests pin each writer to the injected clock.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';

import { fixedClock } from './clock';
import { ProgressProvider, useProgressContext } from './ProgressContext';
import type { SnapshotStorage } from './store';

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

/** Drives one writer through the real provider, then hands back the store. */
function Harness({ run, onReady }: { run: (p: ReturnType<typeof useProgressContext>) => Promise<void>; onReady: (p: ReturnType<typeof useProgressContext>) => void }) {
  const progress = useProgressContext();
  useEffect(() => {
    if (!progress.ready) return;
    void run(progress).then(() => onReady(progress));
  }, [progress.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

async function withProgress(day: number, run: (p: ReturnType<typeof useProgressContext>) => Promise<void>) {
  const clock = fixedClock(day);
  let captured: ReturnType<typeof useProgressContext> | null = null;
  const storage = memoryStorage();
  render(
    <ProgressProvider storage={storage} clock={clock}>
      <Harness run={run} onReady={(p) => (captured = p)} />
    </ProgressProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return { get: () => captured!, clock, storage };
}

const DAY = 20_600;

describe('SRS writers record on the shared day clock (G6 U1)', () => {
  test('recordAtom — the binary path (SetRunner result, Practice) stamps the clock day', async () => {
    const h = await withProgress(DAY, async (p) => {
      await p.recordAtom('note_read:treble:C4', { correct: true, hintsUsed: 0, atom: null }, p.clock.now());
    });

    const srs = h.get().store!.getAtom('note_read:treble:C4').srs;
    expect(srs.lastReviewed).toBe(DAY);
    expect(srs.lastReviewed).not.toBe(0); // the old tick base
  });

  test('recordFlashcardGrade — the graded path stamps the same clock, not its own counter', async () => {
    // A separate reducer from recordAtom (useProgress), so a conversion that
    // updates only the binary path leaves this one on tick time.
    const h = await withProgress(DAY, async (p) => {
      await p.recordFlashcardGrade('term:allegro', 'good', p.clock.now());
    });

    expect(h.get().store!.getAtom('term:allegro').srs.lastReviewed).toBe(DAY);
  });

  test('both reducers advance writeSeq, and the later write carries the later seq', async () => {
    // Same day, so `lastReviewed` cannot order them — `seq` is the only fact that
    // can, and it is what a placement re-test is compared against.
    const h = await withProgress(DAY, async (p) => {
      await p.recordAtom('note_read:treble:C4', { correct: true, hintsUsed: 0, atom: null }, p.clock.now());
      await p.recordFlashcardGrade('term:allegro', 'good', p.clock.now());
    });

    const store = h.get().store!;
    const first = store.getAtom('note_read:treble:C4').srs.seq!;
    const second = store.getAtom('term:allegro').srs.seq!;
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
  });

  test('an atom reviewed into box 2 is not due the next day but is due two days on', async () => {
    const h = await withProgress(DAY, async (p) => {
      await p.recordAtom('a', { correct: true, hintsUsed: 0, atom: null }, p.clock.now());
      await p.recordAtom('a', { correct: true, hintsUsed: 0, atom: null }, p.clock.now());
    });

    const srs = h.get().store!.getAtom('a').srs;
    expect(srs.box).toBe(2);
    expect(srs.nextDue).toBe(DAY + 2);
  });

  test('scheduling survives a restart — the F1 regression', async () => {
    // The whole point of the port. Under the old per-session tick the reloaded
    // store's `nextDue` was measured in "attempts this session", so after a
    // restart nothing was ever meaningfully due.
    const first = await withProgress(DAY, async (p) => {
      await p.recordAtom('a', { correct: true, hintsUsed: 0, atom: null }, p.clock.now());
    });
    const blob = first.storage.blob;

    const laterClock = fixedClock(DAY + 10);
    let later: ReturnType<typeof useProgressContext> | null = null;
    const storage = memoryStorage();
    storage.blob = blob;
    render(
      <ProgressProvider storage={storage} clock={laterClock}>
        <Harness run={async () => {}} onReady={(p) => (later = p)} />
      </ProgressProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    const srs = later!.store!.getAtom('a').srs;
    expect(srs.nextDue).toBe(DAY + 1);
    expect(laterClock.now()).toBeGreaterThan(srs.nextDue); // genuinely due again
  });
});
