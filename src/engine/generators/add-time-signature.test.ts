import type { Music, MusicEvent } from '../../music/types';
import { scopeForGrade } from '../scope';
import { validate } from '../validator';
import { addTimeSignature } from './add-time-signature';

const g1NoteValues = scopeForGrade(1).noteValues;
const g1TimeSignatures = scopeForGrade(1).timeSignatures;

// Independent recomputation of a bar's beat total, mirroring rhythm-sum.test.ts
// and bar-validity.test.ts's own independent unit tables — a real invariant
// check, not a restatement of the generator's own arithmetic.
const UNITS: Record<string, number> = { semiquaver: 1, quaver: 2, crotchet: 4, minim: 8, semibreve: 16 };
const BAR_UNITS: Record<string, number> = { '2/4': 8, '3/4': 12, '4/4': 16 };

function barTotal(events: MusicEvent[]): number {
  return events.reduce((sum, ev) => {
    if (ev.type !== 'note') return sum;
    return sum + UNITS[ev.dur as string];
  }, 0);
}

describe('addTimeSignature — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = addTimeSignature({ grade: 1, seed: 5, atoms: [] });
    const b = addTimeSignature({ grade: 1, seed: 5, atoms: [] });
    expect(a).toEqual(b);
  });

  test('different seeds produce different instances', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seeds.add(JSON.stringify(addTimeSignature({ grade: 1, seed, atoms: [] })));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('addTimeSignature — canonical answer matches the bar\'s actual beat sum', () => {
  test('the canonical time signature is the one whose beat count the rendered bar actually totals', () => {
    for (let seed = 0; seed < 50; seed++) {
      const instance = addTimeSignature({ grade: 1, seed, atoms: [] });
      const canonical = instance.answer.canonical as string;
      const music = instance.stimulus.music as Music;
      const total = barTotal(music.voices[0].events);
      expect(total).toBe(BAR_UNITS[canonical]);
    }
  });

  test('the stimulus itself carries no time signature — the learner must add up the bar', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = addTimeSignature({ grade: 1, seed, atoms: [] });
      expect((instance.stimulus.music as Music).time_sig).toBeNull();
    }
  });
});

describe('addTimeSignature — distractors are the other G1 time signatures', () => {
  test('every distractor is a G1 time signature, none equal the canonical answer, no duplicates', () => {
    for (let seed = 0; seed < 50; seed++) {
      const instance = addTimeSignature({ grade: 1, seed, atoms: [] });
      const canonical = instance.answer.canonical as string;
      expect(instance.distractors.length).toBeGreaterThanOrEqual(1);
      for (const d of instance.distractors) {
        expect(g1TimeSignatures).toContain(d);
        expect(d).not.toBe(canonical);
      }
      expect(new Set(instance.distractors).size).toBe(instance.distractors.length);
    }
  });

  test('the distractor pool is exactly the other two G1 time signatures', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = addTimeSignature({ grade: 1, seed, atoms: [] });
      const canonical = instance.answer.canonical as string;
      const expected = g1TimeSignatures.filter((t) => t !== canonical);
      expect([...instance.distractors].sort()).toEqual([...expected].sort());
    }
  });
});

describe('addTimeSignature — scope', () => {
  test('every emitted note value is in G1 scope and the canonical answer is a G1 time signature', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = addTimeSignature({ grade: 1, seed, atoms: [] });
      expect(g1TimeSignatures).toContain(instance.answer.canonical);
      for (const ev of (instance.stimulus.music as Music).voices[0].events) {
        if (ev.type === 'note') expect(g1NoteValues).toContain(ev.dur);
      }
    }
  });
});

describe('addTimeSignature — srs_tags', () => {
  test('emits the bare add_time_signature atom', () => {
    const instance = addTimeSignature({ grade: 1, seed: 1, atoms: [] });
    expect(instance.srs_tags).toEqual(['add_time_signature']);
  });
});

describe('addTimeSignature — fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = addTimeSignature({ grade: 1, seed, atoms: [] });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});
