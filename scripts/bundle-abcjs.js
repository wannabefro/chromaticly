// Generates src/music-surface/abcjs-source.json from the installed abcjs dist.
// The JSON string is imported by the WebView surface and inlined into the HTML,
// so abcjs ships inside the app bundle (offline) without a native asset step.
// Re-run after bumping abcjs: `node scripts/bundle-abcjs.js`.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'node_modules', 'abcjs', 'dist', 'abcjs-basic-min.js'),
  'utf8',
);
const out = path.join(__dirname, '..', 'src', 'music-surface', 'abcjs-source.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ version: require('abcjs/package.json').version, source: src }));
console.log(`Wrote ${out} (${Math.round(src.length / 1024)} KB abcjs source)`);
