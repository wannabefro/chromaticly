import raw from '../../curriculum/terms-signs-deck.json';
import { TERMS_DECK_G1 } from './terms-deck';

/** ABRSM's counts, from the 2020 list headers. The deck had drifted onto the
 *  2019 syllabus once, uncaught (chromaticly-i8e). */
const ABRSM_2020: Record<string, { terms: number; signs: number }> = {
  grade_1: { terms: 24, signs: 10 },
  grade_2: { terms: 24, signs: 9 },
  grade_3: { terms: 23, signs: 0 },
  grade_4: { terms: 21, signs: 0 },
  grade_5: { terms: 21, signs: 0 },
};

describe('the deck holds exactly the terms ABRSM sets', () => {
  test.each(Object.entries(ABRSM_2020))('%s', (grade, expected) => {
    const block = (raw as Record<string, any>)[grade];
    const terms = block.dynamics.length + block.tempo.length + block.other_terms.length;
    expect({ terms, signs: block.signs.length }).toEqual(expected);
  });
});

describe('terms-deck.ts — only grade_1 verified entries are exposed', () => {
  test('the flat deck length equals the sum of the four raw grade_1 category array lengths', () => {
    const g1 = (raw as any).grade_1;
    const expectedLength =
      g1.dynamics.length + g1.tempo.length + g1.other_terms.length + g1.signs.length;
    expect(TERMS_DECK_G1.length).toBe(expectedLength);
  });

  test('a known grade_1 term (cantabile) is present with its meaning and category', () => {
    const entry = TERMS_DECK_G1.find((e) => e.term === 'cantabile');
    expect(entry).toBeDefined();
    expect(entry?.meaning).toBe('in a singing style');
    expect(entry?.category).toBe('other_terms');
  });

  test('grade_2_seed-only entries (e.g. "presto", which is absent from grade_1) never appear', () => {
    expect(TERMS_DECK_G1.some((e) => e.term === 'presto')).toBe(false);
  });
});
