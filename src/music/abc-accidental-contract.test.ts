// The emitter decides WHERE to print an accidental; abcjs decides what that
// sounds. This pins the four rules the emitter assumes against abcjs itself, so
// a library upgrade that changed any of them fails here rather than on a
// learner's ear. Found by /council 2026-08-04 (finding 4).

import abcjs from 'abcjs';

import { musicToAbc } from './abc-emitter';
import type { Music, Pitch } from './types';

/** Note-on pitches abcjs would play, read from the MIDI it generates. */
function sounded(body: string, header = 'M:none\nK:C clef=treble'): number[] {
  const tune = abcjs.parseOnly(`X:1\nL:1/32\n${header}\n${body}\n`)[0];
  const encoded = abcjs.synth.getMidiFile(tune, { midiOutputType: 'encoded' }) as unknown as string;
  const raw = encoded.replace(/^data:audio\/midi,/, '');
  const bytes: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '%') {
      bytes.push(parseInt(raw.substr(i + 1, 2), 16));
      i += 2;
    } else bytes.push(raw.charCodeAt(i));
  }
  const out: number[] = [];
  // 0x90 is note-on; a zero velocity is a note-off in disguise.
  for (let i = 0; i < bytes.length - 2; i++) if (bytes[i] === 0x90 && bytes[i + 2] > 0) out.push(bytes[i + 1]);
  return out;
}

describe('abcjs accidental contract — the four rules the emitter is built on', () => {
  test('an accidental carries to a later bare letter in the same bar', () => {
    expect(sounded('^F8 F8')).toEqual([66, 66]);
  });

  test('an explicit natural cancels it — this is what the emitter now prints', () => {
    expect(sounded('^F8 =F8')).toEqual([66, 65]);
  });

  test('a barline clears it', () => {
    expect(sounded('^F8 | F8')).toEqual([66, 65]);
  });

  test('a key signature does NOT clear at the barline', () => {
    expect(sounded('F8 | F8', 'M:none\nK:G clef=treble')).toEqual([66, 66]);
  });

  test('the same letter an octave away is a separate slot', () => {
    expect(sounded('^F8 f8')).toEqual([66, 77]);
  });
});

describe('abc-emitter — what it emits is what abcjs plays', () => {
  const line = (pitches: Pitch[], key: Music['key_sig'] = null): Music => ({
    key_sig: key,
    time_sig: null,
    clef: 'bass',
    voices: [{ events: pitches.map((pitch) => ({ type: 'note' as const, pitch, dur: 'crotchet' as const })) }],
  });

  function play(music: Music): number[] {
    const lines = musicToAbc(music).trim().split('\n');
    const body = lines.pop()!;
    return sounded(body, lines.slice(1).join('\n'));
  }

  // melodic-minor-3 plays 3. A bare `G,` here sounded as G sharp.
  test('a G natural after a G sharp in the same bar sounds as G natural', () => {
    expect(play(line(['A3', 'G#3', 'G3']))).toEqual([57, 56, 55]);
  });

  test('the stimulus it was altered from still sounds as written', () => {
    expect(play(line(['A3', 'G#3', 'A3']))).toEqual([57, 56, 57]);
  });
});
