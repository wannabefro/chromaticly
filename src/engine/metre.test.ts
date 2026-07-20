import { classifyMetre, isCompoundTimeSignature } from './metre';

describe('classifyMetre — total over the six renderable signatures (D7)', () => {
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

  test.each(['2/2', '3/8', '5/4'])(
    'throws on "%s" — no silent default class outside the renderable set',
    (sig) => {
      expect(() => classifyMetre(sig)).toThrow(sig);
    },
  );
});

describe('isCompoundTimeSignature — x/8 with a multiple-of-3 numerator (matches the emitter\'s beatUnit rule)', () => {
  // 3/8 is num=3 (a multiple of 3), den=8 — compound by the same rule the emitter's
  // beatUnit uses (abc-emitter.ts:178-182), even though it's outside classifyMetre's
  // six-signature table (a stricter, renderable-only classification).
  test.each(['3/8', '6/8', '9/8', '12/8'])('%s is compound', (sig) => {
    expect(isCompoundTimeSignature(sig)).toBe(true);
  });

  test.each(['2/4', '3/4', '4/4', '2/2', '3/2', '4/2'])('%s is not compound', (sig) => {
    expect(isCompoundTimeSignature(sig)).toBe(false);
  });
});
