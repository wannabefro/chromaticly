import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { musicToAbc } from '../music/abc-emitter';
import type { Music } from '../music/types';
import { colors } from '../ui/theme';
import abcjsSource from './abcjs-source.json';
import { decodeEvent, encodeCommand, type SurfaceCommand, type SurfaceEvent } from './bridge';
import { buildSurfaceHtml } from './surface-html';

const ABCJS_SOURCE = (abcjsSource as { source: string }).source;

export interface MusicSurfaceHandle {
  play(): void;
  stop(): void;
  /** Tint the selected bar in the score (design 4c), or clear with `null`. */
  highlightBar(bar: number | null, color?: string): void;
}

export interface MusicSurfaceProps {
  music: Music;
  soundFontUrl?: string;
  onEvent?: (ev: SurfaceEvent) => void;
  /** Explicit height for the notation. react-native-webview collapses to 0 with
   *  no height (unlike a browser, which flows to content), so a stave needs one. */
  height?: number;
  /** abcjs staff scale (design 5c notation size). Omit to keep the page's baked
   *  default; a change re-renders in place (no WebView reload — the HTML is stable). */
  scale?: number;
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
  { music, soundFontUrl, onEvent, height = 160, scale },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  // Whether abcjs has painted a stave yet. The WebView loads ~500KB of abcjs cold
  // then renders, so on a fresh mount the paper card sits blank for a beat. "The
  // stave is the hero", so a blank flash is a smell — a faint stave skeleton shows
  // behind the (transparent) WebView until the first `rendered` lands, so the wait
  // reads as a stave arriving, not as empty paper.
  const [painted, setPainted] = useState(false);

  const abc = useMemo(() => musicToAbc(music), [music]);
  // HTML is stable (abcjs is 500KB — don't rebuild per note); ABC arrives via a render command.
  const html = useMemo(
    () => buildSurfaceHtml({ abcjsSource: ABCJS_SOURCE, soundFontUrl, paperColor: colors.paper, inkColor: colors.paperInk }),
    [soundFontUrl],
  );

  const send = useCallback((cmd: SurfaceCommand) => {
    webRef.current?.postMessage(encodeCommand(cmd));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      play: () => send({ type: 'play' }),
      stop: () => send({ type: 'stop' }),
      highlightBar: (bar: number | null, color?: string) => send({ type: 'highlightBar', bar, color }),
    }),
    [send],
  );

  // Render the current stimulus once the surface is ready and whenever it (or the
  // notation scale) changes. A scale change re-renders in place — the HTML is stable.
  useEffect(() => {
    if (ready) send({ type: 'render', abc, scale });
  }, [ready, abc, scale, send]);

  const handleMessage = useCallback(
    (e: WebViewMessageEvent) => {
      const ev = dispatchMessage(e.nativeEvent.data, onEvent);
      if (ev?.type === 'ready') setReady(true);
      if (ev?.type === 'rendered') setPainted(true);
    },
    [onEvent],
  );

  // Wrap in a fixed-height View: react-native-webview does not reliably honor its
  // own style `height` in every parent layout (it collapsed to 0 inside a plain
  // flex column), but a View with an explicit height always lays out, and the
  // WebView fills it via flex.
  return (
    <View style={{ height }}>
      {!painted && <StaveSkeleton />}
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

/** Five faint stave lines shown behind the (transparent) WebView until abcjs paints,
 *  so a cold mount reads as a stave loading rather than a blank paper card. */
function StaveSkeleton() {
  return (
    <View style={skeletonStyles.fill} pointerEvents="none" testID="notation-skeleton">
      <View style={skeletonStyles.stave}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={skeletonStyles.line} />
        ))}
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 24 },
  stave: { justifyContent: 'space-between', height: 44 },
  line: { height: 1, backgroundColor: colors.paperLine, opacity: 0.18 },
});
