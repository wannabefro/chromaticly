// KTD6 persistence adapter: the concrete SnapshotStorage backed by
// expo-sqlite's kv-store (a SQLite-backed async key/value store). The store's
// versioning/migration lives in learn/store.ts; this only moves the serialized
// blob in and out under a single key. Lives outside the portable core (src/learn)
// because it is the one device-specific module — a future web build supplies its
// own adapter (IndexedDB) behind the same SnapshotStorage port.

import Storage from 'expo-sqlite/kv-store';

import type { SnapshotStorage } from '../learn/store';

const PROGRESS_KEY = 'chromaticly.progress';

export const sqliteStorage: SnapshotStorage = {
  load: () => Storage.getItem(PROGRESS_KEY),
  save: (serialized) => Storage.setItem(PROGRESS_KEY, serialized),
};
