// The "sound this abc" seam, apart from `SvgRenderService` so an audio-only
// caller does not pull `react-native-webview` into its module graph.

import { createContext, useContext } from 'react';

/** Sound an abc string on the shared offscreen surface — no stave, no card. */
export type PlayAbc = (abc: string) => void;

export const AbcPlayerContext = createContext<PlayAbc | null>(null);

export function useAbcPlayer(): PlayAbc | null {
  return useContext(AbcPlayerContext);
}
