// 302.3.5/302.3.7: the by-ear card's rhythm is authored content, so the
// invariants that make it playable and its beat grid truthful must fail loud
// at import — a bar that doesn't add up would play as nonsense and mark the
// wrong beats strong. 302.3.7 (D11) extends this to Grade 3 compound time
// (6/8, 9/8, 12/8) while /4 behaviour stays byte-identical (characterization
// tests below).

import { musicToAbc } from '../music/abc-emitter';
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

  // Crotchet-equivalent fill units (D11), NOT the dotted-crotchet beat count —
  // a 6/8 bar holds 3 crotchets' worth, 9/8 holds 4.5 (the non-integer total
  // the module's existing crotchet unit basis represents exactly), 12/8 holds 6.
  test('compound time signatures resolve to their crotchet-equivalent total', () => {
    expect(beatsPerBar('6/8')).toBe(3);
    expect(beatsPerBar('9/8')).toBe(4.5);
    expect(beatsPerBar('12/8')).toBe(6);
  });

  test('out-of-scope time signatures are still rejected', () => {
    for (const sig of ['5/4', '3/8', '2/8', '7/8', 'nonsense']) {
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

  // The beat total alone is not enough: three minims in 3/4 add up to two bars'
  // worth, but the first bar would hold four beats — barred wrong, and the beat
  // grid would mark beats the learner never hears.
  test('a note that straddles a barline fails loud even when the total adds up', () => {
    const straddles: TeachRhythm = { timeSignature: '3/4', notes: ['minim', 'minim', 'minim'] };
    expect(rhythmBeats(straddles) % beatsPerBar('3/4')).toBe(0);
    expect(() => assertRhythmFillsBars(straddles)).toThrow(/straddles a barline/);
  });

  // The knowledge base is wider than the grade, so a teach rhythm could otherwise
  // play a note value the learner has never been taught.
  test('note values outside Grade 1 are rejected', () => {
    expect(() => rhythmBeats({ timeSignature: '4/4', notes: ['breve'] })).toThrow(/outside the Grade 1/);
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

// D11 characterization: pins the CURRENT /4 behaviour (grid shape, Music shape,
// error text) against the compound-time generalization above — this is the test
// that fails if the split of beatsPerBar/beatCellsPerBar ever regresses simple
// time, which must stay byte-identical.
describe('teach rhythm — /4 characterization (frozen by D11)', () => {
  test('beatGrid for 3/4 is unchanged: one cell per crotchet beat, cell 1 strong', () => {
    expect(beatGrid(twoBarsOf3)).toEqual([
      { bar: 1, beat: 1, strong: true },
      { bar: 1, beat: 2, strong: false },
      { bar: 1, beat: 3, strong: false },
      { bar: 2, beat: 1, strong: true },
      { bar: 2, beat: 2, strong: false },
      { bar: 2, beat: 3, strong: false },
    ]);
  });

  test('rhythmToMusic for 3/4 is unchanged: same event shape, no time_sig_hidden', () => {
    const music = rhythmToMusic(twoBarsOf3);
    expect(music).toEqual({
      clef: 'treble',
      key_sig: null,
      time_sig: '3/4',
      voices: [{
        events: [
          { type: 'note', pitch: 'B4', dur: 'crotchet' },
          { type: 'note', pitch: 'B4', dur: 'quaver' },
          { type: 'note', pitch: 'B4', dur: 'quaver' },
          { type: 'note', pitch: 'B4', dur: 'crotchet' },
          { type: 'barline', style: 'single' },
          { type: 'note', pitch: 'B4', dur: 'minim' },
          { type: 'note', pitch: 'B4', dur: 'crotchet' },
          { type: 'barline', style: 'single' },
        ],
      }],
    });
  });

  test('error text for invalid /4 signatures and fill/straddle failures is unchanged', () => {
    expect(() => beatsPerBar('5/4')).toThrow('teach rhythm: "5/4" is not a Grade 1 simple time signature');
    expect(() => assertRhythmFillsBars({ timeSignature: '3/4', notes: ['crotchet', 'crotchet'] })).toThrow(
      'teach rhythm: 2 beats does not fill whole bars of 3/4 (3 per bar)',
    );
    expect(() => assertRhythmFillsBars({ timeSignature: '3/4', notes: ['minim', 'minim', 'minim'] })).toThrow(
      'teach rhythm: "minim" straddles a barline of 3/4 (starts at beat 3)',
    );
  });
});

describe('teach rhythm — compound time (D11)', () => {
  const sixEight: TeachRhythm = {
    timeSignature: '6/8',
    notes: [
      'quaver', 'quaver', 'quaver', 'dotted crotchet',
      'dotted crotchet', 'quaver', 'quaver', 'quaver',
    ],
  };

  test('a 6/8 rhythm that fills whole bars validates', () => {
    expect(() => assertRhythmFillsBars(sixEight)).not.toThrow();
  });

  test('an underfull 6/8 bar (5 quavers) fails loud', () => {
    const underfull: TeachRhythm = { timeSignature: '6/8', notes: ['quaver', 'quaver', 'quaver', 'quaver', 'quaver'] };
    expect(() => assertRhythmFillsBars(underfull)).toThrow(/does not fill whole bars/);
  });

  test('a note straddling a compound barline fails loud even when the total adds up', () => {
    // crotchet + crotchet + minim + crotchet + crotchet = 6 crotchets = exactly
    // two 6/8 bars (3 each) — the total is correct, but the minim starts at
    // crotchet-beat 2 of bar 1 and ends at crotchet-beat 1 of bar 2.
    const straddles: TeachRhythm = { timeSignature: '6/8', notes: ['crotchet', 'crotchet', 'minim', 'crotchet', 'crotchet'] };
    expect(rhythmBeats(straddles) % beatsPerBar('6/8')).toBe(0);
    expect(() => assertRhythmFillsBars(straddles)).toThrow(/straddles a barline/);
  });

  test('beatGrid taps dotted-crotchet BEAT cells, not quaver count: 6/8 has 2 per bar', () => {
    const grid = beatGrid(sixEight);
    expect(grid).toHaveLength(4); // 2 bars x 2 cells
    expect(grid).toEqual([
      { bar: 1, beat: 1, strong: true },
      { bar: 1, beat: 2, strong: false },
      { bar: 2, beat: 1, strong: true },
      { bar: 2, beat: 2, strong: false },
    ]);
  });

  test('9/8 has 3 cells per bar, 12/8 has 4', () => {
    const nineEight: TeachRhythm = { timeSignature: '9/8', notes: ['dotted crotchet', 'dotted crotchet', 'dotted crotchet'] };
    expect(beatGrid(nineEight).filter((c) => c.bar === 1)).toHaveLength(3);

    const twelveEight: TeachRhythm = {
      timeSignature: '12/8',
      notes: ['dotted crotchet', 'dotted crotchet', 'dotted crotchet', 'dotted crotchet'],
    };
    expect(beatGrid(twelveEight).filter((c) => c.bar === 1)).toHaveLength(4);
  });

  test('rhythmToMusic for a compound rhythm carries the true time signature and bars at crotchet-total boundaries', () => {
    const music = rhythmToMusic(sixEight);
    expect(music.time_sig).toBe('6/8');
    expect(music.time_sig_hidden).toBeUndefined();

    const events = music.voices[0].events;
    const barlineIndices = events.reduce<number[]>((acc, e, i) => (e.type === 'barline' ? [...acc, i] : acc), []);
    // Bar 1 is 3 quavers + 1 dotted crotchet = 4 events before its barline.
    expect(barlineIndices).toEqual([4, 9]);
    expect(events.filter((e) => e.type === 'note')).toHaveLength(8);
  });

  test('the emitted abc beams a 6/8 bar in threes (3+3), not in crotchet pairs', () => {
    const abc = musicToAbc(rhythmToMusic(sixEight));
    expect(abc).toContain('M:6/8');
    // Three quavers glued into one beam group ("B4B4B4", no spaces — abcjs beams
    // by adjacency), then the dotted crotchet stands alone as its own beat, and
    // the same shape repeats for bar 2 — the 3+3 grouping the design fact depends
    // on, not the 2+2+2 a crotchet-beat reading of the same bar would produce.
    expect(abc).toContain('B4B4B4 B12 | B12 B4B4B4 |');
  });
});
