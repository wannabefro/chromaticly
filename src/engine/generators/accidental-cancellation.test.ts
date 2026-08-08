// chromaticly-7xv.2. Grade 4 item 2 names the cancellation of a double sharp
// or double flat. Nothing taught it and nothing scored it.

import { generate } from './index';
import { validate } from '../validator';
import { musicToAbc } from '../../music/abc-emitter';
import { WRITTEN_ITEMS } from '../../learn/exercise-set';
import { CANCELLATIONS, cancellationAtom } from './accidental-cancellation';
import type { ExerciseInstance } from '../schema';
import type { Music } from '../../music/types';

const ATOMS = CANCELLATIONS.map(cancellationAtom);

function gen(seed: number, atoms: string[] = ATOMS): ExerciseInstance {
  return generate('accidental_cancellation', { grade: 4, seed, atoms });
}

function pitches(inst: ExerciseInstance): string[] {
  return (inst.stimulus.music as Music).voices[0].events.map((ev) => ('pitch' in ev ? String(ev.pitch) : ''));
}

describe('accidental_cancellation generator (chromaticly-7xv.2)', () => {
  test('every item in the deterministic set is validator-clean', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      expect(validate(gen(seed))).toEqual({ ok: true, errors: [] });
    }
  });

  // THE invariant: the same letter and octave returns, so the hold is carried.
  test('the letter arrives doubled and returns cancelled, same octave', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      const [first, , last] = pitches(gen(seed));
      expect(first).toMatch(/^[A-G](##|bb)-?\d+$/);
      expect(last).toMatch(/^[A-G](#|b)?-?\d+$/);
      expect(last).not.toMatch(/(##|bb)/);
      expect(first.replace(/##|bb/, '')).toBe(last.replace(/#|b/, ''));
    }
  });

  // Without a different letter between, there is nothing to hold across.
  test('the note in between is a different letter', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      const [first, middle] = pitches(gen(seed));
      expect(middle[0]).not.toBe(first[0]);
    }
  });

  // abcjs prints an accidental only when it differs from what is in force.
  test('the emitted ABC prints the cancelling sign on the last note', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      const inst = gen(seed);
      const body = musicToAbc(inst.stimulus.music as Music).split('\n').filter(Boolean).pop()!;
      const lastToken = body.trim().split(/\s+/).pop()!;
      expect(lastToken).toMatch(/^[=^_]/);
    }
  });

  // Random sampling left one unasked, and the router then mis-routed that atom.
  test('all four cancellations are asked within one set', () => {
    const asked = new Set<string>();
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) asked.add(gen(seed).srs_tags[0]);
    expect([...asked].sort()).toEqual([...ATOMS].sort());
  });

  // Practice serves ONE due atom as the whole pool.
  test.each(ATOMS)('a single due atom %s is a whole item', (atom) => {
    const inst = gen(0, [atom]);
    expect(inst.srs_tags).toEqual([atom]);
    expect(inst.distractors).not.toContain(inst.answer.canonical);
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  test('a cancelled-to-sharp answer keeps the sharp, and the natural is the trap', () => {
    const inst = gen(0, ['accidental_cancel:double_sharp_to_sharp']);
    expect(inst.answer.canonical).toMatch(/^[A-G] sharp$/);
    expect(inst.distractors).toContain(inst.answer.canonical.replace(' sharp', ''));
    expect(inst.distractors).toContain(inst.answer.canonical.replace('sharp', 'double sharp'));
  });

  test('is a pure function of (grade, seed, atoms) — determinism', () => {
    expect(gen(3)).toEqual(gen(3));
  });

  test('an atom pool with no cancellation throws rather than inventing one', () => {
    expect(() => gen(0, ['note_read:treble:F##4'])).toThrow();
  });
});

// Each guard is provoked on its own: a chain proven only as a whole can lose
// any single term silently.
describe('accidentalCancellationHook rejects a tampered instance', () => {
  const tamper = (mutate: (inst: ExerciseInstance) => void): string[] => {
    const inst = gen(0);
    mutate(inst);
    return validate(inst).errors;
  };

  const setPitch = (inst: ExerciseInstance, index: number, pitch: string): void => {
    (inst.stimulus.music as Music).voices[0].events[index] = { type: 'note', pitch, dur: 'crotchet' };
  };

  test('the last note still carrying the double accidental', () => {
    expect(tamper((inst) => setPitch(inst, 2, pitches(inst)[0]))).not.toEqual([]);
  });

  test('the last note on a different letter from the first', () => {
    expect(tamper((inst) => setPitch(inst, 2, 'C4'))).not.toEqual([]);
  });

  test('the middle note repeating the letter under test', () => {
    expect(tamper((inst) => setPitch(inst, 1, pitches(inst)[2]))).not.toEqual([]);
  });

  test('a canonical that names the wrong note', () => {
    expect(tamper((inst) => { inst.answer.canonical = 'C sharp'; })).not.toEqual([]);
  });

  test('an srs_tag that names a cancellation the bar does not draw', () => {
    expect(tamper((inst) => { inst.srs_tags = ['accidental_cancel:double_flat_to_flat']; })).not.toEqual([]);
  });

  test('a bar with only two notes', () => {
    expect(tamper((inst) => { (inst.stimulus.music as Music).voices[0].events.pop(); })).not.toEqual([]);
  });
});
