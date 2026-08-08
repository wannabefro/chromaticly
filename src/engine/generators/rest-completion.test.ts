import { generate } from './index';
import { validate } from '../validator';
import { musicEventUnits } from '../music-event-units';
import { barUnitsFor } from './bar-math';
import { REST_UNITS, dottedRestsInScope, parseRestLabel, restLabel, restUnits } from './rest-math';
import { scopeForGrade } from '../scope';
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
      const answerRest = parseRestLabel(inst.answer.canonical)!;
      expect(answerRest).toBeTruthy();
      expect(sounding + restUnits(answerRest)).toBe(barUnitsFor(music.time_sig as string));
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
      expect(inst.srs_tags[0]).toBe(`rest:${parseRestLabel(inst.answer.canonical)!.dur}`);
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

// chromaticly-7xv.3. GRADE_2_SCOPE.rhythmDevices has carried 'dotted_rests'
// since it was written, and no generator ever drew one — so the dot on a rest
// was in scope at four grades and assessed at none. G4 item 1 ("Double-dotted
// notes and rests") is the same gap one dot further on.
describe('dotted rests (chromaticly-7xv.3)', () => {
  test('a dotted answer still fills the bar exactly — 1.5x, not 1x', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      const inst = gen(3, seed, ['rest:dotted_minim']);
      const music = inst.stimulus.music as Music;
      const sounding = music.voices[0].events.reduce((s, ev) => s + musicEventUnits(ev), 0);
      expect(inst.answer.canonical).toBe('dotted minim rest');
      expect(sounding + 24).toBe(barUnitsFor(music.time_sig as string));
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });

  test('a double-dotted answer is 1.75x, and the validator agrees', () => {
    const inst = gen(4, 0, ['rest:double_dotted_minim']);
    expect(restUnits({ dur: 'minim', dots: 2 })).toBe(28);
    expect(inst.srs_tags).toEqual(['rest:double_dotted_minim']);
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  // The dot is what the learner drops, so the plain twin has to be on screen.
  test('a dotted answer offers its own undotted twin as a distractor option', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      for (const d of gen(3, seed, ['rest:dotted_crotchet']).distractors) seen.add(d);
    }
    expect(seen).toContain('crotchet rest');
  });

  // The boundary itself, not a value near it: one dot needs 2 units and two dots
  // need 4, because a half-unit rest can fill no gap bar-math can express.
  test('the dot is refused exactly where the halved value stops being whole', () => {
    const g4 = scopeForGrade(4);
    const dotted = dottedRestsInScope(g4.rests, g4.rhythmDevices);
    expect(dotted).toContainEqual({ dur: 'semiquaver', dots: 1 });
    expect(dotted).not.toContainEqual({ dur: 'demisemiquaver', dots: 1 });
    expect(dotted).toContainEqual({ dur: 'quaver', dots: 2 });
    expect(dotted).not.toContainEqual({ dur: 'semiquaver', dots: 2 });
  });

  // Each device gates on its own, so neither term of the check is dead.
  test('one dot opens at Grade 2 and two dots at Grade 4, separately', () => {
    const has = (grade: number, dots: 1 | 2) => {
      const s = scopeForGrade(grade);
      return dottedRestsInScope(s.rests, s.rhythmDevices).some((r) => r.dots === dots);
    };
    expect([has(1, 1), has(2, 1)]).toEqual([false, true]);
    expect([has(3, 2), has(4, 2)]).toEqual([false, true]);
  });

  test('the label round-trips, dots and all', () => {
    for (const dots of [0, 1, 2] as const) {
      expect(parseRestLabel(restLabel('minim', dots))).toEqual({ dur: 'minim', dots });
    }
    expect(parseRestLabel('minim')).toBeNull();
    expect(parseRestLabel('triple-dotted minim rest')).toBeNull();
  });
});
