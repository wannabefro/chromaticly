import type { Music, MusicEvent } from '../../music/types';
import { classifyMetre } from '../metre';
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

describe('addTimeSignature — R2: bar-math extraction did not change the emitted event shape', () => {
  test('grade-1 note events carry no "dots" key (undotted events stay bare, matching the pre-U4 shape)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = addTimeSignature({ grade: 1, seed, atoms: [] });
      for (const ev of (instance.stimulus.music as Music).voices[0].events) {
        if (ev.type === 'note') expect('dots' in ev).toBe(false);
      }
    }
  });
});

describe('addTimeSignature — srs_tags', () => {
  test('emits the bare add_time_signature atom', () => {
    const instance = addTimeSignature({ grade: 1, seed: 1, atoms: [] });
    expect(instance.srs_tags).toEqual(['add_time_signature']);
  });

  // U5 (R4): a compound instance must credit the parameterized atom, not the
  // bare one — otherwise the due path misroutes to the grade-1 owner
  // (first-owner-wins, practice-plan.ts).
  test('a compound instance emits the parameterized atom matching the sampled signature', () => {
    const instance = addTimeSignature({ grade: 3, seed: 0, atoms: ['add_time_signature:9/8'] });
    expect(instance.answer.canonical).toBe('9/8');
    expect(instance.srs_tags).toEqual(['add_time_signature:9/8']);
  });
});

describe('addTimeSignature — U5 (D6): bare grade-3 draws sample the full renderable set, compound included', () => {
  test('seeds 0..99 at grade 3 with bare atoms draw at least one compound canonical (the D13 guard is gone)', () => {
    const canonicals = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      canonicals.add(addTimeSignature({ grade: 3, seed, atoms: [] }).answer.canonical as string);
    }
    expect([...canonicals].some((sig) => sig.endsWith('/8'))).toBe(true);
  });
});

describe('addTimeSignature — U5 (D6): atom-scoped compound sampling', () => {
  test('a single compound atom pins the signature across seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = addTimeSignature({ grade: 3, seed, atoms: ['add_time_signature:6/8'] });
      expect(instance.answer.canonical).toBe('6/8');
    }
  });

  test('the three-atom compound scope reaches all three compound signatures over seeds 0..119', () => {
    const atoms = ['add_time_signature:6/8', 'add_time_signature:9/8', 'add_time_signature:12/8'];
    const seen = new Set<string>();
    for (let seed = 0; seed < 120; seed++) {
      seen.add(addTimeSignature({ grade: 3, seed, atoms }).answer.canonical as string);
    }
    expect(seen).toEqual(new Set(['6/8', '9/8', '12/8']));
  });
});

// Independent unit table (mirrors bar-math.ts's UNITS, authored separately —
// see bar-math.test.ts's own independent-capture discipline, D3/Codex R2).
const COMPOUND_UNITS: Record<string, number> = {
  demisemiquaver: 1,
  semiquaver: 2,
  quaver: 4,
  crotchet: 8,
  minim: 16,
  semibreve: 32,
};
const COMPOUND_BAR_UNITS: Record<string, number> = { '6/8': 24, '9/8': 36, '12/8': 48 };
const COMPOUND_ATOMS = ['add_time_signature:6/8', 'add_time_signature:9/8', 'add_time_signature:12/8'];

describe('addTimeSignature — U5 (D6/D5): compound instances are true, correctly grouped, hidden-signature bars', () => {
  test('stimulus.music.time_sig equals the canonical answer, time_sig_hidden is true, and the bar sums to BAR_UNITS[sig]', () => {
    for (let seed = 0; seed < 60; seed++) {
      const instance = addTimeSignature({ grade: 3, seed, atoms: COMPOUND_ATOMS });
      const canonical = instance.answer.canonical as string;
      const music = instance.stimulus.music as Music;
      expect(music.time_sig).toBe(canonical);
      expect(music.time_sig_hidden).toBe(true);

      const total = music.voices[0].events.reduce((sum, ev) => {
        if (ev.type !== 'note') return sum;
        return sum + COMPOUND_UNITS[ev.dur as string] * (ev.dots === 1 ? 1.5 : 1);
      }, 0);
      expect(total).toBe(COMPOUND_BAR_UNITS[canonical]);
    }
  });

  // The invariant D4's pattern table guarantees by construction: no note event's
  // span may straddle a dotted-crotchet beat boundary (every 12 units).
  // Recomputed independently here (not by inspecting the internal pattern
  // list) — an event straddles iff its start and end fall in different
  // 12-unit blocks.
  test('no compound-bar event crosses a dotted-crotchet beat boundary', () => {
    for (let seed = 0; seed < 60; seed++) {
      const instance = addTimeSignature({ grade: 3, seed, atoms: COMPOUND_ATOMS });
      const music = instance.stimulus.music as Music;
      let cursor = 0;
      for (const ev of music.voices[0].events) {
        if (ev.type !== 'note') continue;
        const units = COMPOUND_UNITS[ev.dur as string] * (ev.dots === 1 ? 1.5 : 1);
        const start = cursor;
        const end = cursor + units;
        expect(Math.floor(start / 12)).toBe(Math.floor((end - 1) / 12));
        cursor = end;
      }
    }
  });
});

describe('addTimeSignature — U5 (D6): family-scoped distractors', () => {
  test('every instance at every grade has exactly 2 distractors, same family as canonical, distinct from canonical', () => {
    for (const grade of [1, 2, 3] as const) {
      for (let seed = 0; seed < 40; seed++) {
        const instance = addTimeSignature({ grade, seed, atoms: [] });
        const canonical = instance.answer.canonical as string;
        expect(instance.distractors.length).toBe(2);
        for (const d of instance.distractors) {
          expect(d).not.toBe(canonical);
          expect(classifyMetre(d as string).division).toBe(classifyMetre(canonical).division);
        }
      }
    }
  });

  test('a 6/8 instance never offers 3/4 as an option — the equal-total ambiguity is structurally excluded', () => {
    for (let seed = 0; seed < 60; seed++) {
      const instance = addTimeSignature({ grade: 3, seed, atoms: ['add_time_signature:6/8'] });
      expect(instance.answer.canonical).toBe('6/8');
      expect(instance.distractors).not.toContain('3/4');
    }
  });
});

// Ledger-lines-3 follow-up fix: grade 3's wider reading range must not leak
// into this generator's incidental pitch — rhythm is the subject, pitch is
// decorative, so it must stay in the comfortable (grade-2) band.
describe('addTimeSignature — incidental pitch stays comfortable at grade 3, never on the newly-widened 3rd-ledger pitches', () => {
  const NEWLY_WIDENED_TREBLE = ['F3', 'G3', 'D6', 'E6'];
  const NEWLY_WIDENED_BASS = ['A1', 'B1', 'F4', 'G4'];

  test('every grade-3 stimulus pitch across seeds 0..99 avoids F3/G3/D6/E6 on treble and A1/B1/F4/G4 on bass', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = addTimeSignature({ grade: 3, seed, atoms: [] });
      const music = instance.stimulus.music as Music;
      const forbidden = music.clef === 'treble' ? NEWLY_WIDENED_TREBLE : NEWLY_WIDENED_BASS;
      for (const ev of music.voices[0].events) {
        if (ev.type !== 'note') continue;
        expect(forbidden).not.toContain(ev.pitch);
      }
    }
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

  test('seeds 0..99 at grade 3 with the compound atom scope all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = addTimeSignature({ grade: 3, seed, atoms: COMPOUND_ATOMS });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});
