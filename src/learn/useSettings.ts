// Thin React hook over SettingsStore: load once, expose the current settings and
// setters that mutate + persist. Settings values ARE read in render (notation scale
// re-renders the score, handedness mirrors the stave input), so — unlike the legacy
// progress lookups — they are mirrored into real useState, not read from the mutable
// store in render. React Compiler (on in the app bundle, off in jest) memoizes a
// store read on the store's identity, which never changes under in-place mutation,
// so a store read would go stale on device while jest stays green.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { defaultSettings, loadSettings, saveSettings, type Settings } from './settings';
import type { SnapshotStorage } from './store';

export interface UseSettings {
  ready: boolean;
  settings: Settings;
  setNotationScale: (scale: Settings['notationScale']) => Promise<void>;
  setHandedness: (handedness: Settings['handedness']) => Promise<void>;
}

export function useSettings(storage: SnapshotStorage): UseSettings {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [store, setStore] = useState<Awaited<ReturnType<typeof loadSettings>> | null>(null);

  useEffect(() => {
    let live = true;
    loadSettings(storage).then((loaded) => {
      if (!live) return;
      setStore(loaded);
      setSettings(loaded.get());
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [storage]);

  const patch = useCallback(
    async (next: Partial<Settings>) => {
      if (!store) return;
      store.set(next);
      const applied = store.get();
      setSettings(applied); // real state → consumers (notation, stave input) react
      await saveSettings(store, storage);
    },
    [store, storage],
  );

  const setNotationScale = useCallback<UseSettings['setNotationScale']>((scale) => patch({ notationScale: scale }), [patch]);
  const setHandedness = useCallback<UseSettings['setHandedness']>((handedness) => patch({ handedness }), [patch]);

  return useMemo(
    () => ({ ready, settings, setNotationScale, setHandedness }),
    [ready, settings, setNotationScale, setHandedness],
  );
}
