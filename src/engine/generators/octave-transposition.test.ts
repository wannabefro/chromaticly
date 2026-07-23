import type { Music, MusicEvent, NoteEvent } from '../../music/types';
import { comfortablePitchRange } from '../scope';
import type { ExerciseInstance } from '../schema';
import { validate } from '../validator';
import { barUnitsFor } from './bar-math';
import { generate } from './index';
import { spellInKeySig } from './key-spelling';
import { naturalPitchStepsAbove, scientificPitchOrdinal } from './pitch-math';

const SEEDS = Array.from({ length: 40 }, (_, i) => i);
const ATOMS = ['transpose:octave'];

function opts(seed: number) {
  return { grade: 3, seed, atoms: ATOMS };
}

function naturalOf(pitch: string): string {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`octave-transposition.test: not a scientific pitch "${pitch}"`);
  return `${m[1]}${m[3]}`;
}

type PerItem = { pitch: string; dur: string; dots?: number };

function sourceNotes(music: Music): NoteEvent[] {
  return music.voices.flatMap((v) => v.events).filter((ev): ev is NoteEvent => ev.type === 'note');
}

function perItemOf(instance: ExerciseInstance): PerItem[] {
  return instance.answer.per_item as PerItem[];
}

// Independent frozen unit table (mirrors anacrusis-recognition.test.ts's own
// discipline — not derived from music-event-units.ts's musicEventUnits).
const UNITS: Record<string, number> = {
  semibreve: 32,
  minim: 16,
  crotchet: 8,
  quaver: 4,
  semiquaver: 2,
  demisemiquaver: 1,
};

function eventUnits(ev: MusicEvent): number {
  if (ev.type !== 'note' && ev.type !== 'chord' && ev.type !== 'rest') return 0;
  const dots = ev.dots ?? 0;
  return UNITS[ev.dur as string] * (dots === 2 ? 1.75 : dots === 1 ? 1.5 : 1);
}

function barGroups(music: Music): MusicEvent[][] {
  const groups: MusicEvent[][] = [[]];
  for (const ev of music.voices[0].events) {
    if (ev.type === 'barline') groups.push([]);
    else groups[groups.length - 1].push(ev);
  }
  return groups.filter((g) => g.length > 0);
}

describe('octaveTransposition — reproducibility (KTD4: pure function of seed)', () => {
  test('the same seed produces a deeply-equal instance', () => {
    expect(generate('octave_transposition', opts(5))).toEqual(generate('octave_transposition', opts(5)));
  });

  test('different seeds produce different instances', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) seen.add(JSON.stringify(generate('octave_transposition', opts(seed))));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('octaveTransposition — the answer stave is the OPPOSITE clef of the given (D1)', () => {
  test.each(SEEDS)('seed %i: answerClef !== given clef, and direction is coupled to the given clef', (seed) => {
    const instance = generate('octave_transposition', opts(seed));
    const music = instance.stimulus.music as Music;
    const config = instance.interaction.config as { answerClef: string; direction: string };
    expect(config.answerClef).not.toBe(music.clef);
    expect(['treble', 'bass']).toContain(config.answerClef);
    expect(config.direction).toBe(music.clef === 'treble' ? 'down' : 'up');
  });
});

describe('octaveTransposition — target is the SAME letter, exactly one octave (7 diatonic steps) away — never a 7th', () => {
  test.each(SEEDS)('seed %i', (seed) => {
    const instance = generate('octave_transposition', opts(seed));
    const music = instance.stimulus.music as Music;
    const sources = sourceNotes(music);
    const perItem = perItemOf(instance);
    const delta = (instance.interaction.config as { direction: string }).direction === 'down' ? -7 : 7;

    expect(perItem).toHaveLength(sources.length);
    sources.forEach((source, i) => {
      const sourceNatural = naturalOf(source.pitch);
      const targetNatural = naturalOf(perItem[i].pitch);
      expect(targetNatural[0]).toBe(sourceNatural[0]); // same letter name
      expect(scientificPitchOrdinal(targetNatural) - scientificPitchOrdinal(sourceNatural)).toBe(delta);
    });
  });
});

describe('octaveTransposition — rhythm (dur AND dots) is copied note-for-note (Codex finding 1)', () => {
  test.each(SEEDS)('seed %i', (seed) => {
    const instance = generate('octave_transposition', opts(seed));
    const music = instance.stimulus.music as Music;
    const sources = sourceNotes(music);
    const perItem = perItemOf(instance);
    sources.forEach((source, i) => {
      expect(perItem[i].dur).toBe(source.dur);
      expect(perItem[i].dots ?? 0).toBe(source.dots ?? 0);
    });
  });

  test('at least one seed in the sweep carries a dotted note through unchanged (the dots field actually gets exercised)', () => {
    const dotted = SEEDS.map((seed) => generate('octave_transposition', opts(seed))).some((instance) =>
      sourceNotes(instance.stimulus.music as Music).some((ev) => (ev.dots ?? 0) > 0),
    );
    expect(dotted).toBe(true);
  });
});

describe('octaveTransposition — both endpoints stay within their own clef\'s comfortable range (D8)', () => {
  test.each(SEEDS)('seed %i', (seed) => {
    const instance = generate('octave_transposition', opts(seed));
    const music = instance.stimulus.music as Music;
    const config = instance.interaction.config as { answerClef: 'treble' | 'bass' };
    const givenRange = comfortablePitchRange(music.clef, 3);
    const answerRange = comfortablePitchRange(config.answerClef, 3);
    const givenLow = scientificPitchOrdinal(givenRange.low);
    const givenHigh = scientificPitchOrdinal(givenRange.high);
    const answerLow = scientificPitchOrdinal(answerRange.low);
    const answerHigh = scientificPitchOrdinal(answerRange.high);

    for (const source of sourceNotes(music)) {
      const ord = scientificPitchOrdinal(naturalOf(source.pitch));
      expect(ord).toBeGreaterThanOrEqual(givenLow);
      expect(ord).toBeLessThanOrEqual(givenHigh);
    }
    for (const item of perItemOf(instance)) {
      const ord = scientificPitchOrdinal(naturalOf(item.pitch));
      expect(ord).toBeGreaterThanOrEqual(answerLow);
      expect(ord).toBeLessThanOrEqual(answerHigh);
    }
  });
});

describe('octaveTransposition — bars are metrically full (2 bars, each summing to the time signature)', () => {
  test.each(SEEDS)('seed %i', (seed) => {
    const instance = generate('octave_transposition', opts(seed));
    const music = instance.stimulus.music as Music;
    const barUnits = barUnitsFor(music.time_sig as string);
    const groups = barGroups(music);
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group.reduce((sum, ev) => sum + eventUnits(ev), 0)).toBe(barUnits);
    }
  });

  test.each(SEEDS)('seed %i: 3-6 notes total across the 2 bars (D8)', (seed) => {
    const instance = generate('octave_transposition', opts(seed));
    const count = sourceNotes(instance.stimulus.music as Music).length;
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(6);
  });
});

describe('octaveTransposition — spelling follows the key signature (spellInKeySig, Codex finding 2)', () => {
  test('reaches a sharp key (e.g. G/D/A/E major) and a flat key (e.g. F/Bb/Eb/Ab major) across the seed sweep', () => {
    const FLAT_TONICS = new Set(['F', 'Bb', 'Eb', 'Ab']);
    const SHARP_TONICS = new Set(['G', 'D', 'A', 'E']);
    let sawFlat = false;
    let sawSharp = false;
    for (const seed of SEEDS) {
      const instance = generate('octave_transposition', opts(seed));
      const tonic = (instance.stimulus.music as Music).key_sig!.split('_')[0];
      if (FLAT_TONICS.has(tonic)) sawFlat = true;
      if (SHARP_TONICS.has(tonic)) sawSharp = true;
    }
    expect(sawFlat).toBe(true);
    expect(sawSharp).toBe(true);
  });

  test.each(SEEDS)('seed %i: every spelled pitch matches spellInKeySig(natural, key_sig) exactly — no stray accidental/natural', (seed) => {
    const instance = generate('octave_transposition', opts(seed));
    const music = instance.stimulus.music as Music;
    const keySig = music.key_sig as string;
    for (const source of sourceNotes(music)) {
      expect(source.pitch).toBe(spellInKeySig(naturalOf(source.pitch), keySig));
    }
    for (const item of perItemOf(instance)) {
      expect(item.pitch).toBe(spellInKeySig(naturalOf(item.pitch), keySig));
    }
  });

  // Codex finding 8: the diatonic ordinal system increments octave between B
  // and C (pitchOrdinal = octave*7 + letterIndex, LETTERS starting at C) —
  // the same place scientific pitch notation itself changes octave. A B/C
  // boundary source must still land exactly 7 steps away on the SAME letter,
  // not slip to the neighbouring letter.
  test('a B/C octave-boundary source (letter B or C) still transposes to the same letter, one octave away', () => {
    let sawBoundary = false;
    for (const seed of SEEDS) {
      const instance = generate('octave_transposition', opts(seed));
      const music = instance.stimulus.music as Music;
      const perItem = perItemOf(instance);
      sourceNotes(music).forEach((source, i) => {
        const letter = naturalOf(source.pitch)[0];
        if (letter !== 'B' && letter !== 'C') return;
        sawBoundary = true;
        const targetNatural = naturalOf(perItem[i].pitch);
        expect(targetNatural[0]).toBe(letter);
      });
    }
    expect(sawBoundary).toBe(true);
  });
});

describe('octaveTransposition — srs_tags and interaction shape', () => {
  test.each(SEEDS)('seed %i emits the transpose:octave atom and a transposition_input interaction', (seed) => {
    const instance = generate('octave_transposition', opts(seed));
    expect(instance.srs_tags).toEqual(['transpose:octave']);
    expect(instance.interaction.type).toBe('transposition_input');
    expect(instance.strand).toBe('pitch');
  });

  test.each(SEEDS)('seed %i: answer.canonical equals answer.per_item (whole-answer semantic value)', (seed) => {
    const instance = generate('octave_transposition', opts(seed));
    expect(instance.answer.canonical).toEqual(instance.answer.per_item);
  });
});

describe('octaveTransposition — fuzz gate: validator-clean across a wide seed sweep', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = generate('octave_transposition', opts(seed));
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
    }
  });
});

// The validator hook independently RECOMPUTES the target (Codex findings 1/2)
// rather than trusting per_item — these hand-corrupt a real generated
// instance to prove the hook actually catches each named misconception,
// not just malformed shapes.
describe('octaveTransposition — validator hook rejects a corrupted per_item', () => {
  function realInstance(): ExerciseInstance {
    return JSON.parse(JSON.stringify(generate('octave_transposition', opts(1)))) as ExerciseInstance;
  }

  test('rejects a target that is a 7th (6 diatonic steps), not an octave, away from the source', () => {
    const instance = realInstance();
    const music = instance.stimulus.music as Music;
    const config = instance.interaction.config as { direction: string };
    const delta = config.direction === 'down' ? -6 : 6; // one step short of the octave
    const source = sourceNotes(music)[0];
    const perItem = perItemOf(instance);
    perItem[0] = { ...perItem[0], pitch: spellInKeySig(naturalPitchStepsAbove(naturalOf(source.pitch), delta), music.key_sig as string) };
    instance.answer.per_item = perItem;
    instance.answer.canonical = perItem;

    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('7th'))).toBe(true);
  });

  test('rejects a target whose duration/dots do not match the copied source rhythm', () => {
    const instance = realInstance();
    const perItem = perItemOf(instance);
    perItem[0] = { ...perItem[0], dur: perItem[0].dur === 'crotchet' ? 'minim' : 'crotchet' };
    instance.answer.per_item = perItem;
    instance.answer.canonical = perItem;

    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('does not match the source rhythm'))).toBe(true);
  });

  test('rejects an answerClef that matches the given clef (same-clef octave is not this template, D1)', () => {
    const instance = realInstance();
    const music = instance.stimulus.music as Music;
    (instance.interaction.config as { answerClef: string }).answerClef = music.clef;

    const result = validate(instance);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('different from the given clef'))).toBe(true);
  });

  test('rejects a direction that does not match the given clef (D1: coupled, not free)', () => {
    const instance = realInstance();
    const config = instance.interaction.config as { direction: string };
    config.direction = config.direction === 'down' ? 'up' : 'down';

    const result = validate(instance);
    expect(result.ok).toBe(false);
  });
});

// fyu.5 — grade 4 always pairs alto (the new skill) with treble or bass;
// grade 3 stays treble<->bass exactly as before (proven byte-identical by
// the seed-stability pin, not re-asserted here).
const GRADE4_SEEDS = Array.from({ length: 80 }, (_, i) => i);

function opts4(seed: number) {
  return { grade: 4, seed, atoms: ATOMS };
}

const CLEF_RANK: Record<string, number> = { treble: 2, alto: 1, bass: 0 };

describe('octaveTransposition — grade 4 always pairs alto with another clef (fyu.5)', () => {
  test.each(GRADE4_SEEDS)('seed %i: the clef pair always includes alto', (seed) => {
    const instance = generate('octave_transposition', opts4(seed));
    const music = instance.stimulus.music as Music;
    const config = instance.interaction.config as { answerClef: string };
    expect([music.clef, config.answerClef]).toContain('alto');
  });

  test.each(GRADE4_SEEDS)('seed %i: direction follows the CLEF_RANK (pitch-height) rule, not a treble/bass binary', (seed) => {
    const instance = generate('octave_transposition', opts4(seed));
    const music = instance.stimulus.music as Music;
    const config = instance.interaction.config as { answerClef: string; direction: string };
    const expectedDirection = CLEF_RANK[config.answerClef] < CLEF_RANK[music.clef] ? 'down' : 'up';
    expect(config.direction).toBe(expectedDirection);
  });

  test('every clef pair direction (treble->alto down, alto->bass down, alto->treble up, bass->alto up) is exercised across the seed sweep', () => {
    const seen: Record<string, boolean> = {};
    for (const seed of GRADE4_SEEDS) {
      const instance = generate('octave_transposition', opts4(seed));
      const music = instance.stimulus.music as Music;
      const config = instance.interaction.config as { answerClef: string; direction: string };
      const key = `${music.clef}->${config.answerClef}`;
      seen[key] = true;
      if (key === 'treble->alto' || key === 'alto->bass') expect(config.direction).toBe('down');
      if (key === 'alto->treble' || key === 'bass->alto') expect(config.direction).toBe('up');
    }
    expect(seen['treble->alto']).toBe(true);
    expect(seen['alto->bass']).toBe(true);
    expect(seen['alto->treble']).toBe(true);
    expect(seen['bass->alto']).toBe(true);
  });

  test('seeds 0..99 all produce a validator-clean instance at grade 4', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = generate('octave_transposition', opts4(seed));
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('octaveTransposition — grade 3 is unaffected by the grade-4 alto widening', () => {
  test.each(SEEDS)('seed %i: grade 3 never draws alto for either clef', (seed) => {
    const instance = generate('octave_transposition', opts(seed));
    const music = instance.stimulus.music as Music;
    const config = instance.interaction.config as { answerClef: string };
    expect(music.clef).not.toBe('alto');
    expect(config.answerClef).not.toBe('alto');
  });
});
