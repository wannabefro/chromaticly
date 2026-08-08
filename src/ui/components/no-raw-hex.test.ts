// KTD1/A8 guard: every UI surface reads colour and spacing from the theme,
// never a literal.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: (mod: string) => any;
declare const __dirname: string;
const { readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/;
const RAW_SPACING = /\b\w*(?:[Pp]adding|[Mm]argin|[Gg]ap)\w*\s*:\s*\d/;
const RAW_FONT_SIZE = /\bfontSize\s*:\s*\d/;
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


function surfaces(): string[] {
  return ROOTS.flatMap((r) => componentFiles(join(SRC, r))).filter((f) => !TOKEN_FILES.includes(f));
}

function offenders(pattern: RegExp): string[] {
  return surfaces()
    .filter((f) => pattern.test(readFileSync(f, 'utf8')))
    .map((f) => f.replace(SRC, 'src'));
}

describe('slice surfaces — tokens only, never a literal (KTD1/A8)', () => {
  test('the guard actually walks the whole UI tree', () => {
    expect(surfaces().length).toBeGreaterThan(70);
  });

  test('every surface reads colour from the theme, never a hex literal', () => {
    expect(offenders(HEX_LITERAL)).toEqual([]);
  });

  // A padding of 10 is not a decision, it is a guess. shape.* names the rhythm.
  test('every surface reads padding, margin and gap from shape, never a number', () => {
    expect(offenders(RAW_SPACING)).toEqual([]);
  });

  // Text reads type.*; a drawn shape reads glyph.*. Neither reads a number.
  test('every surface sizes text and glyphs from a token, never a number', () => {
    expect(offenders(RAW_FONT_SIZE)).toEqual([]);
  });
});
