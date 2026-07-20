import type { Music } from '../../music/types';
import { classifyMetre } from '../metre';
import { validate } from '../validator';
import { barUnitsFor } from './bar-math';
import { generate } from './index';

const ALL_SIGS = ['2/4', '3/4', '4/4', '6/8', '9/8', '12/8'];
const ALL_ATOMS = ALL_SIGS.map((sig) => `metre:${sig}`);
const COMPOUND_ATOMS = ['metre:6/8', 'metre:9/8', 'metre:12/8'];

// Independent-of-the-generator label formatter (mirrors classifyMetre's own
// table, D7) — used to state expectations without reading them off the
// generator's own output.
function label(sig: string): string {
  const cls = classifyMetre(sig);
  return `${cls.division === 'simple' ? 'Simple' : 'Compound'} ${cls.beats}`;
}

const ALL_LABELS = new Set(ALL_SIGS.map(label));

// Independent unit table (mirrors bar-math.ts's UNITS — same discipline as
// add-time-signature.test.ts, not derived circularly from the module under
// test's own arithmetic).
const UNITS: Record<string, number> = {
  demisemiquaver: 1,
  semiquaver: 2,
  quaver: 4,
  crotchet: 8,
  minim: 16,
  semibreve: 32,
};

function barTotal(music: Music): number {
  return music.voices[0].events.reduce((sum, ev) => {
    if (ev.type !== 'note') return sum;
    return sum + UNITS[ev.dur as string] * (ev.dots === 1 ? 1.5 : 1);
  }, 0);
}

function opts(atoms: string[], seed: number) {
  return { grade: 3, seed, atoms };
}

describe('metreClassification — reproducibility (KTD4: pure function of seed + atoms)', () => {
  test('the same (grade, seed, atoms) produces a deeply-equal instance', () => {
    expect(generate('metre_classification', opts(ALL_ATOMS, 5))).toEqual(
      generate('metre_classification', opts(ALL_ATOMS, 5)),
    );
  });

  test('different seeds produce different instances', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seen.add(JSON.stringify(generate('metre_classification', opts(ALL_ATOMS, seed))));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('metreClassification — canonical correctness (the template\'s core invariant: an instance can never mislabel its own stimulus)', () => {
  test('answer.canonical === label(classifyMetre(stimulus.music.time_sig)) across seeds 0..99, for every one of the six atoms', () => {
    for (const atom of ALL_ATOMS) {
      for (let seed = 0; seed < 100; seed++) {
        const instance = generate('metre_classification', opts([atom], seed));
        const music = instance.stimulus.music as Music;
        expect(instance.answer.canonical).toBe(label(music.time_sig as string));
      }
    }
  });
});

describe('metreClassification — distractor rule (D7): deterministic-diagnostic, exactly 3 options, only legal labels', () => {
  test('a 6/8 (compound duple) instance offers exactly {canonical, the flipped-division-same-beats label, a same-division-other-beats label}', () => {
    for (let seed = 0; seed < 60; seed++) {
      const instance = generate('metre_classification', opts(['metre:6/8'], seed));
      expect(instance.answer.canonical).toBe('Compound duple');
      expect(instance.distractors).toHaveLength(2);
      expect(instance.distractors).toContain('Simple duple'); // division-blind error
      const other = (instance.distractors as string[]).find((d) => d !== 'Simple duple');
      expect(['Compound triple', 'Compound quadruple']).toContain(other); // miscounted-beats error
    }
  });

  test('every option across a seed sweep is one of the six legal labels, and all six actually appear', () => {
    const seenOptions = new Set<string>();
    for (const atom of ALL_ATOMS) {
      for (let seed = 0; seed < 30; seed++) {
        const instance = generate('metre_classification', opts([atom], seed));
        seenOptions.add(instance.answer.canonical as string);
        for (const d of instance.distractors as string[]) seenOptions.add(d);
      }
    }
    expect(seenOptions).toEqual(ALL_LABELS);
  });

  test('every instance has exactly 3 distinct options (canonical + 2 distractors)', () => {
    for (let seed = 0; seed < 40; seed++) {
      const instance = generate('metre_classification', opts(ALL_ATOMS, seed));
      const options = [instance.answer.canonical, ...instance.distractors];
      expect(options).toHaveLength(3);
      expect(new Set(options).size).toBe(3);
    }
  });
});

describe('metreClassification — stimulus (D8): the signature is PRINTED, not hidden (the opposite of add_time_signature)', () => {
  test('stimulus.music.time_sig is set and time_sig_hidden is absent/falsy', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = generate('metre_classification', opts(ALL_ATOMS, seed));
      const music = instance.stimulus.music as Music;
      expect(music.time_sig).toBeTruthy();
      expect(music.time_sig_hidden).toBeFalsy();
    }
  });

  test('the rendered bar sums exactly to BAR_UNITS[sig] for every one of the six signatures', () => {
    for (const atom of ALL_ATOMS) {
      for (let seed = 0; seed < 20; seed++) {
        const instance = generate('metre_classification', opts([atom], seed));
        const music = instance.stimulus.music as Music;
        expect(barTotal(music)).toBe(barUnitsFor(music.time_sig as string));
      }
    }
  });

  // The invariant D4's compound pattern table guarantees by construction: no
  // note event's span may straddle a dotted-crotchet beat boundary (every 12
  // units) — recomputed independently, not by inspecting the internal pattern list.
  test('no compound-bar event crosses a dotted-crotchet beat boundary', () => {
    for (const atom of COMPOUND_ATOMS) {
      for (let seed = 0; seed < 40; seed++) {
        const instance = generate('metre_classification', opts([atom], seed));
        const music = instance.stimulus.music as Music;
        let cursor = 0;
        for (const ev of music.voices[0].events) {
          if (ev.type !== 'note') continue;
          const units = UNITS[ev.dur as string] * (ev.dots === 1 ? 1.5 : 1);
          const start = cursor;
          const end = cursor + units;
          expect(Math.floor(start / 12)).toBe(Math.floor((end - 1) / 12));
          cursor = end;
        }
      }
    }
  });
});

describe('metreClassification — reachability (atom-sampling discipline: due-path safety + full-scope coverage)', () => {
  test('all six signatures reached over seeds 0..119 with the six-atom scope', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 120; seed++) {
      const instance = generate('metre_classification', opts(ALL_ATOMS, seed));
      seen.add((instance.stimulus.music as Music).time_sig as string);
    }
    expect(seen).toEqual(new Set(ALL_SIGS));
  });

  test('a single-atom scope pins the signature across seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = generate('metre_classification', opts(['metre:9/8'], seed));
      expect((instance.stimulus.music as Music).time_sig).toBe('9/8');
      expect(instance.answer.canonical).toBe('Compound triple');
    }
  });
});

describe('metreClassification — srs_tags', () => {
  test('emits the metre:<sig> atom matching the sampled signature', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = generate('metre_classification', opts(['metre:12/8'], seed));
      expect(instance.srs_tags).toEqual(['metre:12/8']);
    }
  });
});

describe('metreClassification — mcq shape (the no-new-UI requirement: same shape mode_swap already ships)', () => {
  test('interaction.type is mcq and canonical/distractors are plain strings', () => {
    const instance = generate('metre_classification', opts(ALL_ATOMS, 0));
    expect(instance.interaction.type).toBe('mcq');
    expect(typeof instance.answer.canonical).toBe('string');
    for (const d of instance.distractors) expect(typeof d).toBe('string');
  });
});

describe('metreClassification — cannot leak below grade 3 (no /8 signature is in scope below grade 3)', () => {
  test('grade 3 itself is fine; grade 2 fails to generate a valid instance', () => {
    expect(() => generate('metre_classification', { grade: 3, seed: 0, atoms: ['metre:6/8'] })).not.toThrow();
    expect(() => generate('metre_classification', { grade: 2, seed: 0, atoms: ['metre:6/8'] })).toThrow();
  });
});

describe('metreClassification — fuzz gate: validator-clean across the retry budget', () => {
  test('seeds 0..99 with the six-atom scope all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = generate('metre_classification', opts(ALL_ATOMS, seed));
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
    }
  });
});
