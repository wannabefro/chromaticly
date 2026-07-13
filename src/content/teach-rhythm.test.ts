// 302.3.5: the by-ear card's rhythm is authored content, so the invariants that
// make it playable and its beat grid truthful must fail loud at import — a bar
// that doesn't add up would play as nonsense and mark the wrong beats strong.

import { assertRhythmFillsBars, beatGrid, beatsPerBar, rhythmBeats, rhythmToMusic, type TeachRhythm } from './teach-rhythm';

const twoBarsOf3: TeachRhythm = {
  timeSignature: '3/4',
  notes: ['crotchet', 'quaver', 'quaver', 'crotchet', 'minim', 'crotchet'],
};

describe('teach rhythm — metre', () => {
  test('beats per bar comes from the numerator of a Grade 1 simple time signature', () => {
    expect(beatsPerBar('2/4')).toBe(2);
    expect(beatsPerBar('3/4')).toBe(3);
    expect(beatsPerBar('4/4')).toBe(4);
  });

  test('compound and out-of-scope time signatures are rejected', () => {
    for (const sig of ['6/8', '5/4', '3/8', 'nonsense']) {
      expect(() => beatsPerBar(sig)).toThrow();
    }
  });

  test('a dotted note counts for half as much again', () => {
    expect(rhythmBeats({ timeSignature: '3/4', notes: ['dotted minim'] })).toBe(3);
    expect(rhythmBeats(twoBarsOf3)).toBe(6);
  });

  test('a rhythm that does not fill whole bars fails loud', () => {
    expect(() => assertRhythmFillsBars({ timeSignature: '3/4', notes: ['crotchet', 'crotchet'] })).toThrow();
    expect(() => assertRhythmFillsBars(twoBarsOf3)).not.toThrow();
  });
});

describe('teach rhythm — the beat grid the learner taps', () => {
  test('every bar contributes its beats, and only the first beat of each bar is strong', () => {
    const grid = beatGrid(twoBarsOf3);
    expect(grid).toHaveLength(6); // 2 bars x 3 beats
    expect(grid.filter((c) => c.strong)).toEqual([
      { bar: 1, beat: 1, strong: true },
      { bar: 2, beat: 1, strong: true },
    ]);
  });
});

describe('teach rhythm — playable Music', () => {
  test('carries the time signature and barlines each full bar, so it plays in metre', () => {
    const music = rhythmToMusic(twoBarsOf3);
    expect(music.time_sig).toBe('3/4');

    const events = music.voices[0].events;
    const barlines = events.filter((e) => e.type === 'barline');
    expect(barlines).toHaveLength(2); // one closing each bar

    // The barline lands after the notes that fill bar 1 (crotchet + 2 quavers + crotchet).
    expect(events.findIndex((e) => e.type === 'barline')).toBe(4);
    expect(events.filter((e) => e.type === 'note')).toHaveLength(6);
  });
});
