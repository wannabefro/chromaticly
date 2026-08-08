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

/** Note-granularity ring target: which staff/voice/note-in-voice to ring. */
export type NoteLocator = { staff: number; voice: number; noteIndex: number };

type Barlines = { gaps: number[]; color?: string; marks?: { wrong: number[]; missed: number[] } };

export interface MusicSurfaceHandle {
  play(): void;
  stop(): void;
  /** Tint the selected bar in the score (design 4c), or clear with `null`. */
  highlightBar(bar: number | null, color?: string): void;
  /** Ring the note-granularity target (G5-1 SATB "name the voice"), or clear
   *  with a `null` locator. */
  highlightNote(locator: NoteLocator | null, color?: string): void;
  /** D9 "hear yours": play raw abc in the page's hidden container — never
   *  touches or repaints the visible score. */
  playAbc(abc: string): void;
  /** Convenience over `playAbc` — emits `music` through the existing abc
   *  emitter first (D9). */
  playMusic(music: Music): void;
  /** tap_placement (chromaticly-51o): turn the between-note tap zones on, and
   *  draw the bar-lines the learner has placed. */
  setGapMode(enabled: boolean): void;
  setBarlines(gaps: number[], color?: string, marks?: { wrong: number[]; missed: number[] }): void;
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
  // A render failure inside the WebView is otherwise invisible to RN — the surface
  // catches it, emits an `error` event, and nothing listens, so a blank notation card
  // ships silently (chromaticly-9c8). Surface it in dev.
  if (__DEV__ && ev.type === 'error') console.warn('[surface]', ev.message);
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
  // Content-driven height (design 9a "never crop"): abcjs reports the rendered
  // natural height and the card grows to fit a wrapped multi-system passage. The
  // `height` prop is the minimum floor, so a single note stays compact and centred.
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  const abc = useMemo(() => musicToAbc(music), [music]);
  // Density-aware layout width (design A9 "stave is the hero"): the baked staffwidth
  // suits the 1–4 note single-bar stimuli that dominate, but a denser or multi-bar
  // melody squeezed into it renders cramped — notes bunched, oversized noteheads —
  // because responsive:'resize' scales the crowding UP. Count layout-consuming
  // events (notes, rests, AND barlines: a 2-bar melody needs room per bar, not just
  // per note) and widen so abcjs spaces them out and the fit-to-card scales DOWN
  // instead. Sparse single-bar stimuli send nothing → baked default.
  // Universal layout: the page owns sizing (fixed scale + wrap + natural width),
  // so RN no longer computes a density-dependent staffwidth. (Iteration 2 will
  // feed the measured card width as the wrap threshold.)
  const staffwidth = undefined;
  // HTML is stable (abcjs is 500KB — don't rebuild per note); ABC arrives via a render command.
  const html = useMemo(
    () =>
      buildSurfaceHtml({
        abcjsSource: ABCJS_SOURCE,
        soundFontUrl,
        paperColor: colors.paper,
        inkColor: colors.paperInk,
        ringColor: colors.hint,
      }),
    [soundFontUrl],
  );

  const send = useCallback((cmd: SurfaceCommand) => {
    webRef.current?.postMessage(encodeCommand(cmd));
  }, []);

  // A highlightNote requested before the WebView has booted its message listener
  // would be dropped (unlike `render`, which is gated on `ready` below): its
  // postMessage lands before the page can receive it, and the WebView's own
  // post-render replay can't rescue it because that replay only fires for a
  // command that actually executed. So hold the latest requested note highlight
  // and (re-)send it once ready. `readyRef` mirrors `ready` so the imperative
  // method can send immediately when the surface is already up. `null` locator is
  // a real request (clear the ring); `undefined` means nothing has been asked.
  const readyRef = useRef(false);
  const pendingHighlight = useRef<{ locator: NoteLocator | null; color?: string } | undefined>(undefined);
  const sendHighlight = useCallback(
    (h: { locator: NoteLocator | null; color?: string }) => {
      send({ type: 'highlightNote', locator: h.locator, color: h.color });
    },
    [send],
  );

  // The gap zones race the boot the same way (chromaticly-1em).
  const gapMode = useRef<boolean | undefined>(undefined);
  const barlines = useRef<Barlines | undefined>(undefined);
  const sendGaps = useCallback(() => {
    if (gapMode.current !== undefined) send({ type: 'setGapMode', enabled: gapMode.current });
    if (barlines.current) send({ type: 'setBarlines', ...barlines.current });
  }, [send]);

  useImperativeHandle(
    ref,
    () => ({
      play: () => send({ type: 'play' }),
      stop: () => send({ type: 'stop' }),
      highlightBar: (bar: number | null, color?: string) => send({ type: 'highlightBar', bar, color }),
      highlightNote: (locator, color) => {
        pendingHighlight.current = { locator, color };
        if (readyRef.current) sendHighlight(pendingHighlight.current);
      },
      playAbc: (abc: string) => send({ type: 'playAbc', abc }),
      playMusic: (music: Music) => send({ type: 'playAbc', abc: musicToAbc(music) }),
      setGapMode: (enabled: boolean) => {
        gapMode.current = enabled;
        // The page drops its bar-lines when gap mode goes off.
        if (!enabled) barlines.current = undefined;
        if (readyRef.current) send({ type: 'setGapMode', enabled });
      },
      setBarlines: (gaps, color, marks) => {
        barlines.current = { gaps, color, marks };
        if (readyRef.current) send({ type: 'setBarlines', gaps, color, marks });
      },
    }),
    [send, sendHighlight],
  );

  // Flush anything requested before boot, once the surface is ready.
  useEffect(() => {
    if (!ready) return;
    if (pendingHighlight.current !== undefined) sendHighlight(pendingHighlight.current);
    sendGaps();
  }, [ready, sendHighlight, sendGaps]);

  // The surface is persistent (reused across exercises via new render commands),
  // so drop the previous stimulus's measured height when the music changes: fall
  // back to the floor until the new render reports its height, otherwise a tall
  // wrapped passage would leave the next (short) stimulus's card stuck tall.
  useEffect(() => {
    setContentHeight(null);
  }, [abc]);

  // Render the current stimulus once the surface is ready and whenever it (or the
  // notation scale) changes. A scale change re-renders in place — the HTML is stable.
  useEffect(() => {
    if (ready) send({ type: 'render', abc, scale, staffwidth });
  }, [ready, abc, scale, staffwidth, send]);

  const handleMessage = useCallback(
    (e: WebViewMessageEvent) => {
      const ev = dispatchMessage(e.nativeEvent.data, onEvent);
      if (ev?.type === 'ready') {
        readyRef.current = true;
        setReady(true);
      }
      if (ev?.type === 'rendered') {
        setPainted(true);
        if (typeof ev.height === 'number' && ev.height > 0) setContentHeight(ev.height);
      }
    },
    [onEvent],
  );

  // Wrap in a fixed-height View: react-native-webview does not reliably honor its
  // own style `height` in every parent layout (it collapsed to 0 inside a plain
  // flex column), but a View with an explicit height always lays out, and the
  // WebView fills it via flex.
  // Grow to the content but never below the caller's height floor (a small extra
  // pad keeps the stave off the card edges).
  const viewHeight = contentHeight != null ? Math.max(height, contentHeight + 20) : height;
  return (
    <View style={{ height: viewHeight }} testID="notation-surface">
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
