// One app-wide offscreen abcjs surface that pre-renders static option staves
// (chromaticly-9lb). Notation MCQ options don't need audio, bar-tap, or highlight, so
// instead of every option booting its own ~500KB abcjs WebView — up to 4-5 cold loads
// contending at once, leaving option cards blank for a multi-second beat — they all
// route their ABC through this single warm surface and paint the returned SVG with
// react-native-svg. Mounted once at the app root so abcjs is loaded exactly once.

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors } from '../ui/theme';
import abcjsSource from './abcjs-source.json';
import { decodeEvent, encodeCommand } from './bridge';
import { buildSurfaceHtml } from './surface-html';

const ABCJS_SOURCE = (abcjsSource as { source: string }).source;

export interface SvgRender {
  /** Standalone SVG markup, trimmed to its content box; empty on a render failure. */
  svg: string;
  width: number;
  height: number;
}

export type RenderToSvg = (abc: string, scale?: number) => Promise<SvgRender>;

const SvgRenderContext = createContext<RenderToSvg | null>(null);

/** The shared renderer, or null when no provider is mounted (e.g. a test host) — callers
 *  fall back to a live surface so notation still shows. */
export function useSvgRenderer(): RenderToSvg | null {
  return useContext(SvgRenderContext);
}

export function SvgRenderProvider({ children }: { children: ReactNode }) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const counterRef = useRef(0);
  const pendingRef = useRef(new Map<number, (r: SvgRender) => void>());
  // Commands issued before abcjs finishes its cold load are buffered here and flushed
  // on `ready`, so an option requested during that window still renders.
  const queueRef = useRef<string[]>([]);
  // Option ABC is deterministic per exercise instance, so a resolved stave is reusable —
  // caching makes a re-render (re-select, regrade) instant.
  const cacheRef = useRef(new Map<string, SvgRender>());

  const html = useMemo(
    () => buildSurfaceHtml({ abcjsSource: ABCJS_SOURCE, paperColor: colors.paper, inkColor: colors.paperInk }),
    [],
  );

  const renderToSvg = useCallback<RenderToSvg>((abc, scale) => {
    const key = `${scale ?? ''}::${abc}`;
    const cached = cacheRef.current.get(key);
    if (cached) return Promise.resolve(cached);
    return new Promise<SvgRender>((resolve) => {
      const reqId = ++counterRef.current;
      pendingRef.current.set(reqId, (r) => {
        if (r.svg) cacheRef.current.set(key, r);
        resolve(r);
      });
      const msg = encodeCommand({ type: 'renderToSvg', abc, scale, reqId });
      if (readyRef.current) webRef.current?.postMessage(msg);
      else queueRef.current.push(msg);
    });
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let ev;
    try {
      ev = decodeEvent(e.nativeEvent.data);
    } catch {
      return;
    }
    if (ev.type === 'ready') {
      readyRef.current = true;
      const queued = queueRef.current;
      queueRef.current = [];
      queued.forEach((m) => webRef.current?.postMessage(m));
    } else if (ev.type === 'svgRendered') {
      const cb = pendingRef.current.get(ev.reqId);
      if (cb) {
        pendingRef.current.delete(ev.reqId);
        cb({ svg: ev.svg, width: ev.width, height: ev.height });
      }
    }
  }, []);

  return (
    <SvgRenderContext.Provider value={renderToSvg}>
      <View style={styles.offscreen} pointerEvents="none">
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          style={styles.web}
        />
      </View>
      {children}
    </SvgRenderContext.Provider>
  );
}

// A 1x1 offscreen host: the WebView never shows #inner (option ABC renders into the
// hidden container), it only executes abcjs and hands back SVG markup, so it needs no
// visible size. getBBox is geometry-based and works regardless of viewport size.
const styles = StyleSheet.create({
  offscreen: { position: 'absolute', width: 1, height: 1, left: -9999, top: -9999, opacity: 0 },
  web: { width: 1, height: 1, backgroundColor: 'transparent' },
});
