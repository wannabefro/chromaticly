// chromaticly-io4.3. minor-keys-2 teaches how to tell a minor piece from its
// relative major and scored only the key names.

import { generate } from './index';
import { validate } from '../validator';
import { WRITTEN_ITEMS } from '../../learn/exercise-set';
import { tonalCentreAtom, tonalCentrePairs } from './tonal-centre';
import type { ExerciseInstance } from '../schema';
import type { Music } from '../../music/types';

const PAIRS = tonalCentrePairs(2);
const ATOMS = [
  ...PAIRS.map((p) => tonalCentreAtom({ tonic: p.major, mode: 'major' })),
  ...PAIRS.map((p) => tonalCentreAtom({ tonic: p.minor, mode: 'minor' })),
];

function gen(seed: number, atoms: string[] = ATOMS): ExerciseInstance {
  return generate('tonal_centre', { grade: 2, seed, atoms });
}

function pitches(inst: ExerciseInstance): string[] {
  return (inst.stimulus.music as Music).voices[0].events.map((ev) => ('pitch' in ev ? String(ev.pitch) : ''));
}

const bare = (p: string) => p.replace(/-?\d+$/, '');

describe('tonal_centre generator (chromaticly-io4.3)', () => {
  test('every item in the deterministic set is validator-clean', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      expect(validate(gen(seed))).toEqual({ ok: true, errors: [] });
    }
  });

  // THE invariant: where it settles is the only clue the signature cannot give.
  test('the passage opens and closes on the answer key tonic', () => {
    for (let seed = 0; seed < 30; seed++) {
      const inst = gen(seed);
      const tonic = String(inst.answer.canonical).split(' ')[0];
      const notes = pitches(inst);
      expect(bare(notes[0])).toBe(tonic);
      expect(bare(notes[notes.length - 1])).toBe(tonic);
    }
  });

  test('a minor answer raises its 7th and a major answer does not', () => {
    let minors = 0;
    let majors = 0;
    for (let seed = 0; seed < 30; seed++) {
      const inst = gen(seed);
      const [tonic, mode] = String(inst.answer.canonical).split(' ');
      const printed = pitches(inst).map(bare);
      const accidental = printed.some((p) => p.length > 1 && p !== tonic);
      if (mode === 'minor') {
        expect(accidental).toBe(true);
        minors++;
      } else {
        majors++;
      }
    }
    expect(minors).toBeGreaterThan(0);
    expect(majors).toBeGreaterThan(0);
  });

  // The relative key is THE misconception; without it the signature answers it.
  test('the relative key of the answer is always an option', () => {
    for (let seed = 0; seed < 30; seed++) {
      const inst = gen(seed);
      const [tonic, mode] = String(inst.answer.canonical).split(' ');
      const pair = PAIRS.find((p) => (mode === 'minor' ? p.minor : p.major) === tonic)!;
      const relative = mode === 'minor' ? `${pair.major} major` : `${pair.minor} minor`;
      expect(inst.distractors).toContain(relative);
      expect(inst.distractors).not.toContain(inst.answer.canonical);
    }
  });

  // A two-option item is answered by the pair alone; the third option makes
  // reading the signature worth something.
  test('the third option comes from a different pair, in the same mode', () => {
    for (let seed = 0; seed < 30; seed++) {
      const inst = gen(seed);
      const [tonic, mode] = String(inst.answer.canonical).split(' ');
      const pair = PAIRS.find((p) => (mode === 'minor' ? p.minor : p.major) === tonic)!;
      const other = (inst.distractors as string[]).filter((d) => !d.startsWith(mode === 'minor' ? pair.major : pair.minor));
      expect(other).toHaveLength(1);
      expect(other[0].endsWith(mode)).toBe(true);
      expect(other[0]).not.toBe(inst.answer.canonical);
    }
  });

  test('all six keys are asked within one set', () => {
    const asked = new Set<string>();
    for (let seed = 0; seed < WRITTEN_ITEMS * 2; seed++) asked.add(gen(seed).srs_tags[0]);
    expect([...asked].sort()).toEqual([...ATOMS].sort());
  });

  // Otherwise a replayed lesson teaches one memorised shape per key.
  test('the middle note varies across seeds for the same key', () => {
    const shapes = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const inst = gen(seed, ['tonal_centre:C_major']);
      shapes.add(pitches(inst).join(' '));
    }
    expect(shapes.size).toBeGreaterThan(1);
  });

  test.each(ATOMS)('a single due atom %s is a whole item', (atom) => {
    const inst = gen(0, [atom]);
    expect(inst.srs_tags).toEqual([atom]);
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  test('is a pure function of (grade, seed, atoms) — determinism', () => {
    expect(gen(3)).toEqual(gen(3));
  });

  test('an atom pool with no tonal centre throws rather than inventing one', () => {
    expect(() => gen(0, ['key_sig:A_minor'])).toThrow();
  });
});

// Each guard is provoked on its own: a chain proven only as a whole can lose
// any single term silently.
describe('tonalCentreHook rejects a tampered instance', () => {
  const tamper = (mutate: (inst: ExerciseInstance) => void): string[] => {
    const inst = gen(3);
    mutate(inst);
    return validate(inst).errors;
  };

  const minor = (): ExerciseInstance => {
    const found = Array.from({ length: 12 }, (_, s) => gen(s)).find((i) => String(i.answer.canonical).endsWith('minor'));
    expect(found).toBeDefined();
    return found!;
  };

  test('a passage that ends somewhere other than the tonic', () => {
    expect(tamper((inst) => {
      (inst.stimulus.music as Music).voices[0].events[3] = { type: 'note', pitch: 'B4', dur: 'crotchet' };
    })).not.toEqual([]);
  });

  test('a passage that starts somewhere other than the tonic', () => {
    expect(tamper((inst) => {
      (inst.stimulus.music as Music).voices[0].events[0] = { type: 'note', pitch: 'B4', dur: 'crotchet' };
    })).not.toEqual([]);
  });

  test('a key signature that is not the answer key', () => {
    expect(tamper((inst) => {
      (inst.stimulus.music as Music).key_sig = 'D_minor';
    })).not.toEqual([]);
  });

  test('a minor answer whose 7th was never raised', () => {
    const inst = minor();
    const notes = (inst.stimulus.music as Music).voices[0].events;
    notes[2] = { type: 'note', pitch: bare(String((notes[2] as any).pitch)).replace('#', '') + '4', dur: 'crotchet' };
    expect(validate(inst).errors.some((e) => e.includes('never raises its 7th'))).toBe(true);
  });

  test('a major answer carrying a raised 7th', () => {
    const inst = gen(0);
    expect(String(inst.answer.canonical)).toBe('C major');
    (inst.stimulus.music as Music).voices[0].events[2] = { type: 'note', pitch: 'B#4', dur: 'crotchet' };
    expect(validate(inst).errors.some((e) => e.includes('raises a 7th'))).toBe(true);
  });

  test('an answer that also appears among the distractors', () => {
    expect(tamper((inst) => {
      inst.distractors = [...inst.distractors, inst.answer.canonical as string];
    })).not.toEqual([]);
  });

  test('a canonical that is not a key name at all', () => {
    expect(tamper((inst) => { inst.answer.canonical = 'C'; })).not.toEqual([]);
  });
});
