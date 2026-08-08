// chromaticly-51o. The exam asks candidates to ADD bar-lines to a rhythm, and
// nothing implemented the template that had been specced for it.

import { generate } from './index';
import { validate } from '../validator';
import { WRITTEN_ITEMS } from '../../learn/exercise-set';
import { BARS, barlinePositions } from './add-barlines';
import { barUnitsFor } from './bar-math';
import type { ExerciseInstance } from '../schema';
import type { Music } from '../../music/types';

const SIGS = ['2/4', '3/4', '4/4'];
const ATOMS = SIGS.map((s) => `add_barlines:${s}`);

function gen(seed: number, atoms: string[] = ATOMS): ExerciseInstance {
  return generate('add_barlines', { grade: 1, seed, atoms });
}

const UNITS: Record<string, number> = { demisemiquaver: 1, semiquaver: 2, quaver: 4, crotchet: 8, minim: 16, semibreve: 32 };

/** Cumulative units after each note, read back off the rendered rhythm. */
function runningUnits(inst: ExerciseInstance): number[] {
  const events = (inst.stimulus.music as Music).voices[0].events.filter((ev) => ev.type === 'note');
  const out: number[] = [];
  let at = 0;
  for (const ev of events) {
    const base = UNITS[(ev as { dur: string }).dur];
    at += (ev as { dots?: number }).dots === 1 ? base * 1.5 : base;
    out.push(at);
  }
  return out;
}

describe('add_barlines generator (chromaticly-51o)', () => {
  test('every item in the deterministic set is validator-clean', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      expect(validate(gen(seed))).toEqual({ ok: true, errors: [] });
    }
  });

  // THE invariant, recomputed from the drawn lengths rather than the label.
  test('the answer is exactly the note positions where a bar fills', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = gen(seed);
      const bar = barUnitsFor((inst.stimulus.music as Music).time_sig!);
      const running = runningUnits(inst);
      const expected = running
        .map((units, i) => (units % bar === 0 && i < running.length - 1 ? i + 1 : null))
        .filter((p): p is number => p !== null);
      expect(inst.answer.canonical).toEqual(expected);
    }
  });

  test('the rhythm is exactly four bars long', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = gen(seed);
      const bar = barUnitsFor((inst.stimulus.music as Music).time_sig!);
      const running = runningUnits(inst);
      expect(running[running.length - 1]).toBe(bar * BARS);
      expect((inst.answer.canonical as number[]).length).toBe(BARS - 1);
    }
  });

  // The whole exercise is stripped bar-lines; one left in gives the answer away.
  test('no internal bar-line survives — only the final double bar is printed', () => {
    for (let seed = 0; seed < 40; seed++) {
      const events = (gen(seed).stimulus.music as Music).voices[0].events;
      const barlines = events.map((ev, i) => (ev.type === 'barline' ? i : -1)).filter((i) => i >= 0);
      expect(barlines).toEqual([events.length - 1]);
    }
  });

  test('the interaction reports the note count the answer is indexed against', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = gen(seed);
      const notes = (inst.stimulus.music as Music).voices[0].events.filter((ev) => ev.type === 'note').length;
      expect(inst.interaction.type).toBe('tap_placement');
      expect((inst.interaction.config as { notes: number }).notes).toBe(notes);
      expect(Math.max(...(inst.answer.canonical as number[]))).toBeLessThan(notes);
    }
  });

  test('all three signatures are asked within one set', () => {
    const asked = new Set<string>();
    for (let seed = 0; seed < WRITTEN_ITEMS * 3; seed++) asked.add(gen(seed).srs_tags[0]);
    expect([...asked].sort()).toEqual([...ATOMS].sort());
  });

  test.each(ATOMS)('a single due atom %s is a whole item', (atom) => {
    const inst = gen(0, [atom]);
    expect(inst.srs_tags).toEqual([atom]);
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  test('is a pure function of (grade, seed, atoms) — determinism', () => {
    expect(gen(3)).toEqual(gen(3));
  });

  test('an atom pool with no add_barlines atom throws rather than inventing one', () => {
    expect(() => gen(0, ['grouping:3/4'])).toThrow();
  });

  test('a signature the grade cannot render throws', () => {
    expect(() => gen(0, ['add_barlines:6/8'])).toThrow();
  });

  // The boundary itself: the last bar's line is the printed double bar.
  test('barlinePositions drops the final boundary, and only that one', () => {
    expect(barlinePositions([3, 2, 4, 1])).toEqual([3, 5, 9]);
    expect(barlinePositions([2])).toEqual([]);
  });
});

describe('addBarlinesHook rejects a tampered instance', () => {
  test('an answer naming a position where no bar fills', () => {
    const inst = gen(0);
    inst.answer.canonical = [1, 2, 3];
    expect(validate(inst).errors.some((e) => e.includes('the bars fall at'))).toBe(true);
  });

  test('an answer that is not a list of positions', () => {
    const inst = gen(0);
    inst.answer.canonical = 'after note 3';
    expect(validate(inst).errors.some((e) => e.includes('list of note positions'))).toBe(true);
  });

  test('a stimulus that still carries an internal bar-line', () => {
    const inst = gen(0);
    const events = (inst.stimulus.music as Music).voices[0].events;
    events.splice(2, 0, { type: 'barline', style: 'single' });
    expect(validate(inst).errors.some((e) => e.includes('internal bar-line'))).toBe(true);
  });

  test('a rhythm that does not fill a whole number of bars', () => {
    const inst = gen(0);
    (inst.stimulus.music as Music).voices[0].events.splice(1, 1);
    expect(validate(inst).errors.some((e) => e.includes('whole number of'))).toBe(true);
  });

  // Order must not matter: the template grades by set equality.
  test('the same positions in a different order still validate', () => {
    const inst = gen(0);
    inst.answer.canonical = [...(inst.answer.canonical as number[])].reverse();
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });
});
