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
  /** Default fill for the note-granularity ring (G5-1 SATB, colors.hint — the
   *  amber "smart tips" token, R6). A `highlightNote` command's own `color`
   *  overrides this per-call. */
  ringColor?: string;
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
  const ring = JSON.stringify(opts.ringColor ?? '#f0c489');
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
  var RING_COLOR = ${ring};
  // Semantic, not the strand hue: "mine" and "right" must not share one.
  var MARK_WRONG = '#e0575e';
  var MARK_RIGHT = '#3a9e63';
  var visualObj = null;
  var synth = null;
  var pressStart = 0; // touchstart time — lets onNoteClick tell a long-press from a tap

  function emit(ev) {
    var s = JSON.stringify(ev);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(s); }
    // Console mirror so a headless browser / native webview logs can read it too.
    console.log('[surface] ' + s);
  }

  // The last render request, and the body width it painted into. Together they let the
  // surface (a) report a host that gave it no width and (b) repaint once it gets one.
  var lastRender = null;
  var lastPaintedWidth = 0;

  function renderAbc(abc, scale, staffwidth) {
    try {
      lastRender = { abc: abc, scale: scale, staffwidth: staffwidth };
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
      // note keeps the card compact). Use the SVG's own height ATTRIBUTE, not
      // getBoundingClientRect(): abcjs bakes the scale option into the height
      // attribute AND also applies a CSS transform:scale, so the bounding rect
      // double-counts scale (returns natural height x scale^2). At the ornament
      // hero's 3.15x
      // scale that inflates a ~385px stave to ~1212px, producing a screen-filling
      // blank card (chromaticly-9c8). The attribute is the intended rendered size.
      var svgNode = document.querySelector('#inner svg');
      var attrHeight = svgNode ? parseFloat(svgNode.getAttribute('height')) : 0;
      var renderedHeight = attrHeight > 0
        ? Math.ceil(attrHeight)
        : (svgNode ? Math.ceil(svgNode.getBoundingClientRect().height) : 0);
      emit({ type: 'rendered', ms: Math.round(performance.now() - t), height: renderedHeight });
      // A zero-width host is a SILENT blank card (chromaticly-9c8): abcjs lays out to
      // staffwidth regardless of the viewport, so it renders happily and reports a
      // sane height — RN dismisses the stave skeleton — while #paper (width:100% of a
      // 0px body, overflow-x:auto) clips every glyph. Nothing throws, so the only way
      // this surfaces is to say it. The cause is always the RN side: a host View that
      // gives the WebView no cross-axis width (alignItems:'center' or a bare
      // flexShrink around MusicSurface, whose wrapper declares only a height).
      // Gated on the svg having real geometry as well, so this fires for a genuinely
      // zero-width HOST and not for a layout-free environment (jsdom reports 0 for
      // everything, and the surface-html tests mount this very page there).
      lastPaintedWidth = document.body.clientWidth;
      var drawnWidth = svgNode ? svgNode.getBoundingClientRect().width : 0;
      if (lastPaintedWidth === 0 && drawnWidth > 0) {
        emit({ type: 'error', message: 'zero-width surface: the host View gave the WebView no width, so the notation cannot paint — check the RN flex parent' });
      }
      // Re-apply a pending note ring now that the notes exist in the DOM (see
      // lastNoteHighlight): the stimulus's highlightNote command routinely
      // arrives before this render completes.
      if (lastNoteHighlight) highlightNote(lastNoteHighlight.locator, lastNoteHighlight.color);
      if (gapMode) { drawGapZones(); if (lastBarlines) drawBarlines(lastBarlines.gaps, lastBarlines.color, lastBarlines.marks); }
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

  // Offscreen render -> trimmed SVG string (chromaticly-9lb). Renders the abc into the
  // hidden container (never touches the visible #inner score), tightens the SVG to its
  // content box so a static option card has no loose right-hand whitespace, and posts
  // the standalone markup back for the request id. The one shared surface pre-renders
  // every MCQ option this way instead of each option booting its own 500KB abcjs WebView.
  function renderToSvg(abc, scale, reqId) {
    try {
      var opts = Object.assign({}, ${renderOpts});
      if (typeof scale === 'number') opts.scale = scale;
      ABCJS.renderAbc('hidden-paper', abc, opts);
      var svg = document.querySelector('#hidden-paper svg');
      if (!svg) { emit({ type: 'svgRendered', reqId: reqId, svg: '', width: 0, height: 0 }); return; }
      // Union the geometry of every drawn path for a tight content box: abcjs lays the
      // stave out on a loose 740px-wide canvas with the notes packed at the left, so the
      // raw width attribute would leave a static card mostly empty.
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      Array.prototype.forEach.call(svg.querySelectorAll('path'), function (p) {
        var b; try { b = p.getBBox(); } catch (e) { return; }
        if (!b || (b.width === 0 && b.height === 0)) return;
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
      });
      var pad = 2;
      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = parseFloat(svg.getAttribute('width')) || 0; maxY = parseFloat(svg.getAttribute('height')) || 0; }
      var w = (maxX - minX) + pad * 2;
      var h = (maxY - minY) + pad * 2;
      svg.setAttribute('viewBox', (minX - pad) + ' ' + (minY - pad) + ' ' + w + ' ' + h);
      svg.setAttribute('width', w);
      svg.setAttribute('height', h);
      // abcjs applies the notation scale as a CSS transform on the ROOT svg
      // (style="transform: scale(1.5, 1.5)"). react-native-svg's parser rejects that
      // two-value scale ("Transform with key of scale must be a number"), and it is
      // redundant here anyway: the viewBox above is the scale-invariant path geometry,
      // so SvgXml scales the content to the card itself. Drop the style attribute.
      svg.removeAttribute('style');
      // The in-SVG <style> element only scopes user-select on drag (irrelevant to a
      // static render) and react-native-svg ignores CSS blocks anyway — drop it too.
      var styleEl = svg.querySelector('style');
      if (styleEl) styleEl.parentNode.removeChild(styleEl);
      emit({ type: 'svgRendered', reqId: reqId, svg: svg.outerHTML, width: w, height: h });
    } catch (e) {
      emit({ type: 'svgRendered', reqId: reqId, svg: '', width: 0, height: 0 });
      emit({ type: 'error', message: 'renderToSvg: ' + (e && e.message || e) });
    }
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

  /** Ring the note-granularity target (G5-1 SATB "name the voice", U3) — the
   *  note-index sibling of highlightBar, since abcjs has no in-ABC note colour.
   *  abcjs's add_classes (RENDER_OPTS) tags every note/chord element with its
   *  voice index (abcjs-vN) and its position within that voice (abcjs-nN, a
   *  chord's stack of pitches is still ONE element). music.voices indices are
   *  unique across the whole grand staff and abcjs numbers its v0.. voices in
   *  the same V: declaration order the emitter writes them in, so the
   *  {voice, noteIndex} pair alone addresses exactly one element; "staff" is
   *  carried by the locator for the caller's own bookkeeping, not the selector. */
  // Remembered so a ring survives (and is re-applied after) the next render:
  // ExerciseLoop issues highlightNote on stimulus change, which races the render
  // of that same stimulus — if the command lands before abcjs has drawn the
  // notes, the selector finds nothing. renderAbc replays this after it finishes.
  var lastNoteHighlight = null;

  function highlightNote(locator, color) {
    lastNoteHighlight = locator ? { locator: locator, color: color } : null;
    var svg = svgEl();
    if (!svg) return;
    var old = svg.querySelector('.note-highlight');
    if (old) old.parentNode.removeChild(old);
    if (!locator) return;
    var el = svg.querySelector('.abcjs-note.abcjs-v' + locator.voice + '.abcjs-n' + locator.noteIndex);
    if (!el) return;
    // Ring the notehead, not the whole note group (which spans the stem), and
    // append the ring INSIDE el so it inherits el's coordinate space — abcjs
    // wraps the score in a scale group at render scale, so a ring placed at the
    // svg root with el's local getBBox coords lands off-note. As a child of el,
    // the same getBBox coords position it correctly and it tracks every ancestor
    // transform. First child → painted behind the black notehead (a halo).
    var head = el.querySelector('.abcjs-notehead') || el;
    var bb;
    try { bb = head.getBBox(); } catch (e) { return; }
    if (!bb || (bb.width === 0 && bb.height === 0)) return;
    var ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('class', 'note-highlight');
    ring.setAttribute('cx', bb.x + bb.width / 2);
    ring.setAttribute('cy', bb.y + bb.height / 2);
    ring.setAttribute('r', Math.max(bb.width, bb.height) / 2 + 5);
    ring.setAttribute('fill', color || RING_COLOR);
    ring.setAttribute('fill-opacity', '0.32');
    el.insertBefore(ring, el.firstChild);
  }


  // --- Gap tapping (chromaticly-51o: add the bar-lines) ---------------------
  // Our own rects, not abcjs's clickListener: that hit-tests to a NOTE.
  var gapMode = false;
  var lastBarlines = null;

  function noteEls() {
    var svg = svgEl();
    if (!svg) return [];
    var els = Array.prototype.slice.call(svg.querySelectorAll('.abcjs-note.abcjs-v0'));
    return els.sort(function (a, b) {
      var ai = /abcjs-n(\d+)/.exec(a.getAttribute('class') || '');
      var bi = /abcjs-n(\d+)/.exec(b.getAttribute('class') || '');
      return (ai ? +ai[1] : 0) - (bi ? +bi[1] : 0);
    });
  }

  /** The x of each gap centre, index 0 = the gap after note 1. */
  function gapCentres() {
    var els = noteEls();
    var xs = [];
    for (var i = 0; i < els.length; i++) {
      var bb;
      try { bb = els[i].getBBox(); } catch (e) { return []; }
      xs.push(bb.x + bb.width / 2);
    }
    var centres = [];
    for (var k = 1; k < xs.length; k++) centres.push((xs[k - 1] + xs[k]) / 2);
    return centres;
  }

  /** The stave's own top and bottom, so a bar-line spans it exactly. */
  function staveBox() {
    var svg = svgEl();
    var staff = svg && svg.querySelector('.abcjs-staff');
    if (!staff) return null;
    try { return staff.getBBox(); } catch (e) { return null; }
  }

  function clearLayer(name) {
    var svg = svgEl();
    if (!svg) return;
    var old = svg.querySelector('.' + name);
    if (old) old.parentNode.removeChild(old);
  }

  function drawGapZones() {
    clearLayer('gap-zones');
    var svg = svgEl();
    var box = staveBox();
    if (!svg || !box || !gapMode) return;
    var centres = gapCentres();
    if (centres.length === 0) return;
    var layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    layer.setAttribute('class', 'gap-zones');
    for (var i = 0; i < centres.length; i++) {
      // Half-way to each neighbour, so the zones tile with no dead space.
      var left = i === 0 ? box.x : (centres[i - 1] + centres[i]) / 2;
      var right = i === centres.length - 1 ? box.x + box.width : (centres[i] + centres[i + 1]) / 2;
      var guide = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      guide.setAttribute('x1', centres[i]); guide.setAttribute('x2', centres[i]);
      guide.setAttribute('y1', box.y - 4); guide.setAttribute('y2', box.y + box.height + 4);
      guide.setAttribute('stroke', '#d8d3c4');
      guide.setAttribute('stroke-width', '1.5');
      guide.setAttribute('stroke-dasharray', '2 3');
      layer.appendChild(guide);
      var zone = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      zone.setAttribute('x', left); zone.setAttribute('width', Math.max(right - left, 1));
      zone.setAttribute('y', box.y - 10); zone.setAttribute('height', box.height + 20);
      zone.setAttribute('fill', 'transparent');
      zone.setAttribute('class', 'gap-zone');
      zone.setAttribute('data-gap', i + 1);
      zone.addEventListener('click', (function (gap) {
        return function () { emit({ type: 'gapTapped', gap: gap }); };
      })(i + 1));
      layer.appendChild(zone);
    }
    svg.appendChild(layer);
  }

  function setGapMode(enabled) {
    gapMode = !!enabled;
    if (!gapMode) { lastBarlines = null; clearLayer('gap-zones'); clearLayer('placed-barlines'); return; }
    drawGapZones();
  }

  function drawBarlines(gaps, color, marks) {
    lastBarlines = { gaps: gaps || [], color: color, marks: marks || null };
    clearLayer('placed-barlines');
    var svg = svgEl();
    var box = staveBox();
    if (!svg || !box) return;
    var centres = gapCentres();
    var layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    layer.setAttribute('class', 'placed-barlines');
    var wrong = (marks && marks.wrong) || [];
    var missed = (marks && marks.missed) || [];
    function line(gap, stroke, dashed) {
      var x = centres[gap - 1];
      if (x == null) return;
      var el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      el.setAttribute('x1', x); el.setAttribute('x2', x);
      el.setAttribute('y1', box.y); el.setAttribute('y2', box.y + box.height);
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', '2.4');
      el.setAttribute('stroke-linecap', 'round');
      if (dashed) el.setAttribute('stroke-dasharray', '3 3');
      layer.appendChild(el);
    }
    for (var i = 0; i < lastBarlines.gaps.length; i++) {
      var gap = lastBarlines.gaps[i];
      line(gap, wrong.indexOf(gap) >= 0 ? MARK_WRONG : (color || RING_COLOR), false);
    }
    // Printing the answer alone hides half the lesson.
    for (var j = 0; j < missed.length; j++) line(missed[j], MARK_RIGHT, true);
    svg.appendChild(layer);
  }

  function handle(cmd) {
    if (!cmd || !cmd.type) return;
    if (cmd.type === 'render') renderAbc(cmd.abc, cmd.scale, cmd.staffwidth);
    else if (cmd.type === 'renderToSvg') renderToSvg(cmd.abc, cmd.scale, cmd.reqId);
    else if (cmd.type === 'play') play();
    else if (cmd.type === 'stop') { if (synth) synth.stop(); }
    else if (cmd.type === 'highlightBar') highlightBar(cmd.bar, cmd.color);
    else if (cmd.type === 'highlightNote') highlightNote(cmd.locator, cmd.color);
    else if (cmd.type === 'playAbc') playAbc(cmd.abc);
    else if (cmd.type === 'setGapMode') setGapMode(cmd.enabled);
    else if (cmd.type === 'setBarlines') drawBarlines(cmd.gaps, cmd.color, cmd.marks);
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
    // Repaint if the host only gives the surface a width later — a render into a
    // zero-width body draws nothing and abcjs never re-runs on its own, so without
    // this the card stays blank for good. Guarded on the 0 -> non-zero transition
    // only: the card's own height growth also fires resize, and re-rendering on that
    // would loop (render -> RN resizes -> resize -> render).
    window.addEventListener('resize', function () {
      var w = document.body.clientWidth;
      if (lastRender && lastPaintedWidth === 0 && w > 0) {
        renderAbc(lastRender.abc, lastRender.scale, lastRender.staffwidth);
      }
    });
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
