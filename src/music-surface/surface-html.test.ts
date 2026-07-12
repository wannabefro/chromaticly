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
});
