import { highlightLocator, musicToAbc } from '../music/abc-emitter';
import type { Music, VoiceName } from '../music/types';
import { colors } from '../ui/theme';
import { buildSurfaceHtml } from './surface-html';
import abcjsSourceJson from './abcjs-source.json';

const FAKE_ABCJS = 'window.ABCJS = { marker: true };';
const ABCJS_SOURCE = (abcjsSourceJson as { source: string }).source;

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
  // The page is a JS template literal, so a single-backslash \d collapses to a
  // literal "d" and the regex silently never matches (chromaticly-a47). Guard the
  // class, not each regex: the note sort shipped broken while the measure one passed.
  test('every character class reaches the page escaped, never collapsed', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(html).toContain('abcjs-mm(\\d+)');
    expect(html).toContain('abcjs-n(\\d+)');
    for (const collapsed of ['(d+)', '(w+)', '(s+)', '(d*)']) expect(html).not.toContain(collapsed);
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

  // chromaticly-9c8. The invariant: a render the learner CANNOT SEE must not look like a
  // successful one. abcjs lays out to `staffwidth` whatever the viewport is, so a host
  // View that gives the WebView no width still produces a clean render and a sane
  // height — RN then hides the stave skeleton and the card reads blank with nothing
  // logged. That is exactly how the ornament card shipped broken. The page must notice
  // it painted into a zero-width body and say so.
  test('a render into a zero-width host reports an error instead of a silent blank card', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    // reported only when the drawing has real geometry but the body has no width —
    // never in a layout-free environment, where both are 0
    expect(html).toContain('lastPaintedWidth === 0 && drawnWidth > 0');
    expect(html).toContain('zero-width surface');
    // and the surface repaints if the host only grants a width later, since abcjs
    // never re-runs on its own and the card would otherwise stay blank for good
    expect(html).toContain("window.addEventListener('resize'");
    expect(html).toContain('lastRender && lastPaintedWidth === 0 && w > 0');
  });

  // chromaticly-9lb: one shared surface pre-renders static option staves offscreen so
  // each MCQ option doesn't boot its own abcjs WebView.
  test('wires offscreen renderToSvg that trims the SVG and strips the scale style attr', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(html).toContain('function renderToSvg(abc, scale, reqId)');
    expect(html).toContain("renderToSvg(cmd.abc, cmd.scale, cmd.reqId)");
    // renders offscreen (hidden container), never the visible #inner score
    expect(html).toContain("ABCJS.renderAbc('hidden-paper', abc, opts)");
    // returns trimmed markup via the svgRendered event
    expect(html).toContain("type: 'svgRendered'");
    expect(html).toContain('svg.outerHTML');
    // strips abcjs's root scale transform (react-native-svg rejects "scale(1.5, 1.5)")
    expect(html).toContain("svg.removeAttribute('style')");
    expect(html).toContain("svg.setAttribute('viewBox'");
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

// G5-1 SATB "name the voice" (U3): the note-granularity ring. The riskiest
// assumption in the whole plan — abcjs has no in-ABC note colour, so the ring
// is a post-render draw keyed off abcjs's add_classes markup. If the
// {staff,voice,noteIndex} locator resolves to the WRONG note, the exercise
// renders and grades fine while ringing the wrong singer — corrupting the
// exact learning signal the exercise teaches.
describe('highlightNote — dispatch wiring + ring-colour token', () => {
  test('wires the highlightNote command into the page and clears any previous ring', () => {
    const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(html).toContain('function highlightNote(locator, color)');
    expect(html).toContain("cmd.type === 'highlightNote'");
    expect(html).toContain('highlightNote(cmd.locator, cmd.color)');
    expect(html).toContain('note-highlight'); // the ring's own class, cleared before redrawing
  });

  // R6: the default ring fill must trace to a design token (colors.hint, the
  // amber "smart tips" token), never an ad hoc hex typed into the surface.
  test('the ring colour defaults to, and can be overridden by, a token — never a raw hex', () => {
    const withDefault = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });
    expect(withDefault).toContain(JSON.stringify(colors.hint));

    const withOverride = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS, ringColor: colors.hint });
    expect(withOverride).toContain(JSON.stringify(colors.hint));
  });
});

// Shared SATB fixture (mirrors abc-emitter.test.ts's U2 fixture): S/A on the
// treble staff, T/B on the bass staff, one voice flagged `highlight: true`.
const SATB_VOICE_ORDER: VoiceName[] = ['soprano', 'alto', 'tenor', 'bass'];
function satbFixture(highlightVoice: VoiceName): Music {
  const pitchFor: Record<VoiceName, string> = { soprano: 'G4', alto: 'E4', tenor: 'C4', bass: 'C3' };
  const staffFor: Record<VoiceName, number> = { soprano: 0, alto: 0, tenor: 1, bass: 1 };
  const stemFor: Record<VoiceName, 'up' | 'down'> = { soprano: 'up', alto: 'down', tenor: 'up', bass: 'down' };
  return {
    clef: 'treble',
    key_sig: 'C_major',
    time_sig: '4/4',
    staves: ['treble', 'bass'],
    voices: SATB_VOICE_ORDER.map((name) => ({
      name,
      staff: staffFor[name],
      stem: stemFor[name],
      events: [{ type: 'note', pitch: pitchFor[name], dur: 'semibreve', highlight: name === highlightVoice }],
    })),
  };
}

/** Mirrors the exact selector `highlightNote` builds in surface-html.ts:
 *  `.abcjs-note.abcjs-v{voice}.abcjs-n{noteIndex}`. abcjs's add_classes tags
 *  every note/chord element (a chord's stacked pitches are still ONE element)
 *  with its voice index and its position within that voice — voice indices
 *  are unique across the whole grand staff, so this pair alone addresses
 *  exactly one element. */
function matchesNoteSelector(classAttr: string, voice: number, noteIndex: number): boolean {
  const classes = classAttr.split(/\s+/);
  return classes.includes('abcjs-note') && classes.includes(`abcjs-v${voice}`) && classes.includes(`abcjs-n${noteIndex}`);
}

describe('highlightNote selector uniqueness — locator -> abcjs class scheme (the riskiest assumption, U3)', () => {
  // Primary proof: render the REAL SATB fixture (via the REAL musicToAbc emitter)
  // through the REAL bundled abcjs 6.6.4 (the exact abcjs-source.json production
  // ships), inside a jsdom document, and resolve each voice's locator against the
  // actual rendered DOM. jsdom's SVG support has gaps (no getBBox — the ring's
  // OWN bbox math is unproven here and stays an on-device U7 concern) but DOES
  // run abcjs's real layout and add_classes tagging, so element resolution is a
  // genuine render-based proof, not a parse-only one.
  test('each voice locator resolves to exactly one DOM element, and no two voices alias to the same note', () => {
    let JSDOMCtor: typeof import('jsdom').JSDOM;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      JSDOMCtor = require('jsdom').JSDOM;
    } catch {
      // jsdom isn't resolvable in this environment — fall back to the
      // representative-fixture guard below; on-device rendering (U7) is the backstop.
      return;
    }

    const html = buildSurfaceHtml({ abcjsSource: ABCJS_SOURCE });
    const dom = new JSDOMCtor(html, { runScripts: 'dangerously' });
    const { window } = dom;
    const abc = musicToAbc(satbFixture('soprano')); // highlight flag never changes emitted ABC
    window.dispatchEvent(new window.MessageEvent('message', { data: JSON.stringify({ type: 'render', abc }) }));

    const svg = window.document.querySelector('#paper svg');
    expect(svg).not.toBeNull();

    const resolved = SATB_VOICE_ORDER.map((name) => {
      const locator = highlightLocator(satbFixture(name));
      expect(locator).not.toBeNull();
      const matches = svg!.querySelectorAll(`.abcjs-note.abcjs-v${locator!.voice}.abcjs-n${locator!.noteIndex}`);
      // Exactly one element per voice — the selector must never resolve to zero
      // (nothing to ring) or more than one (ambiguous ring target).
      expect(matches).toHaveLength(1);
      return matches[0];
    });

    // No two voices' locators alias to the same DOM node — the exact corruption
    // the plan's Risks section warns about (ringing the wrong singer).
    expect(new Set(resolved).size).toBe(resolved.length);
  });

  // Backstop (always runs, independent of jsdom availability): the selector
  // LOGIC against a representative abcjs class-tagged fixture — classes captured
  // verbatim from a real abcjs 6.6.4 render (add_classes:true) of this exact
  // SATB fixture's bar, in abcjs's own v-index order (S=0,A=1,T=2,B=3).
  test('fallback: selector logic uniquely addresses the intended voice in a representative abcjs class fixture', () => {
    const renderedNoteClasses = [
      'abcjs-note abcjs-d1 abcjs-p11 abcjs-l0 abcjs-m0 abcjs-mm0 abcjs-v0 abcjs-n0', // soprano G4
      'abcjs-note abcjs-d1 abcjs-p9 abcjs-l0 abcjs-m0 abcjs-mm0 abcjs-v1 abcjs-n0', // alto E4
      'abcjs-note abcjs-d1 abcjs-p0 abcjs-l0 abcjs-m0 abcjs-mm0 abcjs-v2 abcjs-n0', // tenor C4
      'abcjs-note abcjs-d1 abcjs-p-7 abcjs-l0 abcjs-m0 abcjs-mm0 abcjs-v3 abcjs-n0', // bass C3
    ];

    SATB_VOICE_ORDER.forEach((name, voiceIndex) => {
      const locator = highlightLocator(satbFixture(name))!;
      expect(locator.voice).toBe(voiceIndex);
      const matches = renderedNoteClasses.filter((c) => matchesNoteSelector(c, locator.voice, locator.noteIndex));
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe(renderedNoteClasses[voiceIndex]); // the intended voice, not a neighbour's
    });
  });
});

describe('highlightNote — null/out-of-range locator clears or ignores without throwing', () => {
  function mountRealSurface(): { window: Window & typeof globalThis; posted: string[] } {
    const html = buildSurfaceHtml({ abcjsSource: ABCJS_SOURCE });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const { window } = dom;
    const posted: string[] = [];
    window.ReactNativeWebView = { postMessage: (s: string) => posted.push(s) };
    return { window, posted };
  }

  function jsdomAvailable(): boolean {
    try {
      require('jsdom');
      return true;
    } catch {
      return false;
    }
  }

  test('a null locator clears any ring without throwing', () => {
    if (!jsdomAvailable()) return; // on-device (U7) is the backstop
    const { window, posted } = mountRealSurface();
    const abc = musicToAbc(satbFixture('soprano'));
    expect(() => {
      window.dispatchEvent(new window.MessageEvent('message', { data: JSON.stringify({ type: 'render', abc }) }));
      window.dispatchEvent(new window.MessageEvent('message', { data: JSON.stringify({ type: 'highlightNote', locator: null }) }));
    }).not.toThrow();
    expect(posted.some((p) => JSON.parse(p).type === 'error')).toBe(false);
  });

  test('an out-of-range locator (voice/noteIndex with no matching element) is ignored without throwing', () => {
    if (!jsdomAvailable()) return; // on-device (U7) is the backstop
    const { window, posted } = mountRealSurface();
    const abc = musicToAbc(satbFixture('soprano'));
    expect(() => {
      window.dispatchEvent(new window.MessageEvent('message', { data: JSON.stringify({ type: 'render', abc }) }));
      window.dispatchEvent(
        new window.MessageEvent('message', {
          data: JSON.stringify({ type: 'highlightNote', locator: { staff: 9, voice: 9, noteIndex: 9 } }),
        }),
      );
    }).not.toThrow();
    expect(posted.some((p) => JSON.parse(p).type === 'error')).toBe(false);
  });
});

// chromaticly-51o stage 2. abcjs hit-tests a tap to a NOTE, so the gap zones are
// our own rects. The invariants that make them work live in the emitted script.
describe('surface HTML — gap zones (chromaticly-51o)', () => {
  const html = buildSurfaceHtml({ abcjsSource: FAKE_ABCJS });

  test('a gap tap emits its 1-indexed position, not a bar', () => {
    expect(html).toContain("type: 'gapTapped'");
  });

  test('gap mode is off unless a command turns it on', () => {
    expect(html).toContain('var gapMode = false;');
    expect(html).toContain("cmd.type === 'setGapMode'");
  });

  test('the zones tile — each reaches half-way to its neighbour', () => {
    expect(html).toContain('(centres[i - 1] + centres[i]) / 2');
    expect(html).toContain('(centres[i] + centres[i + 1]) / 2');
  });

  // Ordering by DOM position would follow abcjs's paint order, not the score's.
  test('notes are ordered by their abcjs voice index, not by document order', () => {
    expect(html).toContain('abcjs-n(');
  });

  test('marking uses the semantic colours, never the strand hue', () => {
    expect(html).toContain("var MARK_WRONG = '#e0575e';");
    expect(html).toContain("var MARK_RIGHT = '#3a9e63';");
  });

  // Drawn from getBBox, so a command landing before the paint finds nothing.
  test('a render replays the zones and the placed lines', () => {
    expect(html).toContain('if (gapMode) { drawGapZones();');
  });
});
