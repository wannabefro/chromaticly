// KTD6 persistence adapter: the concrete SnapshotStorage backed by
// expo-sqlite's kv-store (a SQLite-backed async key/value store). The store's
// versioning/migration lives in learn/store.ts; this only moves the serialized
// blob in and out under a single key. Lives outside the portable core (src/learn)
// because it is the one device-specific module — a future web build supplies its
// own adapter (IndexedDB) behind the same SnapshotStorage port.

import Storage from 'expo-sqlite/kv-store';

import type { SnapshotStorage } from '../learn/store';

/** One serialized blob under one key — the store's own versioning/migration lives in
 *  the core (learn/store.ts, learn/settings.ts); each domain gets its own key. */
function makeSqliteStorage(key: string): SnapshotStorage {
  return {
    load: () => Storage.getItem(key),
    save: (serialized) => Storage.setItem(key, serialized),
  };
}

export const sqliteStorage = makeSqliteStorage('chromaticly.progress');
export const settingsStorage = makeSqliteStorage('chromaticly.settings');
