import { generate } from './index';
import { validate } from '../validator';
import { musicEventUnits } from '../music-event-units';
import { barUnitsFor } from './bar-math';
import { REST_UNITS, durationFromRestLabel } from './rest-math';
import { WRITTEN_ITEMS } from '../../learn/exercise-set';
import type { Music } from '../../music/types';

const G1_RESTS = ['rest:semibreve', 'rest:minim', 'rest:crotchet', 'rest:quaver', 'rest:semiquaver'];

function gen(grade: number, seed: number, atoms: string[]) {
  return generate('rest_completion', { grade, seed, atoms });
}

describe('rest_completion generator (chromaticly-gni)', () => {
  // THE core invariant: the answer rest exactly fills the gap the sounding notes
  // leave in the stimulus bar. Recomputed here from the rendered stimulus.
  test('answer rest length == bar total − sounding notes, every seed', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      const inst = gen(1, seed, G1_RESTS);
      const music = inst.stimulus.music as Music;
      const sounding = music.voices[0].events.reduce((s, ev) => s + musicEventUnits(ev), 0);
      const answerDur = durationFromRestLabel(inst.answer.canonical)!;
      expect(answerDur).toBeTruthy();
      expect(sounding + REST_UNITS[answerDur]).toBe(barUnitsFor(music.time_sig as string));
    }
  });

  test('every instance is validator-clean (self-consistency hook passes)', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      expect(validate(gen(1, seed, G1_RESTS))).toEqual({ ok: true, errors: [] });
    }
  });

  test('options are distinct rests, answer is among them, no distractor equals the answer', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      const inst = gen(1, seed, G1_RESTS);
      const optionKeys = Object.keys((inst.interaction.config as { option_music: Record<string, unknown> }).option_music);
      expect(optionKeys).toContain(inst.answer.canonical);
      expect(inst.distractors).not.toContain(inst.answer.canonical);
      expect(new Set(inst.distractors).size).toBe(inst.distractors.length);
    }
  });

  test('srs tag names the answer rest, drawn from the lesson atoms', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      const inst = gen(1, seed, G1_RESTS);
      expect(inst.srs_tags).toHaveLength(1);
      expect(G1_RESTS).toContain(inst.srs_tags[0]);
      expect(inst.srs_tags[0]).toBe(`rest:${durationFromRestLabel(inst.answer.canonical)}`);
    }
  });

  // KTD6 / Codex C2 — a single-atom Practice due-path must still form a valid MCQ:
  // distractors come from the grade's rest scope, not the lesson pool.
  test('a single-atom scope still yields a full, valid MCQ (due-path safe)', () => {
    const inst = gen(4, 0, ['rest:breve']);
    expect(inst.answer.canonical).toBe('breve rest');
    expect(inst.distractors.length).toBeGreaterThanOrEqual(1);
    expect(inst.distractors).not.toContain('breve rest');
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  // The breve rest (64 units) is hostable only in the generator's own big bars
  // (9/4 = 72, 12/4 = 96) — proves the KTD7 units table + time-sig policy work.
  test('the breve rest builds a valid bar (its own units table, not bar-math)', () => {
    const inst = gen(4, 0, ['rest:breve']);
    const music = inst.stimulus.music as Music;
    expect(['9/4', '12/4']).toContain(music.time_sig);
    const sounding = music.voices[0].events.reduce((s, ev) => s + musicEventUnits(ev), 0);
    expect(sounding + REST_UNITS.breve).toBe(barUnitsFor(music.time_sig as string));
  });

  test('is a pure function of (grade, seed, atoms) — determinism', () => {
    const a = gen(1, 3, G1_RESTS);
    const b = gen(1, 3, G1_RESTS);
    expect(a).toEqual(b);
  });
});
