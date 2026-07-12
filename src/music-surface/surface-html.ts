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

// abcjs render options tuned so the stave reads as the hero (A9): a wide staff that
// fills the card, notes at a legible scale, and near-zero padding so the paper isn't
// mostly empty. `responsive:'resize'` fits the SVG to the card width.
const RENDER_OPTS = { responsive: 'resize', add_classes: true, staffwidth: 140, scale: 1.5, stretchlast: true, paddingtop: 0, paddingbottom: 0, paddingleft: 0, paddingright: 0 };

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
    justify-content: center;
  }
  #paper svg { display: block; width: 100%; height: auto; }
</style>
</head>
<body>
${playButton}
<div id="paper"></div>
<script>${opts.abcjsSource}</script>
<script>
(function () {
  var SOUNDFONT = ${soundFont};
  var INITIAL_ABC = ${initialAbc};
  var AUTORUN = ${autorun};
  var visualObj = null;
  var synth = null;

  function emit(ev) {
    var s = JSON.stringify(ev);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(s); }
    // Console mirror so a headless browser / native webview logs can read it too.
    console.log('[surface] ' + s);
  }

  function renderAbc(abc) {
    try {
      var t = performance.now();
      visualObj = ABCJS.renderAbc('paper', abc, ${renderOpts})[0];
      emit({ type: 'rendered', ms: Math.round(performance.now() - t) });
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

  function handle(cmd) {
    if (!cmd || !cmd.type) return;
    if (cmd.type === 'render') renderAbc(cmd.abc);
    else if (cmd.type === 'play') play();
    else if (cmd.type === 'stop') { if (synth) synth.stop(); }
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
