import { buildSurfaceHtml } from './surface-html';

const FAKE_ABCJS = 'window.ABCJS = { marker: true };';

describe('buildSurfaceHtml', () => {
  test('inlines the abcjs source and the paper card', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(html).toContain(FAKE_ABCJS);
    expect(html).toContain('id="paper"');
    expect(html).toContain('#f6f4ee'); // default light paper background even in dark mode (rule 1)
  });

  test('themes the paper + ink from the caller (no nested white box)', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS, paperColor: '#abcabc', inkColor: '#123123' });
    expect(html).toContain('background: #abcabc');
    expect(html).toContain('color: #123123');
    // The surface fills its host and centres the stave rather than drawing a nested card.
    expect(html).toContain('height: 100%');
    expect(html).toContain('justify-content: center');
  });

  test('embeds the initial ABC as a safe JS string literal', () => {
    const abc = 'X:1\nK:C\nC';
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS, abc });
    // JSON-encoded so newlines/quotes cannot break out of the script.
    expect(html).toContain(JSON.stringify(abc));
  });

  test('autorun flag and soundfont are wired through', () => {
    const withAutorun = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS, autorun: true });
    expect(withAutorun).toContain('var AUTORUN = true;');

    const noAutorun = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(noAutorun).toContain('var AUTORUN = false;');

    const withFont = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS, soundFontUrl: 'file:///sf/' });
    expect(withFont).toContain('"file:///sf/"');
  });

  test('posts events back through the ReactNativeWebView bridge', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(html).toContain('window.ReactNativeWebView.postMessage');
    expect(html).toContain('ABCJS.synth.supportsAudio');
  });

  // Design 4c: tap a bar IN the score. abcjs' add_classes is on (RENDER_OPTS), so the
  // page hit-tests taps against the notes' measure classes and can tint a bar.
  test('wires bar hit-testing and highlight into the page', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(html).toContain('add_classes'); // required for the abcjs-mm measure classes
    expect(html).toContain('abcjs-mm'); // the measure class the hit-test reads
    expect(html).toContain("type: 'barTapped'"); // tap emits the bar
    expect(html).toContain("cmd.type === 'highlightBar'"); // and RN can tint one
    expect(html).toContain('bar-highlight');
  });

  // Regression: the page script lives in a JS template literal, so a single-backslash
  // \d collapses to a literal "d" in the emitted HTML and the measure regex silently
  // never matches (the bug that made bar-tap do nothing on device). The emitted HTML
  // must carry a real \d.
  test('the measure regex reaches the page as \\d, not a literal d', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(html).toContain('abcjs-mm(\\d+)');
    expect(html).not.toContain('abcjs-mm(d+)');
  });

  // Design 4c: long-press a bar to hear just it. A press-duration flag splits a hold from
  // a tap, and playBar seeks the synth to that one bar.
  test('wires long-press-to-hear a single bar', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(html).toContain("type: 'barHeld'"); // a long press hears the bar
    expect(html).toContain('function playBar'); // and plays only it
    expect(html).toContain('.seek('); // by seeking the synth to the bar
    expect(html).toContain('pressStart'); // tap vs hold is a press-duration decision
    expect(html).toContain('-webkit-touch-callout: none'); // no iOS callout to swallow the press
  });
});
