// One progress store shared across every screen (learn map, lesson, practice)
// so they never diverge. The provider owns a single useProgress; screens read it
// via useProgressContext. Storage is injectable (real app: sqliteStorage; tests:
// an in-memory fake), which is why the concrete adapter is a prop, not a hardcode.

import { createContext, useContext, type ReactNode } from 'react';

import { LESSONS } from '../content/lessons';
import { sqliteStorage } from './sqlite-storage';
import type { SnapshotStorage } from './store';
import { useProgress, type UseProgress } from './useProgress';

const ProgressContext = createContext<UseProgress | null>(null);

export function ProgressProvider({
  children,
  storage = sqliteStorage,
}: {
  children: ReactNode;
  storage?: SnapshotStorage;
}) {
  const progress = useProgress(storage, LESSONS);
  return <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>;
}

export function useProgressContext(): UseProgress {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgressContext must be used within a ProgressProvider');
  return ctx;
}
