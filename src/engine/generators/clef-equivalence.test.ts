import type { Clef, Music, NoteEvent } from '../../music/types';
import type { ExerciseInstance } from '../schema';
import { validate } from '../validator';
import { generate } from './index';

// chromaticly-ra3 — clef_equivalence: rewrite a melody in a different clef at
// the SAME octave. The whole skill lives in one invariant: the answer pitches
// equal the source pitches (delta 0), only the clef changes. An octave-shifted
// per_item is the misconception the validator's clefEquivalenceHook must reject.

const SEEDS = Array.from({ length: 40 }, (_, i) => i);
const ATOMS = ['clef_equiv:cross'];

function opts(seed: number) {
  return { grade: 4, seed, atoms: ATOMS };
}

function naturalOf(pitch: string): string {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`clef-equivalence.test: not a scientific pitch "${pitch}"`);
  return `${m[1]}${m[3]}`;
}

function sourceNotes(music: Music): NoteEvent[] {
  return music.voices.flatMap((v) => v.events).filter((ev): ev is NoteEvent => ev.type === 'note');
}

type PerItem = { pitch: string; dur: string; dots?: number };

describe('clef_equivalence generator (chromaticly-ra3)', () => {
  test('every seed validates clean, on a different answer clef from the stimulus', () => {
    for (const seed of SEEDS) {
      const inst = generate('clef_equivalence', opts(seed));
      expect(inst.template_id).toBe('clef_equivalence');
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
      const givenClef = (inst.stimulus.music as Music).clef;
      const answerClef = (inst.interaction.config as { answerClef: Clef }).answerClef;
      expect(answerClef).not.toBe(givenClef);
    }
  });

  test('per_item is the SAME pitch as the source, note for note (delta 0 — no octave shift)', () => {
    for (const seed of SEEDS) {
      const inst = generate('clef_equivalence', opts(seed));
      const src = sourceNotes(inst.stimulus.music as Music);
      const perItem = inst.answer.per_item as PerItem[];
      expect(perItem).toHaveLength(src.length);
      src.forEach((n, i) => {
        // Same sounding pitch (natural-letter + octave identical), same rhythm.
        expect(naturalOf(perItem[i].pitch)).toBe(naturalOf(n.pitch));
        expect(perItem[i].dur).toBe(n.dur);
        expect(perItem[i].dots ?? 0).toBe(n.dots ?? 0);
      });
    }
  });

  test('all three clefs appear as both given and answer across the seed sweep', () => {
    const given = new Set<Clef>();
    const answer = new Set<Clef>();
    for (const seed of SEEDS) {
      const inst = generate('clef_equivalence', opts(seed));
      given.add((inst.stimulus.music as Music).clef);
      answer.add((inst.interaction.config as { answerClef: Clef }).answerClef);
    }
    for (const clef of ['treble', 'alto', 'bass'] as const) {
      expect(given.has(clef)).toBe(true);
      expect(answer.has(clef)).toBe(true);
    }
  });

  test('the validator rejects an octave-shifted per_item — the exact misconception', () => {
    const inst = generate('clef_equivalence', opts(0));
    const perItem = (inst.answer.per_item as PerItem[]).map((p) => ({ ...p }));
    // Bump the first target up an octave: same letter, wrong octave.
    const m = /^([A-G])(#|b)?(-?\d+)$/.exec(perItem[0].pitch)!;
    const shifted = { ...inst, answer: { ...inst.answer, per_item: [{ ...perItem[0], pitch: `${m[1]}${m[2] ?? ''}${Number(m[3]) + 1}` }, ...perItem.slice(1)] } };
    const result = validate(shifted as ExerciseInstance);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/clef_equivalence.*same-pitch target/);
  });

  test('throws below grade 4 (generator-level gate)', () => {
    expect(() => generate('clef_equivalence', { grade: 3, seed: 0, atoms: ATOMS })).toThrow();
  });
});
