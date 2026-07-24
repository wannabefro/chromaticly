import type { Music, NoteEvent } from '../../music/types';
import { INSTRUMENT_TRANSPOSITIONS } from '../atoms';
import { comfortablePitchRange } from '../scope';
import type { ExerciseInstance } from '../schema';
import { validate } from '../validator';
import { generate } from './index';
import { spellInKeySig } from './key-spelling';
import { naturalPitchStepsAbove, scientificPitchOrdinal } from './pitch-math';

const SEEDS = Array.from({ length: 60 }, (_, i) => i);

function optsFor(code: string, seed: number) {
  return { grade: 5, seed, atoms: [`transpose_instrument:${code}`] };
}

function naturalOf(pitch: string): string {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`transposing-instrument.test: not a scientific pitch "${pitch}"`);
  return `${m[1]}${m[3]}`;
}

type PerItem = { pitch: string; dur: string; dots?: number };

function sourceNotes(music: Music): NoteEvent[] {
  return music.voices.flatMap((v) => v.events).filter((ev): ev is NoteEvent => ev.type === 'note');
}

function perItemOf(instance: ExerciseInstance): PerItem[] {
  return instance.answer.per_item as PerItem[];
}

const CODES = ['bb', 'a', 'f'] as const;

describe('transposingInstrument — reproducibility', () => {
  test('the same seed produces a deeply-equal instance', () => {
    for (const code of CODES) {
      const a = generate('transposing_instrument', optsFor(code, 7));
      const b = generate('transposing_instrument', optsFor(code, 7));
      expect(a).toEqual(b);
    }
  });
});

describe('transposingInstrument — every generated instance validates', () => {
  test.each(CODES)('instrument %s: all seeds produce valid instances', (code) => {
    for (const seed of SEEDS) {
      const inst = generate('transposing_instrument', optsFor(code, seed));
      expect(validate(inst).errors).toEqual([]);
    }
  });
});

describe('transposingInstrument — the written line is the concert line up the instrument interval', () => {
  test.each(CODES)('instrument %s: per_item = concert natural + letterSteps, spelled in the written key', (code) => {
    const spec = INSTRUMENT_TRANSPOSITIONS[code];
    for (const seed of SEEDS) {
      const inst = generate('transposing_instrument', optsFor(code, seed));
      const music = inst.stimulus.music as Music;
      const concert = music.key_sig!.replace(/_major$/, '');
      const pair = spec.keys.find((k) => k.concert === concert)!;
      const writtenKeySig = `${pair.written}_major`;

      // config agrees with the recomputed transposed key (rendering + grading
      // read config.answerKeySig).
      expect(inst.interaction.config?.answerKeySig).toBe(writtenKeySig);
      expect(inst.interaction.config?.answerClef).toBe('treble');
      expect(inst.interaction.config?.direction).toBe('up');

      const notes = sourceNotes(music);
      const perItem = perItemOf(inst);
      expect(perItem).toHaveLength(notes.length);
      notes.forEach((note, i) => {
        const expected = spellInKeySig(naturalPitchStepsAbove(naturalOf(note.pitch), spec.letterSteps), writtenKeySig);
        expect(perItem[i].pitch).toBe(expected);
        // Rhythm is copied note-for-note, dur and dots.
        expect(perItem[i].dur).toBe(note.dur);
        expect(perItem[i].dots ?? 0).toBe(note.dots ?? 0);
      });
    }
  });
});

describe('transposingInstrument — key signatures and interval labels are the ABRSM mappings', () => {
  test('B♭ clarinet writes up a M2 (concert C -> D)', () => {
    const spec = INSTRUMENT_TRANSPOSITIONS.bb;
    expect(spec.letterSteps).toBe(1);
    expect(spec.intervalName).toBe('major 2nd');
    expect(spec.keys.find((k) => k.concert === 'C')?.written).toBe('D');
  });
  test('A clarinet writes up a m3 (concert C -> Eb)', () => {
    const spec = INSTRUMENT_TRANSPOSITIONS.a;
    expect(spec.letterSteps).toBe(2);
    expect(spec.intervalName).toBe('minor 3rd');
    expect(spec.keys.find((k) => k.concert === 'C')?.written).toBe('Eb');
  });
  test('horn in F writes up a P5 (concert C -> G)', () => {
    const spec = INSTRUMENT_TRANSPOSITIONS.f;
    expect(spec.letterSteps).toBe(4);
    expect(spec.intervalName).toBe('perfect 5th');
    expect(spec.keys.find((k) => k.concert === 'C')?.written).toBe('G');
  });
});

describe('transposingInstrument — written pitches stay in the treble answer range', () => {
  test.each(CODES)('instrument %s: every written pitch is within the treble comfortable range', (code) => {
    const range = comfortablePitchRange('treble', 5);
    const low = scientificPitchOrdinal(range.low);
    const high = scientificPitchOrdinal(range.high);
    for (const seed of SEEDS) {
      const inst = generate('transposing_instrument', optsFor(code, seed));
      for (const item of perItemOf(inst)) {
        const ord = scientificPitchOrdinal(naturalOf(item.pitch));
        expect(ord).toBeGreaterThanOrEqual(low);
        expect(ord).toBeLessThanOrEqual(high);
      }
    }
  });
});

describe('transposingInstrument — a per_item written at concert pitch is rejected (the core misconception)', () => {
  test('replacing the written line with the concert line fails validation', () => {
    const inst = generate('transposing_instrument', optsFor('bb', 0));
    const music = inst.stimulus.music as Music;
    const concertNotes = sourceNotes(music);
    // Corrupt: write the notes at concert pitch (forgot to transpose).
    const corrupted: ExerciseInstance = {
      ...inst,
      answer: {
        ...inst.answer,
        per_item: concertNotes.map((n) => ({ pitch: n.pitch, dur: n.dur, ...(n.dots ? { dots: n.dots } : {}) })),
        canonical: concertNotes.map((n) => ({ pitch: n.pitch, dur: n.dur, ...(n.dots ? { dots: n.dots } : {}) })),
      },
    };
    expect(validate(corrupted).errors.length).toBeGreaterThan(0);
  });
});

describe('transposingInstrument — unknown instrument atom fails loud', () => {
  test('an unknown instrument code throws', () => {
    expect(() => generate('transposing_instrument', { grade: 5, seed: 0, atoms: ['transpose_instrument:eb'] })).toThrow();
  });
  test('grade other than 5 is unsupported', () => {
    expect(() => generate('transposing_instrument', { grade: 4, seed: 0, atoms: ['transpose_instrument:bb'] })).toThrow();
  });
});
