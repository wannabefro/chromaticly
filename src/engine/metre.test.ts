import { classifyMetre, isIrregularTimeSignature, isCompoundTimeSignature } from './metre';

describe('classifyMetre — numerator-based, all Grade-4 metres (chromaticly-570)', () => {
  // Byte-identical to the former six-entry table.
  test.each([
    ['2/4', 'simple', 'duple'],
    ['3/4', 'simple', 'triple'],
    ['4/4', 'simple', 'quadruple'],
    ['6/8', 'compound', 'duple'],
    ['9/8', 'compound', 'triple'],
    ['12/8', 'compound', 'quadruple'],
  ] as const)('%s classifies as %s %s', (sig, division, beats) => {
    expect(classifyMetre(sig)).toEqual({ division, beats });
  });

  // The nine new Grade-4 metres — the whole point of the slice.
  test.each([
    ['2/8', 'simple', 'duple'],
    ['3/8', 'simple', 'triple'], // NOT compound: three quaver beats is simple triple
    ['4/8', 'simple', 'quadruple'],
    ['6/4', 'compound', 'duple'],
    ['9/4', 'compound', 'triple'],
    ['12/4', 'compound', 'quadruple'],
    ['6/16', 'compound', 'duple'],
    ['9/16', 'compound', 'triple'],
    ['12/16', 'compound', 'quadruple'],
  ] as const)('%s classifies as %s %s', (sig, division, beats) => {
    expect(classifyMetre(sig)).toEqual({ division, beats });
  });

  test('classification is denominator-independent — 6/4, 6/8, 6/16 all Compound duple', () => {
    const expected = { division: 'compound', beats: 'duple' };
    expect(classifyMetre('6/4')).toEqual(expected);
    expect(classifyMetre('6/8')).toEqual(expected);
    expect(classifyMetre('6/16')).toEqual(expected);
  });

  // classifyMetre is a pure musical classifier, not a scope gate: a well-formed
  // metre outside the KB (2/2 = cut time) still classifies. Scope-gating is the
  // renderable/atom layer's job, not this function's.
  test('classifies a well-formed out-of-KB metre — 2/2 is simple duple', () => {
    expect(classifyMetre('2/2')).toEqual({ division: 'simple', beats: 'duple' });
  });

  // Irregular metres (chromaticly-e3z.6): a numerator of 5 or 7 divides into no
  // equal beats, so it is a division of its own rather than an error.
  test.each([
    ['5/4', 'quintuple'],
    ['5/8', 'quintuple'],
    ['7/4', 'septuple'],
    ['7/8', 'septuple'],
  ])('%s is irregular %s', (sig, beats) => {
    expect(classifyMetre(sig)).toEqual({ division: 'irregular', beats });
    expect(isIrregularTimeSignature(sig)).toBe(true);
  });

  test('a regular metre is never irregular, whatever its denominator', () => {
    for (const sig of ['2/4', '3/4', '4/4', '6/8', '9/8', '12/8', '2/2', '6/16']) {
      expect(isIrregularTimeSignature(sig)).toBe(false);
    }
  });

  // Still throws where no classification exists at all — 15 is neither a
  // recognised beat count nor one of the two irregular numerators.
  test.each(['15/8', '11/4', '13/8'])('throws on an unclassifiable numerator "%s"', (sig) => {
    expect(() => classifyMetre(sig)).toThrow(sig);
  });

  // Strict parse (Codex C1) — malformed signatures fail loud, never mis-parse via NaN.
  test.each(['4', '4/', '/4', 'NaN/8', '', '4/4/4'])('throws on malformed "%s"', (sig) => {
    expect(() => classifyMetre(sig)).toThrow();
  });
});

describe('isCompoundTimeSignature — numerator ∈ {6,9,12}, any denominator', () => {
  test.each(['6/8', '9/8', '12/8', '6/4', '9/4', '12/4', '6/16', '9/16', '12/16'])(
    '%s is compound',
    (sig) => {
      expect(isCompoundTimeSignature(sig)).toBe(true);
    },
  );

  // 3/8 is simple triple, not compound (the corrected latent bug: the former
  // den===8 rule wrongly flagged it, but 3/8 was never renderable so it never bit).
  test.each(['2/4', '3/4', '4/4', '2/8', '3/8', '4/8', '2/2', '3/2', '4/2'])(
    '%s is not compound',
    (sig) => {
      expect(isCompoundTimeSignature(sig)).toBe(false);
    },
  );

  test.each(['4', 'NaN/8', ''])('throws on malformed "%s"', (sig) => {
    expect(() => isCompoundTimeSignature(sig)).toThrow();
  });
});
