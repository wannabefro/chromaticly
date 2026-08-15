// The lane depths STAGED seeds would produce, without writing them.
// Shared by the placement result and Landed, so a preview cannot lie (R3, KTD5).

import { useMemo } from 'react';

import { laneDepths } from './lane-depth';
import { useProgressContext } from './ProgressContext';
import { ProgressStore, type SeededDepth } from './store';

export function usePreviewDepths(staged: Record<string, SeededDepth>) {
  const { store, clock, revision } = useProgressContext();

  return useMemo(() => {
    const snapshot = store ? (JSON.parse(JSON.stringify(store.toSnapshot())) as ReturnType<ProgressStore['toSnapshot']>) : undefined;
    const transient = new ProgressStore(snapshot, clock.now());
    for (const [strand, seed] of Object.entries(staged)) transient.setSeededDepth(strand, seed);
    return laneDepths(transient, clock.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6), not read directly above
  }, [store, revision, clock, staged]);
}
