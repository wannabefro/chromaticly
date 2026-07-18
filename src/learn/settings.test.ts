import {
  defaultSettings,
  loadSettings,
  NOTATION_SCALES,
  saveSettings,
  SettingsStore,
  SETTINGS_VERSION,
  type SettingsSnapshot,
} from './settings';
import type { SnapshotStorage } from './store';

/** In-memory SnapshotStorage — a "restart" is loadSettings() against the same instance. */
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

describe('settings store', () => {
  test('a fresh store is medium notation, right-handed', () => {
    expect(new SettingsStore().get()).toEqual(defaultSettings());
    expect(defaultSettings()).toEqual({ notationScale: 'medium', handedness: 'right' });
  });

  test('medium scale equals the surface baked default (an unset size renders unchanged)', () => {
    expect(NOTATION_SCALES.medium).toBe(1.5);
    expect(NOTATION_SCALES.small).toBeLessThan(NOTATION_SCALES.medium);
    expect(NOTATION_SCALES.large).toBeGreaterThan(NOTATION_SCALES.medium);
  });

  // Why: a settings change must survive an app kill (KTD6 local persistence).
  test('a changed setting is read back after a restart', async () => {
    const storage = memoryStorage();
    const store = new SettingsStore();
    store.set({ notationScale: 'large' });
    store.set({ handedness: 'left' });
    await saveSettings(store, storage);

    const reloaded = await loadSettings(storage);
    expect(reloaded.get()).toEqual({ notationScale: 'large', handedness: 'left' });
  });

  test('a fresh load with no blob is the defaults', async () => {
    const reloaded = await loadSettings(memoryStorage());
    expect(reloaded.get()).toEqual(defaultSettings());
  });

  test('a corrupt blob falls back to defaults rather than throwing', async () => {
    const storage = memoryStorage();
    storage.blob = '{not json';
    const reloaded = await loadSettings(storage);
    expect(reloaded.get()).toEqual(defaultSettings());
  });

  // Why: an unknown snapshot version is fail-safe discarded, not trusted.
  test('an unmigratable version resets to defaults', () => {
    const future: SettingsSnapshot = {
      version: SETTINGS_VERSION + 1,
      settings: { notationScale: 'large', handedness: 'left' },
    };
    expect(new SettingsStore(future).get()).toEqual(defaultSettings());
  });

  // Why: a partial snapshot (a field added later) back-fills the missing field in place.
  test('a snapshot missing a field back-fills that field, keeps the rest', () => {
    const partial = { version: SETTINGS_VERSION, settings: { notationScale: 'small' } } as SettingsSnapshot;
    expect(new SettingsStore(partial).get()).toEqual({ notationScale: 'small', handedness: 'right' });
  });
});
