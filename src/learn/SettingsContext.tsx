// One settings store shared across every screen (design 5c). The provider owns a
// single useSettings; screens read it via useSettingsContext.
//
// Unlike ProgressContext, the context has a working DEFAULT value and does not throw
// when a provider is absent: settings are read in leaf notation/input components
// (NotationCard, StaveInput) that render across many tests, and this is a purely
// additive preference feature — degrading to defaults (medium notation, right-handed)
// is exactly the pre-settings behaviour, so a missing provider is safe rather than a
// bug to surface. The no-op setters are never reached at runtime (the app always
// mounts the provider); only the settings UI calls them, and it lives under it.

import { createContext, useContext, type ReactNode } from 'react';

import { defaultSettings } from './settings';
import type { SnapshotStorage } from './store';
import { useSettings, type UseSettings } from './useSettings';

const DEFAULT_CONTEXT: UseSettings = {
  ready: true,
  settings: defaultSettings(),
  setNotationScale: async () => {},
  setHandedness: async () => {},
};

const SettingsContext = createContext<UseSettings>(DEFAULT_CONTEXT);

export function SettingsProvider({ children, storage }: { children: ReactNode; storage: SnapshotStorage }) {
  const settings = useSettings(storage);
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext(): UseSettings {
  return useContext(SettingsContext);
}
