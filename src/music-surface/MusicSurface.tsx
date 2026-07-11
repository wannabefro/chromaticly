import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { musicToAbc } from '../music/abc-emitter';
import type { Music } from '../music/types';
import abcjsSource from './abcjs-source.json';
import { decodeEvent, encodeCommand, type SurfaceCommand, type SurfaceEvent } from './bridge';
import { buildSurfaceHtml } from './surface-html';

const ABCJS_SOURCE = (abcjsSource as { source: string }).source;

export interface MusicSurfaceHandle {
  play(): void;
  stop(): void;
}

export interface MusicSurfaceProps {
  music: Music;
  soundFontUrl?: string;
  onEvent?: (ev: SurfaceEvent) => void;
  /** Explicit height for the notation. react-native-webview collapses to 0 with
   *  no height (unlike a browser, which flows to content), so a stave needs one. */
  height?: number;
}

/** Pure message seam: decode a WebView message and forward it. Returns the event (or null). */
export function dispatchMessage(data: string, onEvent?: (ev: SurfaceEvent) => void): SurfaceEvent | null {
  let ev: SurfaceEvent;
  try {
    ev = decodeEvent(data);
  } catch {
    return null;
  }
  onEvent?.(ev);
  return ev;
}

export const MusicSurface = forwardRef<MusicSurfaceHandle, MusicSurfaceProps>(function MusicSurface(
  { music, soundFontUrl, onEvent, height = 160 },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const abc = useMemo(() => musicToAbc(music), [music]);
  // HTML is stable (abcjs is 500KB — don't rebuild per note); ABC arrives via a render command.
  const html = useMemo(() => buildSurfaceHtml({ abcjsSource: ABCJS_SOURCE, soundFontUrl }), [soundFontUrl]);

  const send = useCallback((cmd: SurfaceCommand) => {
    webRef.current?.postMessage(encodeCommand(cmd));
  }, []);

  useImperativeHandle(ref, () => ({ play: () => send({ type: 'play' }), stop: () => send({ type: 'stop' }) }), [send]);

  // Render the current stimulus once the surface is ready and whenever it changes.
  useEffect(() => {
    if (ready) send({ type: 'render', abc });
  }, [ready, abc, send]);

  const handleMessage = useCallback(
    (e: WebViewMessageEvent) => {
      const ev = dispatchMessage(e.nativeEvent.data, onEvent);
      if (ev?.type === 'ready') setReady(true);
    },
    [onEvent],
  );

  // Wrap in a fixed-height View: react-native-webview does not reliably honor its
  // own style `height` in every parent layout (it collapsed to 0 inside a plain
  // flex column), but a View with an explicit height always lays out, and the
  // WebView fills it via flex.
  return (
    <View style={{ height }}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
});
