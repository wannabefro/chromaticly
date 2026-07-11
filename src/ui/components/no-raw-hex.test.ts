// KTD1/A8 guard: the slice's presentational components read colour exclusively
// from the theme — never a raw hex literal. A8 scopes the guard to the slice's
// surfaces; this file covers src/ui/components (the legacy unstyled screens are
// explicitly excluded elsewhere per A8). Only this directory exists so far.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: (mod: string) => any;
declare const __dirname: string;
const { readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/;

function componentFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...componentFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('src/ui/components — no raw hex colour literals (KTD1/A8: tokens only)', () => {
  test('every component reads colour from the theme, never a hex literal', () => {
    const violations: string[] = [];
    let scanned = 0;
    for (const file of componentFiles(__dirname)) {
      scanned += 1;
      const src = readFileSync(file, 'utf8');
      if (HEX_LITERAL.test(src)) {
        violations.push(file.replace(__dirname, 'src/ui/components'));
      }
    }
    expect(scanned).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });
});
