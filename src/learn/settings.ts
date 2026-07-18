// User settings (design 5c). A small, versioned, persisted preference blob kept
// behind the same async SnapshotStorage port as progress (store.ts) — held in
// memory, serialized to a versioned snapshot, and testable with an in-memory fake.
//
// Only the settings with real, wired effects live here. The design's five settings
// are deliberately partial: terminology (UK/US), colour-vision palette, and feedback
// audio are not yet built (each needs a large refactor, new design tokens, or a new
// audio dependency), so they are absent rather than faked. See ProfileScreen.

import type { SnapshotStorage } from './store';

export const SETTINGS_VERSION = 1;

/** Discrete notation scale. `medium` is the historical default (abcjs scale 1.5). */
export type NotationScale = 'small' | 'medium' | 'large';
/** Which side the floating stave-input controls sit on (design 5c left-hand input). */
export type Handedness = 'right' | 'left';

export interface Settings {
  notationScale: NotationScale;
  handedness: Handedness;
}

/** abcjs `scale` for each notation size. `medium` matches the surface's baked default,
 *  so an unset/absent setting renders exactly as before. */
export const NOTATION_SCALES: Record<NotationScale, number> = {
  small: 1.15,
  medium: 1.5,
  large: 1.95,
};

export interface SettingsSnapshot {
  version: number;
  settings: Settings;
}

export function defaultSettings(): Settings {
  return { notationScale: 'medium', handedness: 'right' };
}

function emptySnapshot(): SettingsSnapshot {
  return { version: SETTINGS_VERSION, settings: defaultSettings() };
}

/** Bring any persisted snapshot up to the current shape. A version we can't migrate
 *  is discarded (start from defaults) rather than trusted — fail safe. Missing
 *  additive fields fall back to their default in place (same strategy as store.ts). */
function migrate(snapshot: SettingsSnapshot): SettingsSnapshot {
  if (snapshot.version !== SETTINGS_VERSION) return emptySnapshot();
  return { version: SETTINGS_VERSION, settings: { ...defaultSettings(), ...snapshot.settings } };
}

export class SettingsStore {
  private settings: Settings;

  constructor(snapshot: SettingsSnapshot = emptySnapshot()) {
    this.settings = migrate(snapshot).settings;
  }

  get(): Settings {
    return { ...this.settings };
  }

  set(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
  }

  toSnapshot(): SettingsSnapshot {
    return { version: SETTINGS_VERSION, settings: { ...this.settings } };
  }
}

export async function loadSettings(storage: SnapshotStorage): Promise<SettingsStore> {
  const raw = await storage.load();
  if (!raw) return new SettingsStore();
  try {
    return new SettingsStore(JSON.parse(raw) as SettingsSnapshot);
  } catch {
    return new SettingsStore(); // corrupt blob → defaults rather than crash
  }
}

export async function saveSettings(store: SettingsStore, storage: SnapshotStorage): Promise<void> {
  await storage.save(JSON.stringify(store.toSnapshot()));
}
