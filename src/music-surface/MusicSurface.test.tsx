import { act, render } from '@testing-library/react-native';

import type { Music } from '../music/types';
import type { SurfaceEvent } from './bridge';

let capturedProps: Record<string, unknown> | null = null;
jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: React.forwardRef((props: Record<string, unknown>, _ref: unknown) => {
      capturedProps = props;
      return null;
    }),
  };
});

// Imported after the mock so the component picks it up.
import { MusicSurface, dispatchMessage } from './MusicSurface';

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
});
