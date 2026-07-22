import type { Music, MusicEvent } from '../../music/types';
import { anacrusisAtom } from '../atoms';
import { diatonicPitchesInComfortableRange } from '../scope';
import { validate } from '../validator';
import { barUnitsFor } from './bar-math';
import { generate } from './index';

const SIGS = ['2/4', '3/4', '4/4'];
const ATOMS = SIGS.map((sig) => anacrusisAtom(sig));
const SEEDS = Array.from({ length: 20 }, (_, i) => i);

// Independent unit table (mirrors bar-math.ts's UNITS — same discipline as
// metre-classification.test.ts, not derived circularly from the module under
// test's own arithmetic). Dot-aware for both dots:1 and dots:2 (Codex
// correction 1), even though this generator never emits dotted notes.
const UNITS: Record<string, number> = {
  demisemiquaver: 1,
  semiquaver: 2,
  quaver: 4,
  crotchet: 8,
  minim: 16,
  semibreve: 32,
};

function eventUnits(ev: MusicEvent): number {
  if (ev.type !== 'note' && ev.type !== 'chord' && ev.type !== 'rest') return 0;
  const dots = ev.dots ?? 0;
  return UNITS[ev.dur as string] * (dots === 2 ? 1.75 : dots === 1 ? 1.5 : 1);
}

/** Splits on barline events (Codex correction 2: no trailing barline, so no
 *  empty trailing group is expected for a well-formed instance). */
function barGroups(music: Music): MusicEvent[][] {
  const groups: MusicEvent[][] = [[]];
  for (const ev of music.voices[0].events) {
    if (ev.type === 'barline') groups.push([]);
    else groups[groups.length - 1].push(ev);
  }
  return groups;
}

function groupUnits(group: MusicEvent[]): number {
  return group.reduce((sum, ev) => sum + eventUnits(ev), 0);
}

function opts(atoms: string[], seed: number) {
  return { grade: 3, seed, atoms };
}

describe('anacrusisRecognition — reproducibility (KTD4: pure function of seed + atoms)', () => {
  test('the same (grade, seed, atoms) produces a deeply-equal instance', () => {
    expect(generate('anacrusis_recognition', opts(ATOMS, 5))).toEqual(
      generate('anacrusis_recognition', opts(ATOMS, 5)),
    );
  });

  test('different seeds produce different instances', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      seen.add(JSON.stringify(generate('anacrusis_recognition', opts(ATOMS, seed))));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('anacrusisRecognition — bar-group structure (Codex correction 2: no trailing barline)', () => {
  test.each(SEEDS)('seed %i renders exactly 4 bar-groups (pickup, 2 full bars, closing), none empty', (seed) => {
    const instance = generate('anacrusis_recognition', opts(ATOMS, seed));
    const groups = barGroups(instance.stimulus.music as Music);
    expect(groups).toHaveLength(4);
    for (const g of groups) expect(g.length).toBeGreaterThan(0);
  });
});

describe('anacrusisRecognition — the label matches the rendered upbeat (D7 invariant)', () => {
  test.each(SEEDS)('seed %i: recomputed pickup beats equal the canonical label', (seed) => {
    const instance = generate('anacrusis_recognition', opts(ATOMS, seed));
    const music = instance.stimulus.music as Music;
    const groups = barGroups(music);
    const first = groupUnits(groups[0]);
    const beats = first / 8;
    expect(instance.answer.canonical).toBe(`${beats} beat${beats === 1 ? '' : 's'}`);
  });
});

describe('anacrusisRecognition — first + last bar = one whole bar; middle bars are metrically full', () => {
  test.each(SEEDS)('seed %i', (seed) => {
    const instance = generate('anacrusis_recognition', opts(ATOMS, seed));
    const music = instance.stimulus.music as Music;
    const barUnits = barUnitsFor(music.time_sig as string);
    const groups = barGroups(music);
    const first = groupUnits(groups[0]);
    const last = groupUnits(groups[groups.length - 1]);

    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(barUnits);
    expect(first % 8).toBe(0);
    expect(first + last).toBe(barUnits);

    for (const middle of groups.slice(1, -1)) {
      expect(groupUnits(middle)).toBe(barUnits);
    }
  });
});

describe('anacrusisRecognition — marker + printed metre (D1/D7 self-consistency)', () => {
  test.each(SEEDS)('seed %i', (seed) => {
    const instance = generate('anacrusis_recognition', opts(ATOMS, seed));
    const music = instance.stimulus.music as Music;
    expect(music.anacrusis).toBe(true);
    expect(SIGS).toContain(music.time_sig);
    expect(music.time_sig_hidden).toBeUndefined();
  });
});

describe('anacrusisRecognition — exactly 3 distinct diagnostic options (D4)', () => {
  test.each(SEEDS)('seed %i: canonical + 2 distractors are 3 distinct "N beat(s)" labels, including the full-bar miscount', (seed) => {
    const instance = generate('anacrusis_recognition', opts(ATOMS, seed));
    const options = [instance.answer.canonical, ...instance.distractors] as string[];
    expect(options).toHaveLength(3);
    expect(new Set(options).size).toBe(3);
    for (const o of options) expect(o).toMatch(/^\d+ beats?$/);

    const barUnits = barUnitsFor((instance.stimulus.music as Music).time_sig as string);
    const beats = barUnits / 8;
    expect(instance.distractors).toContain(`${beats} beat${beats === 1 ? '' : 's'}`);
  });
});

// Codex correction 3: the {complement, p-1, p+1, 0} \ {p, beats} candidate
// set can have more than one survivor, so exactly one must be rng-picked —
// this independently recomputes the survivor set (not the generator's own
// filter) and asserts it is never empty for any (beats, p) the generator can
// draw, which is what guarantees a d2 always exists to pick from.
describe('anacrusisRecognition — the d2 distractor candidate set is never empty (Codex correction 3)', () => {
  function survivors(beats: number, p: number): number[] {
    const raw = [beats - p, p - 1, p + 1, 0];
    return [...new Set(raw.filter((x) => x >= 0 && x <= beats && x !== p && x !== beats))];
  }

  const cases: Array<{ beats: number; p: number }> = [];
  for (const beats of [2, 3, 4]) {
    for (let p = 1; p < beats; p++) cases.push({ beats, p });
  }

  test.each(cases)('beats=$beats p=$p has at least one d2 survivor', ({ beats, p }) => {
    expect(survivors(beats, p).length).toBeGreaterThanOrEqual(1);
  });
});

describe('anacrusisRecognition — incidental pitch stays comfortable (rhythm is the subject, not pitch)', () => {
  test.each(SEEDS)('seed %i: every stimulus pitch is in the comfortable (grade-2) band', (seed) => {
    const instance = generate('anacrusis_recognition', opts(ATOMS, seed));
    const music = instance.stimulus.music as Music;
    const comfortable = diatonicPitchesInComfortableRange(music.clef, 3);
    for (const ev of music.voices[0].events) {
      if (ev.type !== 'note') continue;
      expect(comfortable).toContain(ev.pitch);
    }
  });
});

describe('anacrusisRecognition — srs_tags', () => {
  test.each(SEEDS)('seed %i emits the anacrusis:<sig> atom matching the sampled signature', (seed) => {
    const instance = generate('anacrusis_recognition', opts(['anacrusis:4/4'], seed));
    expect(instance.srs_tags).toEqual(['anacrusis:4/4']);
  });
});

describe('anacrusisRecognition — mcq shape', () => {
  test('interaction.type is mcq and canonical/distractors are plain strings', () => {
    const instance = generate('anacrusis_recognition', opts(ATOMS, 0));
    expect(instance.interaction.type).toBe('mcq');
    expect(typeof instance.answer.canonical).toBe('string');
    for (const d of instance.distractors) expect(typeof d).toBe('string');
  });
});

describe('anacrusisRecognition — fuzz gate: validator-clean across the retry budget', () => {
  test('seeds 0..99 with the three-atom scope all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = generate('anacrusis_recognition', opts(ATOMS, seed));
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
    }
  });
});
