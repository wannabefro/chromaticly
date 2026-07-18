import { durationToAbc, keyAccidentals, musicToAbc, pitchToAbc } from './abc-emitter';
import type { Music } from './types';

const NO_KEY = {};

describe('pitchToAbc — absolute pitch invariant', () => {
  test('middle C is the same token regardless of clef context (clef is not even a parameter)', () => {
    // The invariant: the pitch token is absolute; clef lives only in the K: header.
    expect(pitchToAbc('C4', NO_KEY)).toBe('C');
  });

  test('octave marks encode absolute octave', () => {
    expect(pitchToAbc('C4', NO_KEY)).toBe('C');
    expect(pitchToAbc('C5', NO_KEY)).toBe('c');
    expect(pitchToAbc('C3', NO_KEY)).toBe('C,');
    expect(pitchToAbc('C2', NO_KEY)).toBe('C,,');
    expect(pitchToAbc('C6', NO_KEY)).toBe("c'");
    expect(pitchToAbc('G5', NO_KEY)).toBe('g');
    expect(pitchToAbc('B4', NO_KEY)).toBe('B');
  });

  test('accidental prints when the key does not already impose it', () => {
    expect(pitchToAbc('Eb3', NO_KEY)).toBe('_E,');
    expect(pitchToAbc('F#5', NO_KEY)).toBe('^f');
  });

  test('accidental is suppressed when the key signature already applies it', () => {
    const ebMajor = keyAccidentals('Eb_major');
    expect(pitchToAbc('Eb3', ebMajor)).toBe('E,');
    const gMajor = keyAccidentals('G_major');
    expect(pitchToAbc('F#5', gMajor)).toBe('f');
  });

  test('a natural against a sharpening key prints an explicit natural', () => {
    const gMajor = keyAccidentals('G_major'); // F is sharp
    expect(pitchToAbc('F4', gMajor)).toBe('=F');
  });
});

describe('keyAccidentals', () => {
  test('Grade 1 major keys map to the right accidentals', () => {
    expect(keyAccidentals('C_major')).toEqual({});
    expect(keyAccidentals('G_major')).toEqual({ F: 'sharp' });
    expect(keyAccidentals('D_major')).toEqual({ F: 'sharp', C: 'sharp' });
    expect(keyAccidentals('F_major')).toEqual({ B: 'flat' });
  });

  test('null key signature imposes nothing', () => {
    expect(keyAccidentals(null)).toEqual({});
  });
});

describe('durationToAbc — Grade 1 note values (L:1/32)', () => {
  test('undotted values map to integer unit counts', () => {
    expect(durationToAbc('semibreve')).toBe('32');
    expect(durationToAbc('minim')).toBe('16');
    expect(durationToAbc('crotchet')).toBe('8');
    expect(durationToAbc('quaver')).toBe('4');
    expect(durationToAbc('semiquaver')).toBe('2');
  });

  test('dotted values stay integers', () => {
    expect(durationToAbc('crotchet', 1)).toBe('12');
    expect(durationToAbc('minim', 1)).toBe('24');
    expect(durationToAbc('crotchet', 2)).toBe('14');
  });
});

describe('musicToAbc', () => {
  function singleNote(clef: 'treble' | 'bass'): Music {
    return {
      clef,
      key_sig: null,
      time_sig: null,
      voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'semibreve' }] }],
    };
  }

  test('middle C emits the same body in treble and bass; only the K clef header differs', () => {
    const treble = musicToAbc(singleNote('treble'));
    const bass = musicToAbc(singleNote('bass'));
    expect(treble).toContain('K:C clef=treble');
    expect(bass).toContain('K:C clef=bass');
    // Same note body ("C32") in both — the pitch token does not follow the clef.
    expect(treble).toContain('C32');
    expect(bass).toContain('C32');
  });

  test('a tonic triad renders as an ABC chord', () => {
    const music: Music = {
      clef: 'treble',
      key_sig: 'C_major',
      time_sig: null,
      voices: [
        { events: [{ type: 'chord', pitches: ['C4', 'E4', 'G4'], dur: 'semibreve' }] },
      ],
    };
    expect(musicToAbc(music)).toContain('[CEG]32');
  });

  test('a harmonic interval emits both notes at their correct octaves', () => {
    const music: Music = {
      clef: 'treble',
      key_sig: 'D_major',
      time_sig: null,
      voices: [
        { events: [{ type: 'chord', pitches: ['F#4', 'C#5'], dur: 'semibreve' }] },
      ],
    };
    // Under D major both F# and C# are in the signature, so no printed accidentals.
    expect(musicToAbc(music)).toContain('[Fc]32');
  });
});

describe('musicToAbc — beaming (302.38): a space breaks the beam, so beam within a beat', () => {
  const quaver = (pitch: string) => ({ type: 'note' as const, pitch, dur: 'quaver' as const });
  const crotchet = (pitch: string) => ({ type: 'note' as const, pitch, dur: 'crotchet' as const });
  const bodyOf = (events: import('./types').MusicEvent[], time_sig: string) =>
    musicToAbc({ clef: 'treble', key_sig: null, time_sig, voices: [{ events }] }).split('\n').filter((l) => l && !/^[XLMK]:/.test(l))[0];

  test('two quavers in one beat are beamed (no space between them)', () => {
    expect(bodyOf([quaver('C4'), quaver('D4')], '2/4')).toBe('C4D4');
  });

  test('four quavers in 2/4 beam two-by-two — a space at the beat boundary', () => {
    expect(bodyOf([quaver('C4'), quaver('D4'), quaver('E4'), quaver('F4')], '2/4')).toBe('C4D4 E4F4');
  });

  test('a crotchet never beams to a neighbour (it carries no beam)', () => {
    expect(bodyOf([quaver('C4'), crotchet('D4')], '2/4')).toBe('C4 D8');
    expect(bodyOf([crotchet('C4'), quaver('D4')], '2/4')).toBe('C8 D4');
  });

  test('compound time beams by the dotted-crotchet beat — 6/8 beams in threes, not sixes', () => {
    const six = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4'].map(quaver);
    expect(bodyOf(six, '6/8')).toBe('C4D4E4 F4G4A4');
  });

  test('a barline breaks the beam', () => {
    const events: import('./types').MusicEvent[] = [
      quaver('C4'), quaver('D4'), { type: 'barline' }, quaver('E4'), quaver('F4'),
    ];
    expect(bodyOf(events, '2/4')).toBe('C4D4 | E4F4');
  });

  test('a dynamic starts a fresh group — the beam breaks at the marking', () => {
    const events: import('./types').MusicEvent[] = [quaver('C4'), { type: 'dynamic', mark: 'f' }, quaver('D4')];
    expect(bodyOf(events, '2/4')).toBe('C4 !f!D4');
  });
});

describe('musicToAbc — dynamics (302.32)', () => {
  test('a dynamic glues its decoration onto the following note, not a separate token', () => {
    const music: Music = {
      clef: 'treble',
      key_sig: null,
      time_sig: '4/4',
      voices: [
        {
          events: [
            { type: 'dynamic', mark: 'f' },
            { type: 'note', pitch: 'C4', dur: 'crotchet' },
          ],
        },
      ],
    };
    // ABC binds a decoration to the next note: `!f!C`, never `!f! C`.
    expect(musicToAbc(music)).toContain('!f!C8');
    expect(musicToAbc(music)).not.toContain('!f! ');
  });

  test('the mark maps straight to its ABC token', () => {
    const withMark = (mark: 'p' | 'mf' | 'sfz') =>
      musicToAbc({
        clef: 'treble',
        key_sig: null,
        time_sig: null,
        voices: [{ events: [{ type: 'dynamic', mark }, { type: 'note', pitch: 'C4', dur: 'crotchet' }] }],
      });
    expect(withMark('p')).toContain('!p!C8');
    expect(withMark('mf')).toContain('!mf!C8');
    expect(withMark('sfz')).toContain('!sfz!C8');
  });

  // Fail loud: a dynamic that colours no note is malformed, not silently dropped —
  // otherwise a passage could claim to carry a term it never rendered.
  test('a dynamic before a barline throws', () => {
    const music: Music = {
      clef: 'treble',
      key_sig: null,
      time_sig: '4/4',
      voices: [{ events: [{ type: 'dynamic', mark: 'f' }, { type: 'barline' }] }],
    };
    expect(() => musicToAbc(music)).toThrow(/must precede a note/);
  });

  test('a trailing dynamic with no following note throws', () => {
    const music: Music = {
      clef: 'treble',
      key_sig: null,
      time_sig: '4/4',
      voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'crotchet' }, { type: 'dynamic', mark: 'p' }] }],
    };
    expect(() => musicToAbc(music)).toThrow(/no following note/);
  });
});
