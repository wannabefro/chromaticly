import type { Music, Voice, VoiceName } from './types';

describe('Music model — SATB grand-staff metadata (G5-1)', () => {
  test('single-voice fixture with no new fields is structurally unchanged (guards R7)', () => {
    const singleVoice: Music = {
      clef: 'treble',
      key_sig: 'C_major',
      time_sig: '4/4',
      voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'crotchet' }] }],
    };

    // Deep-equal against a literal with no `staves`/`staff`/`stem`/`name`/`highlight`
    // keys present anywhere — the single-voice path must round-trip identically.
    expect(singleVoice).toEqual({
      clef: 'treble',
      key_sig: 'C_major',
      time_sig: '4/4',
      voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'crotchet' }] }],
    });
    expect(singleVoice.staves).toBeUndefined();
    expect(singleVoice.voices[0].staff).toBeUndefined();
    expect(singleVoice.voices[0].stem).toBeUndefined();
    expect(singleVoice.voices[0].name).toBeUndefined();
  });

  test('grand-staff fixture type-checks with staves + four voices carrying staff/stem/name', () => {
    const soprano: Voice = {
      events: [{ type: 'note', pitch: 'C5', dur: 'crotchet' }],
      staff: 0,
      stem: 'up',
      name: 'soprano',
    };
    const alto: Voice = {
      events: [{ type: 'note', pitch: 'G4', dur: 'crotchet' }],
      staff: 0,
      stem: 'down',
      name: 'alto',
    };
    const tenor: Voice = {
      events: [{ type: 'note', pitch: 'E3', dur: 'crotchet' }],
      staff: 1,
      stem: 'up',
      name: 'tenor',
    };
    const bass: Voice = {
      events: [{ type: 'note', pitch: 'C3', dur: 'crotchet' }],
      staff: 1,
      stem: 'down',
      name: 'bass',
    };

    const satb: Music = {
      clef: 'treble',
      key_sig: 'C_major',
      time_sig: '4/4',
      staves: ['treble', 'bass'],
      voices: [soprano, alto, tenor, bass],
    };

    expect(satb.staves).toEqual(['treble', 'bass']);
    expect(satb.voices.map((v) => v.name)).toEqual<VoiceName[]>([
      'soprano',
      'alto',
      'tenor',
      'bass',
    ]);
    expect(satb.voices.map((v) => v.staff)).toEqual([0, 0, 1, 1]);
    expect(satb.voices.map((v) => v.stem)).toEqual(['up', 'down', 'up', 'down']);
  });

  test('exactly one event marked highlight:true is a valid fixture', () => {
    const music: Music = {
      clef: 'bass',
      key_sig: null,
      time_sig: '4/4',
      voices: [
        {
          events: [
            { type: 'note', pitch: 'C3', dur: 'crotchet', highlight: true },
            { type: 'note', pitch: 'E3', dur: 'crotchet' },
          ],
        },
      ],
    };

    const highlighted = music.voices[0].events.filter(
      (e) => e.type !== 'barline' && e.type !== 'dynamic' && 'highlight' in e && e.highlight,
    );
    expect(highlighted).toHaveLength(1);
  });
});
