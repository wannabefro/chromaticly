// KTD1/A8 guard: every UI surface reads colour from the theme, never a hex.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: (mod: string) => any;
declare const __dirname: string;
const { readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/;
const SRC = join(__dirname, '..', '..'); // repo src/

const ROOTS = ['ui', 'screens'];
const TOKEN_FILES = ['ui/theme/tokens.ts', 'ui/theme/strands.ts'].map((f) => join(SRC, f));

function componentFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...componentFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}


describe('slice surfaces — no raw hex colour literals (KTD1/A8: tokens only)', () => {
  test('every slice surface reads colour from the theme, never a hex literal', () => {
    const files = ROOTS.flatMap((r) => componentFiles(join(SRC, r))).filter((f) => !TOKEN_FILES.includes(f));
    const violations: string[] = [];
    for (const file of files) {
      if (HEX_LITERAL.test(readFileSync(file, 'utf8'))) violations.push(file.replace(SRC, 'src'));
    }
    expect(files.length).toBeGreaterThan(70);
    expect(violations).toEqual([]);
  });
});
