import { TERMS_DECK_G1 } from '../../content/terms-deck';
import { validate } from '../validator';
import { termMeaning } from './term-meaning';

describe('termMeaning — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = termMeaning({ grade: 1, seed: 13 });
    const b = termMeaning({ grade: 1, seed: 13 });
    expect(a).toEqual(b);
  });

  test('different seeds produce different instances', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seeds.add(JSON.stringify(termMeaning({ grade: 1, seed })));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('termMeaning — distractor rule: same category as the answer', () => {
  test('across many seeds, every distractor category equals the answer category', () => {
    for (let seed = 0; seed < 40; seed++) {
      const instance = termMeaning({ grade: 1, seed });
      const category = instance.interaction.config.category;
      for (const d of instance.distractors as { value: string; category: string }[]) {
        expect(d.category).toBe(category);
      }
    }
  });

  test('a tempo term\'s distractors are all tempo terms', () => {
    let found = false;
    for (let seed = 0; seed < 60 && !found; seed++) {
      const instance = termMeaning({ grade: 1, seed });
      if (instance.interaction.config.category === 'tempo') {
        found = true;
        for (const d of instance.distractors as { value: string; category: string }[]) {
          expect(d.category).toBe('tempo');
        }
      }
    }
    expect(found).toBe(true);
  });
});

describe('termMeaning — both directions generate', () => {
  test('term->meaning items ask "What does ... mean?" and meaning->term items ask "Which term or sign means ...?"', () => {
    const prompts = new Set<'term' | 'meaning'>();
    for (let seed = 0; seed < 40; seed++) {
      const instance = termMeaning({ grade: 1, seed });
      if (instance.prompt.startsWith('What does')) prompts.add('term');
      else if (instance.prompt.startsWith('Which term or sign means')) prompts.add('meaning');
    }
    expect(prompts).toEqual(new Set(['term', 'meaning']));
  });
});

describe('termMeaning — only Grade 1 verified entries are used', () => {
  test('every canonical and distractor value traces back to a TERMS_DECK_G1 entry', () => {
    const knownMeanings = new Set(TERMS_DECK_G1.map((e) => e.meaning));
    const knownLabels = new Set(TERMS_DECK_G1.map((e) => e.term ?? e.sign ?? e.abbr));

    for (let seed = 0; seed < 40; seed++) {
      const instance = termMeaning({ grade: 1, seed });
      const canonical = instance.answer.canonical as { value: string };
      const isKnown = knownMeanings.has(canonical.value) || knownLabels.has(canonical.value);
      expect(isKnown).toBe(true);
    }
  });
});

describe('termMeaning — srs_tags', () => {
  test('emits a term atom slugged from the sampled entry\'s label, regardless of direction', () => {
    for (let seed = 0; seed < 10; seed++) {
      const instance = termMeaning({ grade: 1, seed });
      expect(instance.srs_tags).toHaveLength(1);
      expect(instance.srs_tags[0]).toMatch(/^term:[a-z0-9_]+$/);
    }
  });
});

describe('termMeaning — fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = termMeaning({ grade: 1, seed });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});
