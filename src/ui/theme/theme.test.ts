// U1: the theme is the token contract every component reads. These tests pin the
// invariants downstream units rely on, so a broken/edited token fails loudly here.

import { colors, examColors, type, fonts } from './tokens';
import { STRAND_DEFS, type Strand } from './strands';

describe('theme tokens', () => {
  test('notation paper is the light card colour (rule 1: notation never inverts)', () => {
    expect(colors.paper).toBe('#f6f4ee');
    expect(colors.paperInk).toBe('#1a1a1a');
  });

  test('all 7 strands define a hue, a colour-vision-safe glyph, and a label (rule 3)', () => {
    const strands: Strand[] = [
      'rhythm',
      'pitch',
      'scales_keys',
      'intervals',
      'chords',
      'terms_signs',
      'context',
    ];
    for (const s of strands) {
      const def = STRAND_DEFS[s];
      expect(def.hue).toMatch(/^#[0-9a-f]{6}$/i);
      expect(def.glyph.length).toBeGreaterThan(0);
      expect(def.label.length).toBeGreaterThan(0);
    }
  });

  test('the type scale carries a family for every role', () => {
    for (const role of Object.values(type)) {
      expect(role.fontFamily).toBeTruthy();
    }
  });

  test('font family names match the loaded expo-google-fonts constants', () => {
    expect(fonts.ui).toBe('Figtree_400Regular');
    expect(fonts.uiHeavy).toBe('Figtree_800ExtraBold');
    expect(fonts.mono).toBe('IBMPlexMono_400Regular');
    expect(fonts.music).toBe('NotoMusic_400Regular');
  });

  test('exam register exists as a separate palette (rule 4: assessment mode shifts register)', () => {
    // Warm paper + merit banding, distinct from the dark UI palette.
    expect(examColors.bg).toBe('#f2efe8');
    expect(examColors.bandDistinction).toBe('#a8843c');
    // The exam register must never be the same surface as normal UI.
    expect(examColors.bg).not.toBe(colors.bg);
  });

  test('exam headings use the Source Serif face; exam body stays sans (rule 4)', () => {
    expect(fonts.examBold).toBe('SourceSerif4_700Bold');
    expect(type.examTitle.fontFamily).toBe(fonts.examBold);
    expect(type.examPrompt.fontFamily).toBe(fonts.examSemibold);
  });
});
