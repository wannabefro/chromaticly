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
const SRC = join(__dirname, '..', '..'); // repo src/

// A8: the guard covers the slice's surfaces — the component library plus the
// reskinned/new files this slice owns. It deliberately EXCLUDES the legacy
// unstyled screens (Lesson/Practice/Screen and the non-reskinned interactions),
// which are Deferred to Follow-Up Work.
const SLICE_FILES = [
  'ui/ExerciseLoop.tsx',
  'ui/interactions/Mcq.tsx',
  'ui/SetRunner.tsx',
  'ui/SetComplete.tsx',
  'screens/onboarding/WelcomeScreen.tsx',
  'screens/onboarding/AgeGateScreen.tsx',
  'screens/LevelMapScreen.tsx',
];

function componentFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...componentFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function existsFile(p: string): boolean {
  try {
    readFileSync(p, 'utf8');
    return true;
  } catch {
    return false;
  }
}

describe('slice surfaces — no raw hex colour literals (KTD1/A8: tokens only)', () => {
  test('every slice surface reads colour from the theme, never a hex literal', () => {
    const files = [
      ...componentFiles(__dirname),
      ...SLICE_FILES.map((f) => join(SRC, f)).filter(existsFile), // some created in later units
    ];
    const violations: string[] = [];
    for (const file of files) {
      if (HEX_LITERAL.test(readFileSync(file, 'utf8'))) violations.push(file.replace(SRC, 'src'));
    }
    expect(files.length).toBeGreaterThan(8);
    expect(violations).toEqual([]);
  });
});
