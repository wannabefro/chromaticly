import type { Music, NoteEvent } from '../../music/types';
import { musicEventUnits } from '../music-event-units';
import type { ExerciseInstance } from '../schema';
import { validate } from '../validator';
import { barUnitsFor } from './bar-math';
import { generate } from './index';
import { rescaleDots } from './metre-rewrite';

const SEEDS = Array.from({ length: 60 }, (_, i) => i);

function opts(seed: number) {
  return { grade: 5, seed, atoms: ['rewrite:simple_compound'] };
}

type Item = { pitch: string; dur: string; dots?: number };

function givenNotes(music: Music): NoteEvent[] {
  return music.voices.flatMap((v) => v.events).filter((ev): ev is NoteEvent => ev.type === 'note');
}
function perItemOf(inst: ExerciseInstance): Item[] {
  return inst.answer.per_item as Item[];
}

// --- The transform, proven directly (execution note: pin the re-valuing first) ---

describe('metre_rewrite transform — x3/2 dot toggle (the pinned mapping)', () => {
  test('to_compound adds a dot to a plain note; to_simple strips a dotted note', () => {
    expect(rescaleDots(0, 'to_compound')).toBe(1);
    expect(rescaleDots(1, 'to_simple')).toBe(0);
  });
  test('a simple-side note must be plain and a compound-side note must be dotted', () => {
    expect(() => rescaleDots(1, 'to_compound')).toThrow();
    expect(() => rescaleDots(0, 'to_simple')).toThrow();
  });
});

describe('metre_rewrite — a 2/4 bar rewrites into the equivalent 6/8 bar (values scaled, not preserved)', () => {
  test('to_compound: every answer note is the given note plus a dot; bar sums to 6/8', () => {
    const inst = SEEDS.map((s) => generate('metre_rewrite', opts(s))).find(
      (i) => i.interaction.config!.direction === 'to_compound',
    )!;
    const music = inst.stimulus.music as Music;
    expect(music.time_sig).toBe('2/4');
    expect(inst.interaction.config!.targetTimeSig).toBe('6/8');

    const given = givenNotes(music);
    const answer = perItemOf(inst);
    expect(answer).toHaveLength(given.length);
    given.forEach((g, i) => {
      // Same pitch and note NAME; the value is scaled by adding a dot — NOT the
      // same absolute duration (a crotchet becomes a dotted crotchet).
      expect(answer[i].pitch).toBe(g.pitch);
      expect(answer[i].dur).toBe(g.dur);
      expect(answer[i].dots ?? 0).toBe(1);
      expect(g.dots ?? 0).toBe(0);
    });
    // Given fills 2/4 (16 units), answer fills 6/8 (24 units) — different totals.
    expect(given.reduce((s, ev) => s + musicEventUnits(ev), 0)).toBe(barUnitsFor('2/4'));
    expect(
      answer.reduce((s, it) => s + musicEventUnits({ type: 'note', pitch: 'C4', dur: it.dur as NoteEvent['dur'], dots: it.dots as NoteEvent['dots'] }), 0),
    ).toBe(barUnitsFor('6/8'));
  });
});

describe('metre_rewrite — the reverse (6/8 -> 2/4) works', () => {
  test('to_simple: every answer note is the given note minus its dot; bar sums to 2/4', () => {
    const inst = SEEDS.map((s) => generate('metre_rewrite', opts(s))).find(
      (i) => i.interaction.config!.direction === 'to_simple',
    )!;
    const music = inst.stimulus.music as Music;
    expect(music.time_sig).toBe('6/8');
    expect(inst.interaction.config!.targetTimeSig).toBe('2/4');

    const given = givenNotes(music);
    const answer = perItemOf(inst);
    given.forEach((g, i) => {
      expect(answer[i].pitch).toBe(g.pitch);
      expect(answer[i].dur).toBe(g.dur);
      expect(g.dots ?? 0).toBe(1);
      expect(answer[i].dots ?? 0).toBe(0);
    });
    expect(
      answer.reduce((s, it) => s + musicEventUnits({ type: 'note', pitch: 'C4', dur: it.dur as NoteEvent['dur'], dots: it.dots as NoteEvent['dots'] }), 0),
    ).toBe(barUnitsFor('2/4'));
  });
});

describe('metre_rewrite — every generated instance validates, both directions reachable', () => {
  test('seeds 0-59 all validate clean', () => {
    for (const seed of SEEDS) {
      expect(validate(generate('metre_rewrite', opts(seed))).errors).toEqual([]);
    }
  });
  test('both directions appear across the seed range', () => {
    const dirs = new Set(SEEDS.map((s) => generate('metre_rewrite', opts(s)).interaction.config!.direction));
    expect(dirs.has('to_compound')).toBe(true);
    expect(dirs.has('to_simple')).toBe(true);
  });
});

describe('metre_rewrite — grading rejects a wrong-total or re-pitched answer', () => {
  test('an answer note left at the given value (wrong dot) fails validation', () => {
    const inst = SEEDS.map((s) => generate('metre_rewrite', opts(s))).find(
      (i) => i.interaction.config!.direction === 'to_compound',
    )!;
    const corrupted = JSON.parse(JSON.stringify(inst)) as ExerciseInstance;
    // Drop the dot on the first answer note — leaving it at the simple value.
    const item = (corrupted.answer.per_item as Item[])[0];
    delete item.dots;
    (corrupted.answer.canonical as Item[])[0] = item;
    expect(validate(corrupted).errors.length).toBeGreaterThan(0);
  });
  test('a re-pitched answer fails validation', () => {
    const inst = generate('metre_rewrite', opts(SEEDS.find((s) => generate('metre_rewrite', opts(s)).interaction.config!.direction === 'to_compound')!));
    const corrupted = JSON.parse(JSON.stringify(inst)) as ExerciseInstance;
    const items = corrupted.answer.per_item as Item[];
    items[0].pitch = items[0].pitch === 'C4' ? 'D4' : 'C4';
    expect(validate(corrupted).errors.length).toBeGreaterThan(0);
  });
});

describe('metre_rewrite — reproducibility + grade gating', () => {
  test('the same seed produces a deeply-equal instance', () => {
    expect(generate('metre_rewrite', opts(11))).toEqual(generate('metre_rewrite', opts(11)));
  });
  test('grade other than 5 is unsupported', () => {
    expect(() => generate('metre_rewrite', { grade: 4, seed: 0, atoms: ['rewrite:simple_compound'] })).toThrow();
  });
});
