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
    // Centring is via margin:auto on the inner wrapper (keeps the left edge
    // reachable when a wide system overflows and scrolls; design 9a).
    expect(html).toContain('#inner { margin: auto; }');
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

  // Design 5c notation size: a `render` command may carry an explicit abcjs staff scale;
  // the page applies it over the baked default so the score re-scales in place.
  test('applies a per-render notation scale over the baked default', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(html).toContain('function renderAbc(abc, scale, staffwidth)');
    expect(html).toContain("typeof scale === 'number'");
    expect(html).toContain('opts.scale = scale');
    expect(html).toContain('renderAbc(cmd.abc, cmd.scale, cmd.staffwidth)');
  });

  // A render command may carry a staffwidth (the wrap threshold) over the baked default.
  test('applies a per-render staffwidth over the baked default', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(html).toContain("typeof staffwidth === 'number'");
    expect(html).toContain('opts.staffwidth = staffwidth');
  });

  // Universal layout invariants: constant note size (fixed scale, no responsive
  // resize / stretchlast that would couple size to density) + wrap for long content,
  // and the rendered natural height reported back so the card sizes to content.
  test('renders at a fixed scale with wrap, not responsive-resize/stretchlast', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(html).toContain('"scale":2.2');
    expect(html).toContain('"wrap"');
    // JSON-key forms so the RENDER_OPTS object is what's asserted, not prose mentions.
    expect(html).not.toContain('"responsive"');
    expect(html).not.toContain('"stretchlast"');
  });

  test('reports the rendered natural height so the card can size to content (design 9a)', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    // the visible render targets the centred inner wrapper, and emits its height
    expect(html).toContain("ABCJS.renderAbc('inner', abc");
    expect(html).toContain('getBoundingClientRect().height');
    expect(html).toContain("type: 'rendered', ms:");
    expect(html).toContain('height: renderedHeight');
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

  // D9 "hear yours": an answer card plays its own Music without a second WebView —
  // the page parses+plays a `playAbc` command into a HIDDEN container.
  describe('playAbc (D9): hear-yours without a second WebView', () => {
    test('wires a playAbc command into a hidden container, distinct from the visible score', () => {
      const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
      expect(html).toContain('id="hidden-paper"');
      expect(html).toContain("cmd.type === 'playAbc'");
      expect(html).toContain('function playAbc(abc)');
      expect(html).toContain("ABCJS.renderAbc('hidden-paper', abc");
    });

    // The invariant that matters: playAbc must never repaint the GIVEN melody. Isolate
    // playAbc's own function body (up to the next function) and assert it never touches
    // #paper or fires 'rendered' — both are exclusive to the visible renderAbc() path.
    test('the page handles playAbc without touching the visible score', () => {
      const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
      const start = html.indexOf('function playAbc(abc)');
      const end = html.indexOf('function highlightBar', start);
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      const body = html.slice(start, end);

      expect(body).not.toContain("renderAbc('inner'"); // never the visible score
      expect(body).not.toContain("type: 'rendered'");
      expect(body).toContain("renderAbc('hidden-paper'");
    });
  });
});
