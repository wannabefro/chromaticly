// Builds the self-contained HTML for the WebView music surface (U3).
// abcjs is inlined (offline); the page renders ABC and plays it via abcjs's
// synth, posting timing-instrumented events back over the bridge.

export interface SurfaceHtmlOptions {
  /** The abcjs-basic UMD source, inlined so the page needs no network for the lib. */
  abcjsSource: string;
  /** Initial ABC to render on load (RN can also send a `render` command later). */
  abc?: string;
  /** Local (bundled) soundfont URL for offline audio; omit to use abcjs's default. */
  soundFontUrl?: string;
  /** Render + play immediately on load — used by the headless-browser timing test. */
  autorun?: boolean;
  /** Render an in-page Play button wired to play() — a fallback control and a
   *  trusted-gesture entry point for browser verification. RN drives play via the bridge. */
  playButton?: boolean;
  /** Paper fill — the surface IS the light card (never inverts, design rule 1), so it
   *  paints its own paper rather than a nested box. Themed by the caller (colors.paper). */
  paperColor?: string;
  /** Notation ink on the paper (colors.paperInk). */
  inkColor?: string;
}

// Universal notation layout (design A9 "stave is the hero", 9a "scroll inside the
// card, never crop"): ONE rule set for every stimulus, no per-density magic.
// - Fixed `scale` → note size and line spacing are CONSTANT (a lone note and a
//   note in an 8-note scale render identically sized).
// - `wrap` breaks a run of bars too wide for one line into stacked systems.
// - NO `responsive:'resize'` and NO `stretchlast`: content keeps its NATURAL
//   width, so the page can centre short content and horizontally-scroll a single
//   system too wide to wrap — instead of stretching one note across the card or
//   shrinking a dense bar. `staffwidth` is the wrap threshold (the card width),
//   fed from RN so wrap decisions match the real card.
const RENDER_OPTS = { add_classes: true, scale: 2.2, wrap: { minSpacing: 1.8, maxSpacing: 3.0, preferredMeasuresPerLine: 2 }, staffwidth: 330, paddingtop: 6, paddingbottom: 6, paddingleft: 0, paddingright: 0 };

/** Pure: assembles the full HTML document string. */
export function buildSurfaceHtml(opts: SurfaceHtmlOptions): string {
  const initialAbc = JSON.stringify(opts.abc ?? null);
  const soundFont = JSON.stringify(opts.soundFontUrl ?? null);
  const autorun = opts.autorun ? 'true' : 'false';
  const paper = opts.paperColor ?? '#f6f4ee';
  const ink = opts.inkColor ?? '#12100c';
  const renderOpts = JSON.stringify(RENDER_OPTS);
  const playButton = opts.playButton
    ? '<button id="surface-play" style="margin:8px">Play</button>'
    : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: transparent; }
  /* Notation always on a light "paper" card, even in dark mode (design brief). The
     surface fills its host edge-to-edge and centres the stave — no nested box. */
  #paper {
    background: ${paper};
    color: ${ink};
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    /* Centre content that fits; horizontally scroll a single system too wide to
       wrap (design 9a "scroll inside the card, never crop"). margin:auto on the
       flex child centres when it fits and collapses to 0 when it overflows, which
       — unlike justify-content:center — keeps the left edge reachable while
       scrolling in WebKit. */
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    /* A long-press to hear a bar (design 4c) must not raise the iOS text callout /
       selection menu, which would swallow the gesture. */
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }
  #inner { margin: auto; }
  /* Natural width at the fixed scale — NOT width:100% (that stretched one note
     across the card and coupled note size to density). */
  #paper svg { display: block; height: auto; }
</style>
</head>
<body>
${playButton}
<div id="paper"><div id="inner"></div></div>
<!-- D9 "hear yours": a hidden container abcjs can render an answer-so-far
     melody into for audio only — never painted, so it can never repaint
     the visible score above. -->
<div id="hidden-paper" style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;"></div>
<script>${opts.abcjsSource}</script>
<script>
(function () {
  var SOUNDFONT = ${soundFont};
  var INITIAL_ABC = ${initialAbc};
  var AUTORUN = ${autorun};
  var visualObj = null;
  var synth = null;
  var pressStart = 0; // touchstart time — lets onNoteClick tell a long-press from a tap

  function emit(ev) {
    var s = JSON.stringify(ev);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(s); }
    // Console mirror so a headless browser / native webview logs can read it too.
    console.log('[surface] ' + s);
  }

  function renderAbc(abc, scale, staffwidth) {
    try {
      var t = performance.now();
      // clickListener is how the bar-tap (design 4c) is detected: abcjs already hit-tests
      // the tap to a note and calls back with that note's measure class. dragging stays
      // off — a tap must select a bar, never nudge a note.
      var opts = Object.assign({}, ${renderOpts}, { clickListener: onNoteClick, dragging: false });
      // Notation size (design 5c): RN sends an explicit staff scale, else keep the baked default.
      if (typeof scale === 'number') opts.scale = scale;
      // Density-aware layout width: RN sends a wider staffwidth for note-dense stimuli
      // (e.g. an 8-note scale) so abcjs lays them out with room and responsive:'resize'
      // scales that DOWN to the card, instead of squeezing them into the narrow baked
      // width and scaling the crowding UP. Absent for sparse stimuli (baked default).
      if (typeof staffwidth === 'number') opts.staffwidth = staffwidth;
      visualObj = ABCJS.renderAbc('inner', abc, opts)[0];
      // Report the rendered natural height so RN can size the card to the content
      // (design 9a: a wrapped multi-system passage must NOT be cropped; a single
      // note keeps the card compact). CSS px, measured after layout.
      var svgNode = document.querySelector('#inner svg');
      var renderedHeight = svgNode ? Math.ceil(svgNode.getBoundingClientRect().height) : 0;
      emit({ type: 'rendered', ms: Math.round(performance.now() - t), height: renderedHeight });
    } catch (e) {
      emit({ type: 'error', message: 'render: ' + (e && e.message || e) });
    }
  }

  function play() {
    if (!ABCJS.synth.supportsAudio()) { emit({ type: 'audioUnsupported' }); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    var ac = new AC();
    ac.resume().then(function () {
      synth = new ABCJS.synth.CreateSynth();
      var tInit = performance.now();
      return synth.init({
        audioContext: ac,
        visualObj: visualObj,
        options: SOUNDFONT ? { soundFontUrl: SOUNDFONT } : {},
      }).then(function () {
        var tPrime = performance.now();
        emit({ type: 'log', message: 'synth.init ' + Math.round(tPrime - tInit) + 'ms' });
        return synth.prime().then(function () {
          var tStart = performance.now();
          emit({ type: 'primed', ms: Math.round(tStart - tPrime) });
          // abcjs synth.start() begins playback and returns undefined (not a promise).
          synth.start();
          emit({ type: 'played', latencyMs: Math.round(performance.now() - tStart) });
        });
      });
    }).catch(function (e) {
      emit({ type: 'error', message: 'audio: ' + (e && e.message || e) });
    });
  }

  // --- Bar tapping (design 4c: tap the bar IN the score) ---------------------
  // abcjs (add_classes) tags every rendered note with an "abcjs-mmN" measure class, and
  // its clickListener hit-tests a tap to the note and hands us that note's classes. abcjs
  // numbers measures from 0 and the leading clef shares measure 0 with bar 1, so bar =
  // measure + 1. This is far more robust than hand-rolled x-geometry: abcjs owns the
  // layout, so it always knows which note (and bar) a tap landed on.
  function svgEl() { return document.querySelector('#paper svg'); }

  function measureFromClasses(str) {
    // NB: \\d — this whole script lives in a JS template literal, so a single-backslash
    // \\d would collapse to a literal "d" in the emitted HTML and the regex would never
    // match a measure. The double backslash puts a real \\d into the page.
    var m = /abcjs-mm(\\d+)/.exec(str || '');
    return m ? parseInt(m[1], 10) : null;
  }

  function onNoteClick(abcelem, tuneNumber, classes, analysis) {
    var str = [classes, analysis && analysis.parentClasses].join(' ');
    var raw = measureFromClasses(str);
    if (raw == null) return;
    var bar = raw + 1;
    // A long press hears the bar (design 4c); a quick tap selects it.
    if (pressStart && (Date.now() - pressStart) > 450) {
      emit({ type: 'barHeld', bar: bar });
      playBar(bar);
    } else {
      emit({ type: 'barTapped', bar: bar });
    }
  }

  /** Distinct measures in the score (0-indexed measure classes, incl. the clef's) — the
   *  bar count, used to seek the synth to a single bar. */
  function measureCount() {
    var svg = svgEl();
    if (!svg) return 0;
    var set = {};
    Array.prototype.forEach.call(svg.querySelectorAll('[class*="abcjs-mm"]'), function (el) {
      var r = measureFromClasses(el.getAttribute('class'));
      if (r != null) set[r] = true;
    });
    return Object.keys(set).length;
  }

  /** Play ONLY bar N (design 4c long-press). Bars are equal length in a uniform metre, so
   *  bar N starts at (N-1)/bars of the tune and lasts totalTime/bars; seek there, start,
   *  and stop after that span (+ a little ring-out). */
  function playBar(bar) {
    if (!ABCJS.synth.supportsAudio()) { emit({ type: 'audioUnsupported' }); return; }
    var bars = measureCount();
    if (!bars || bar < 1 || bar > bars) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    var ac = new AC();
    ac.resume().then(function () {
      var s = new ABCJS.synth.CreateSynth();
      return s.init({ audioContext: ac, visualObj: visualObj, options: SOUNDFONT ? { soundFontUrl: SOUNDFONT } : {} })
        .then(function () { return s.prime(); })
        .then(function () {
          var total = (visualObj && visualObj.getTotalTime) ? visualObj.getTotalTime() : 0; // seconds
          var barMs = total > 0 ? (total * 1000 / bars) : 0;
          s.seek((bar - 1) / bars);
          s.start();
          emit({ type: 'played', latencyMs: 0 });
          if (barMs > 0) setTimeout(function () { try { s.stop(); } catch (e) {} }, barMs + 40);
        });
    }).catch(function (e) {
      emit({ type: 'error', message: 'playBar: ' + (e && e.message || e) });
    });
  }

  /** D9 "hear yours": parse abc into the HIDDEN container and play it, never touching
   *  #paper (the visible score) — no renderAbc('paper', ...) call and no 'rendered'
   *  event, so the given melody on screen is never repainted. */
  function playAbc(abc) {
    if (!ABCJS.synth.supportsAudio()) { emit({ type: 'audioUnsupported' }); return; }
    var hiddenObj;
    try {
      var hiddenOpts = Object.assign({}, ${renderOpts});
      hiddenObj = ABCJS.renderAbc('hidden-paper', abc, hiddenOpts)[0];
    } catch (e) {
      emit({ type: 'error', message: 'playAbc render: ' + (e && e.message || e) });
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    var ac = new AC();
    ac.resume().then(function () {
      var s = new ABCJS.synth.CreateSynth();
      return s.init({ audioContext: ac, visualObj: hiddenObj, options: SOUNDFONT ? { soundFontUrl: SOUNDFONT } : {} })
        .then(function () { return s.prime(); })
        .then(function () {
          s.start();
          emit({ type: 'played', latencyMs: 0 });
        });
    }).catch(function (e) {
      emit({ type: 'error', message: 'playAbc: ' + (e && e.message || e) });
    });
  }

  /** Tint the bar (1-indexed) with a translucent rect behind the notes, or clear it. The
   *  bar's notes carry class abcjs-mm(bar-1); we union their boxes (skipping the clef and
   *  other staff furniture that share measure 0) for the rect's x-extent. */
  function highlightBar(bar, color) {
    var svg = svgEl();
    if (!svg) return;
    var old = svg.querySelector('.bar-highlight');
    if (old) old.parentNode.removeChild(old);
    if (bar == null) return;
    var sel = svg.querySelectorAll('[class~="abcjs-mm' + (bar - 1) + '"]');
    var left = Infinity, right = -Infinity, found = false;
    Array.prototype.forEach.call(sel, function (el) {
      if (/abcjs-(staff|clef|key-signature|time-signature)/.test(el.getAttribute('class') || '')) return;
      var bb;
      try { bb = el.getBBox(); } catch (e) { return; }
      if (!bb || (bb.width === 0 && bb.height === 0)) return;
      left = Math.min(left, bb.x);
      right = Math.max(right, bb.x + bb.width);
      found = true;
    });
    if (!found) return;
    var vb = svg.viewBox && svg.viewBox.baseVal;
    var pad = 5;
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'bar-highlight');
    rect.setAttribute('x', left - pad);
    rect.setAttribute('y', vb ? vb.y : 0);
    rect.setAttribute('width', (right - left) + pad * 2);
    rect.setAttribute('height', vb ? vb.height : 100);
    rect.setAttribute('rx', '5');
    rect.setAttribute('fill', color || '#cb7ad4');
    rect.setAttribute('fill-opacity', '0.18');
    svg.insertBefore(rect, svg.firstChild);
  }

  function handle(cmd) {
    if (!cmd || !cmd.type) return;
    if (cmd.type === 'render') renderAbc(cmd.abc, cmd.scale, cmd.staffwidth);
    else if (cmd.type === 'play') play();
    else if (cmd.type === 'stop') { if (synth) synth.stop(); }
    else if (cmd.type === 'highlightBar') highlightBar(cmd.bar, cmd.color);
    else if (cmd.type === 'playAbc') playAbc(cmd.abc);
  }

  // RN -> WebView (react-native-webview delivers to window 'message').
  window.addEventListener('message', function (e) {
    try { handle(JSON.parse(e.data)); } catch (err) { emit({ type: 'error', message: 'bad command' }); }
  });
  // Some Android webview versions deliver to document instead.
  document.addEventListener('message', function (e) {
    try { handle(JSON.parse(e.data)); } catch (err) {}
  });

  function boot() {
    emit({ type: 'ready' });
    if (INITIAL_ABC) renderAbc(INITIAL_ABC);
    var btn = document.getElementById('surface-play');
    if (btn) btn.addEventListener('click', play);
    // The bar-tap is handled by abcjs's clickListener (wired in renderAbc), not a manual
    // DOM listener — abcjs owns the note layout and hit-testing. We only track when a
    // press began, so onNoteClick can tell a long-press (hear the bar) from a tap.
    document.addEventListener('touchstart', function () { pressStart = Date.now(); }, { passive: true });
    if (AUTORUN) play();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
</script>
</body>
</html>`;
}
