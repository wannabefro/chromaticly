// Architectural guardrail (architecture-direction decision, 2026-07-11): the
// domain core stays platform-agnostic TypeScript so a future web target can reuse
// it unchanged. This test fails if any core module imports a mobile/native-only
// package (react-native*, expo*). `react`/`react-dom` are allowed — they are
// shared across web and native; only the RN/Expo runtime is platform-specific.
// Platform adapters (e.g. src/platform/sqlite-storage.ts) live OUTSIDE these dirs.

// Node builtins declared locally — this repo ships no @types/node (it's an RN app),
// and this filesystem-scanning test is the sole consumer, so a local ambient decl
// keeps tsc clean without pulling in a global types package.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: (mod: string) => any;
declare const __dirname: string;
const { readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const CORE_DIRS = ['engine', 'learn', 'music', 'content'];

/** A module specifier that only exists on the RN/Expo runtime. `react` is fine. */
function isPlatformImport(spec: string): boolean {
  return (
    spec === 'react-native' ||
    spec.startsWith('react-native/') ||
    spec.startsWith('react-native-') ||
    spec === 'expo' ||
    spec.startsWith('expo/') ||
    spec.startsWith('expo-')
  );
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Catches every module-specifier form: `from 'x'`, side-effect `import 'x'`,
// dynamic `import('x')`, and `require('x')` — a bare side-effect import is exactly
// the sneaky case (e.g. a polyfill), so it must not slip through.
function importSpecifiers(src: string): string[] {
  const specs: string[] = [];
  const re = /(?:\bfrom|\bimport|\brequire\()\s*\(?\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) specs.push(m[1]);
  return specs;
}

describe('core boundary — the portable domain core imports no platform-only package', () => {
  test('src/{engine,learn,music,content} never import react-native* or expo*', () => {
    const violations: string[] = [];
    let scanned = 0;
    for (const dir of CORE_DIRS) {
      for (const file of sourceFiles(join(__dirname, dir))) {
        scanned += 1;
        for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
          if (isPlatformImport(spec)) {
            violations.push(`${file.replace(__dirname, 'src')} imports "${spec}"`);
          }
        }
      }
    }
    // Guard against a vacuous pass (wrong path, mocked fs): the core is many files.
    expect(scanned).toBeGreaterThan(15);
    expect(violations).toEqual([]);
  });
});
