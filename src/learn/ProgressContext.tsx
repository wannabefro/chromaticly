// One progress store shared across every screen (learn map, lesson, practice)
// so they never diverge. The provider owns a single useProgress; screens read it
// via useProgressContext. Storage is injected by the platform edge (the app supplies
// the device adapter; tests supply an in-memory fake) — this core module never names
// a concrete adapter, so it stays free of platform imports and portable to web.

import { createContext, useContext, type ReactNode } from 'react';

import { LESSONS } from '../content/lessons';
import type { SnapshotStorage } from './store';
import { useProgress, type UseProgress } from './useProgress';

const ProgressContext = createContext<UseProgress | null>(null);

export function ProgressProvider({
  children,
  storage,
}: {
  children: ReactNode;
  storage: SnapshotStorage;
}) {
  const progress = useProgress(storage, LESSONS);
  return <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>;
}

export function useProgressContext(): UseProgress {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgressContext must be used within a ProgressProvider');
  return ctx;
}
