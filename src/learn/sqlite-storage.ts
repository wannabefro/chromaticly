// KTD6 persistence adapter: the concrete SnapshotStorage backed by
// expo-sqlite's kv-store (a SQLite-backed async key/value store). The store's
// versioning/migration lives in store.ts; this only moves the serialized blob
// in and out under a single key. This is the one device-specific module — it's
// mocked in tests and dogfooded on a simulator.

import Storage from 'expo-sqlite/kv-store';

import type { SnapshotStorage } from './store';

const PROGRESS_KEY = 'chromaticly.progress';

export const sqliteStorage: SnapshotStorage = {
  load: () => Storage.getItem(PROGRESS_KEY),
  save: (serialized) => Storage.setItem(PROGRESS_KEY, serialized),
};
