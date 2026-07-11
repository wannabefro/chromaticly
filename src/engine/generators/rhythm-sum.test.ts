import { G1_NOTE_VALUES } from '../scope';
import { validate } from '../validator';
import { rhythmSum } from './rhythm-sum';

describe('rhythmSum — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = rhythmSum({ grade: 1, seed: 5 });
    const b = rhythmSum({ grade: 1, seed: 5 });
    expect(a).toEqual(b);
  });

  test('different seeds produce different instances', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seeds.add(JSON.stringify(rhythmSum({ grade: 1, seed })));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('rhythmSum — the total always equals exactly one legal G1 note value', () => {
  test('canonical answer duration is a G1 note value, dots is 0 or 1', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = rhythmSum({ grade: 1, seed });
      const canonical = instance.answer.canonical as { dur: string; dots: number };
      expect(G1_NOTE_VALUES).toContain(canonical.dur);
      expect([0, 1]).toContain(canonical.dots);
    }
  });

  test('the prompt text\'s stated sum actually equals the canonical answer in beats', () => {
    const BEATS: Record<string, number> = {
      semibreve: 4,
      minim: 2,
      crotchet: 1,
      quaver: 0.5,
      semiquaver: 0.25,
    };
    function valueBeats(name: string): number {
      const dotted = name.startsWith('dotted ');
      const base = dotted ? name.slice('dotted '.length) : name;
      return BEATS[base] * (dotted ? 1.5 : 1);
    }
    for (let seed = 0; seed < 30; seed++) {
      const instance = rhythmSum({ grade: 1, seed });
      const text = instance.stimulus.text as string;
      const expr = text.replace(/\s*=\s*\?$/, '');
      // split on + / - while keeping the operator with the following term
      const tokens = expr.split(/\s*(?=[+-]\s)/).map((t) => t.trim());
      let total = 0;
      for (const token of tokens) {
        if (token.startsWith('-')) total -= valueBeats(token.slice(1).trim());
        else if (token.startsWith('+')) total += valueBeats(token.slice(1).trim());
        else total += valueBeats(token);
      }
      const canonical = instance.answer.canonical as { dur: string; dots: number };
      const canonicalBeats = valueBeats(canonical.dots === 1 ? `dotted ${canonical.dur}` : canonical.dur);
      expect(total).toBeCloseTo(canonicalBeats, 6);
    }
  });
});

describe('rhythmSum — distractor rule: adjacent tree step + the un-dotted version of a dotted answer', () => {
  test('when the answer is dotted, one distractor is its un-dotted version', () => {
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed++) {
      const instance = rhythmSum({ grade: 1, seed });
      const canonical = instance.answer.canonical as { dur: string; dots: number };
      if (canonical.dots === 1) {
        found = true;
        const undotted = (instance.distractors as { dur: string; dots: number }[]).find(
          (d) => d.dur === canonical.dur && d.dots === 0,
        );
        expect(undotted).toBeDefined();
      }
    }
    expect(found).toBe(true);
  });

  test('every item has at least one distractor and none equal the canonical answer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = rhythmSum({ grade: 1, seed });
      expect(instance.distractors.length).toBeGreaterThanOrEqual(1);
      for (const d of instance.distractors) {
        expect(d).not.toEqual(instance.answer.canonical);
      }
    }
  });
});

describe('rhythmSum — srs_tags', () => {
  test('emits the bare rhythm_sum atom', () => {
    const instance = rhythmSum({ grade: 1, seed: 1 });
    expect(instance.srs_tags).toEqual(['rhythm_sum']);
  });
});

describe('rhythmSum — fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = rhythmSum({ grade: 1, seed });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});
