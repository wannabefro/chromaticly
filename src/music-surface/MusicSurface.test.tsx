import { createRef } from 'react';
import { act, render } from '@testing-library/react-native';

import type { Music } from '../music/types';
import type { SurfaceCommand, SurfaceEvent } from './bridge';

let capturedProps: Record<string, unknown> | null = null;
// Commands the component posts INTO the WebView. The real WebView drops a
// postMessage that lands before its page has booted, so the mock only records
// what MusicSurface actually sends via webRef — letting a test prove the
// readiness gating rather than assume the command reached the page.
const mockPosted: string[] = [];
jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      capturedProps = props;
      React.useImperativeHandle(ref, () => ({ postMessage: (s: string) => mockPosted.push(s) }));
      return null;
    }),
  };
});

// Imported after the mock so the component picks it up.
import { MusicSurface, dispatchMessage, type MusicSurfaceHandle } from './MusicSurface';

function postedCommands(): SurfaceCommand[] {
  return mockPosted.map((s) => JSON.parse(s) as SurfaceCommand);
}

const MUSIC: Music = {
  clef: 'treble',
  key_sig: 'C_major',
  time_sig: null,
  voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'semibreve' }] }],
};

describe('dispatchMessage', () => {
  test('decodes and forwards a valid event', () => {
    const seen: SurfaceEvent[] = [];
    const ev = dispatchMessage(JSON.stringify({ type: 'rendered', ms: 9 }), (e) => seen.push(e));
    expect(ev).toEqual({ type: 'rendered', ms: 9 });
    expect(seen).toEqual([{ type: 'rendered', ms: 9 }]);
  });

  test('returns null and does not forward on malformed data', () => {
    const seen: SurfaceEvent[] = [];
    expect(dispatchMessage('not json', (e) => seen.push(e))).toBeNull();
    expect(seen).toEqual([]);
  });
});

describe('MusicSurface', () => {
  beforeEach(() => {
    mockPosted.length = 0;
  });

  test('renders a WebView whose HTML inlines abcjs and wires the bridge', () => {
    render(<MusicSurface music={MUSIC} />);
    expect(capturedProps).not.toBeNull();
    const source = capturedProps!.source as { html: string };
    expect(source.html).toContain('id="paper"');
    expect(source.html).toContain('CreateSynth'); // real abcjs source is inlined
    expect(typeof capturedProps!.onMessage).toBe('function');
    expect(capturedProps!.mediaPlaybackRequiresUserAction).toBe(false);
    expect(capturedProps!.allowsInlineMediaPlayback).toBe(true);
  });

  // 302.18: a cold WebView loads ~500KB of abcjs before it paints, so the paper card
  // must not read as blank in the meantime — a stave skeleton stands in until the first
  // `rendered` lands, then gets out of the way.
  test('shows a stave skeleton until the first render lands, then hides it', () => {
    const { queryByTestId } = render(<MusicSurface music={MUSIC} />);
    expect(queryByTestId('notation-skeleton')).not.toBeNull();

    const onMessage = capturedProps!.onMessage as (e: { nativeEvent: { data: string } }) => void;
    act(() => onMessage({ nativeEvent: { data: JSON.stringify({ type: 'rendered', ms: 12 }) } }));

    expect(queryByTestId('notation-skeleton')).toBeNull();
  });

  // Content-driven height (design 9a "never crop"): a wrapped multi-system passage
  // reports a natural height taller than the floor, and the card grows to it — but
  // a short stimulus keeps the caller's height floor rather than shrinking below it.
  function heightOf(getByTestId: (id: string) => { props: Record<string, unknown> }): number {
    return (getByTestId('notation-surface').props.style as { height: number }).height;
  }

  test('the card grows to a reported content height taller than the floor', () => {
    const { getByTestId } = render(<MusicSurface music={MUSIC} height={160} />);
    expect(heightOf(getByTestId)).toBe(160); // floor before any render

    const onMessage = capturedProps!.onMessage as (e: { nativeEvent: { data: string } }) => void;
    act(() => onMessage({ nativeEvent: { data: JSON.stringify({ type: 'rendered', ms: 8, height: 300 }) } }));

    expect(heightOf(getByTestId)).toBe(320); // 300 content + 20 pad, above the 160 floor
  });

  test('a reported content height below the floor keeps the caller floor (short stimulus stays compact)', () => {
    const { getByTestId } = render(<MusicSurface music={MUSIC} height={160} />);
    const onMessage = capturedProps!.onMessage as (e: { nativeEvent: { data: string } }) => void;
    act(() => onMessage({ nativeEvent: { data: JSON.stringify({ type: 'rendered', ms: 8, height: 90 }) } }));

    expect(heightOf(getByTestId)).toBe(160); // max(160 floor, 90 + 20) → floor wins
  });

  // The surface is persistent (reused across exercises). A tall wrapped passage must
  // not leave the next, shorter stimulus's card stuck tall — the measured height is
  // dropped to the floor when the music changes, until the new render reports.
  test('changing the stimulus resets the height to the floor until the new render reports', () => {
    const tall: Music = {
      ...MUSIC,
      voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'crotchet' }, { type: 'barline', style: 'single' }] }],
    };
    const { getByTestId, rerender } = render(<MusicSurface music={MUSIC} height={160} />);
    const onMessage = capturedProps!.onMessage as (e: { nativeEvent: { data: string } }) => void;
    act(() => onMessage({ nativeEvent: { data: JSON.stringify({ type: 'rendered', ms: 8, height: 400 }) } }));
    expect(heightOf(getByTestId)).toBe(420);

    rerender(<MusicSurface music={tall} height={160} />);
    expect(heightOf(getByTestId)).toBe(160); // stale tall height dropped on stimulus change
  });

  // G5-1 SATB regression: the note ring never appeared on device because
  // ExerciseLoop issues highlightNote from a mount effect — BEFORE the WebView has
  // booted its message listener — and a real WebView silently drops a postMessage
  // that lands too early (unlike `render`, which is already gated on `ready`). The
  // WebView's own post-render replay can't rescue it, because that replay only fires
  // for a command that actually executed once. So a highlightNote requested before
  // `ready` must be held and (re-)sent when the surface reports ready.
  test('a highlightNote requested before ready is deferred, then flushed once the surface is ready', () => {
    const ref = createRef<MusicSurfaceHandle>();
    render(<MusicSurface ref={ref} music={MUSIC} />);

    // Requested before the surface has reported 'ready' — must NOT be posted yet
    // (a real WebView would drop it).
    const locator = { staff: 0, voice: 1, noteIndex: 0 };
    act(() => ref.current!.highlightNote(locator));
    expect(postedCommands().filter((c) => c.type === 'highlightNote')).toHaveLength(0);

    // Surface boots → the held highlight is flushed with the requested locator.
    const onMessage = capturedProps!.onMessage as (e: { nativeEvent: { data: string } }) => void;
    act(() => onMessage({ nativeEvent: { data: JSON.stringify({ type: 'ready' }) } }));

    const highlights = postedCommands().filter((c) => c.type === 'highlightNote');
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toEqual({ type: 'highlightNote', locator, color: undefined });
  });

  test('a highlightNote requested after ready is sent immediately', () => {
    const ref = createRef<MusicSurfaceHandle>();
    render(<MusicSurface ref={ref} music={MUSIC} />);
    const onMessage = capturedProps!.onMessage as (e: { nativeEvent: { data: string } }) => void;
    act(() => onMessage({ nativeEvent: { data: JSON.stringify({ type: 'ready' }) } }));
    mockPosted.length = 0; // ignore the render the ready-transition triggers

    const locator = { staff: 1, voice: 2, noteIndex: 0 };
    act(() => ref.current!.highlightNote(locator));

    expect(postedCommands().filter((c) => c.type === 'highlightNote')).toEqual([
      { type: 'highlightNote', locator, color: undefined },
    ]);
  });
});
