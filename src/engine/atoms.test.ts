import {
  byEarAtom,
  isByEarAtom,
  ornamentSignAtom,
  writtenAtomOf,
  intervalAtom,
  intervalTypeAtom,
  keySigAtom,
  noteReadAtom,
  parseAtom,
  rhythmSumAtom,
  termAtom,
  transposeAtom,
} from './atoms';

describe('atom builders — stable exact id strings', () => {
  test('noteReadAtom produces note_read:<clef>:<pitch>', () => {
    expect(noteReadAtom('treble', 'C4')).toBe('note_read:treble:C4');
    expect(noteReadAtom('bass', 'middle_c')).toBe('note_read:bass:middle_c');
  });

  test('keySigAtom produces key_sig:<key>', () => {
    expect(keySigAtom('G_major')).toBe('key_sig:G_major');
  });

  test('intervalAtom produces interval:<number>', () => {
    expect(intervalAtom(5)).toBe('interval:5');
  });

  test('intervalTypeAtom produces interval_type:<number> — a distinct kind from bare interval:<number> (D4)', () => {
    expect(intervalTypeAtom(5)).toBe('interval_type:5');
  });

  test('termAtom produces term:<slug>', () => {
    expect(termAtom('cantabile')).toBe('term:cantabile');
  });

  test('rhythmSumAtom is the bare constant id with no parameters', () => {
    expect(rhythmSumAtom()).toBe('rhythm_sum');
  });

  // One atom for the whole skill (D10), mirroring rhythmSumAtom — a
  // per-direction atom would just split SRS signal, since direction is
  // coupled to the clef pair, not an independently-taught fact.
  test('transposeAtom is the bare constant "transpose:octave" with no parameters', () => {
    expect(transposeAtom()).toBe('transpose:octave');
  });
});

describe('parseAtom — build/parse round-trip recovers the original parts', () => {
  test('note_read atom round-trips clef and pitch', () => {
    expect(parseAtom(noteReadAtom('treble', 'C4'))).toEqual({
      kind: 'note_read',
      parts: ['treble', 'C4'],
    });
  });

  test('key_sig atom round-trips the key', () => {
    expect(parseAtom(keySigAtom('G_major'))).toEqual({ kind: 'key_sig', parts: ['G_major'] });
  });

  test('interval atom round-trips the number as a string part', () => {
    expect(parseAtom(intervalAtom(5))).toEqual({ kind: 'interval', parts: ['5'] });
  });

  test('interval_type atom round-trips the number as a string part, distinct kind from interval', () => {
    expect(parseAtom(intervalTypeAtom(5))).toEqual({ kind: 'interval_type', parts: ['5'] });
  });

  test('term atom round-trips the slug', () => {
    expect(parseAtom(termAtom('cantabile'))).toEqual({ kind: 'term', parts: ['cantabile'] });
  });

  test('a no-colon id like rhythm_sum parses to an empty parts array', () => {
    expect(parseAtom('rhythm_sum')).toEqual({ kind: 'rhythm_sum', parts: [] });
    expect(parseAtom(rhythmSumAtom())).toEqual({ kind: 'rhythm_sum', parts: [] });
  });

  test('transpose:octave atom round-trips to kind "transpose" with one part, "octave"', () => {
    expect(parseAtom(transposeAtom())).toEqual({ kind: 'transpose', parts: ['octave'] });
  });
});

// KTD1: a suffix, so the readiness filter is a suffix test, not a drifting table.
describe('by-ear atoms', () => {
  test('the suffix is appended to the written atom, and the predicate recognises it', () => {
    expect(byEarAtom('rest:crotchet')).toBe('rest:crotchet:by_ear');
    expect(isByEarAtom('rest:crotchet:by_ear')).toBe(true);
    expect(isByEarAtom('rest:crotchet')).toBe(false);
  });

  test('another suffixed atom is not a by-ear atom — the test is the suffix, not the shape', () => {
    expect(isByEarAtom(ornamentSignAtom('turn'))).toBe(false);
  });

  test('stripping the suffix returns the written atom exactly, so credit can be traced back', () => {
    for (const written of ['rest:crotchet', 'note_read:treble:C4', 'rhythm_sum', ornamentSignAtom('trill')]) {
      expect(writtenAtomOf(byEarAtom(written))).toBe(written);
    }
  });

  test('a written atom is its own written form, so callers need no branch', () => {
    expect(writtenAtomOf('interval:5')).toBe('interval:5');
  });
});
