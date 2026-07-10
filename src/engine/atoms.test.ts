import {
  intervalAtom,
  keySigAtom,
  noteReadAtom,
  parseAtom,
  rhythmSumAtom,
  termAtom,
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

  test('termAtom produces term:<slug>', () => {
    expect(termAtom('cantabile')).toBe('term:cantabile');
  });

  test('rhythmSumAtom is the bare constant id with no parameters', () => {
    expect(rhythmSumAtom()).toBe('rhythm_sum');
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

  test('term atom round-trips the slug', () => {
    expect(parseAtom(termAtom('cantabile'))).toEqual({ kind: 'term', parts: ['cantabile'] });
  });

  test('a no-colon id like rhythm_sum parses to an empty parts array', () => {
    expect(parseAtom('rhythm_sum')).toEqual({ kind: 'rhythm_sum', parts: [] });
    expect(parseAtom(rhythmSumAtom())).toEqual({ kind: 'rhythm_sum', parts: [] });
  });
});
