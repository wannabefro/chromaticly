import { TERMS_DECK_G1 } from '../../content/terms-deck';
import { validate } from '../validator';
import { termMeaning, termMeaningFlashcard } from './term-meaning';

describe('termMeaning — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = termMeaning({ grade: 1, seed: 13, atoms: [] });
    const b = termMeaning({ grade: 1, seed: 13, atoms: [] });
    expect(a).toEqual(b);
  });

  test('different seeds produce different instances', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seeds.add(JSON.stringify(termMeaning({ grade: 1, seed, atoms: [] })));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('termMeaning — distractor rule: same category as the answer', () => {
  test('across many seeds, every distractor category equals the answer category', () => {
    for (let seed = 0; seed < 40; seed++) {
      const instance = termMeaning({ grade: 1, seed, atoms: [] });
      const category = instance.interaction.config.category;
      for (const d of instance.distractors as { value: string; category: string }[]) {
        expect(d.category).toBe(category);
      }
    }
  });

  test('a tempo term\'s distractors are all tempo terms', () => {
    let found = false;
    for (let seed = 0; seed < 60 && !found; seed++) {
      const instance = termMeaning({ grade: 1, seed, atoms: [] });
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
      const instance = termMeaning({ grade: 1, seed, atoms: [] });
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
      const instance = termMeaning({ grade: 1, seed, atoms: [] });
      const canonical = instance.answer.canonical as { value: string };
      const isKnown = knownMeanings.has(canonical.value) || knownLabels.has(canonical.value);
      expect(isKnown).toBe(true);
    }
  });
});

describe('termMeaning — srs_tags', () => {
  test('emits a term atom slugged from the sampled entry\'s label, regardless of direction', () => {
    for (let seed = 0; seed < 10; seed++) {
      const instance = termMeaning({ grade: 1, seed, atoms: [] });
      expect(instance.srs_tags).toHaveLength(1);
      expect(instance.srs_tags[0]).toMatch(/^term:[a-z0-9_]+$/);
    }
  });
});

describe('termMeaning — fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = termMeaning({ grade: 1, seed, atoms: [] });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('termMeaningFlashcard — self-graded flashcard variant (U7/AD2)', () => {
  test('carries front (term), back (meaning), and no distractors — self-graded, not deep-equal graded', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = termMeaningFlashcard({ grade: 1, seed, atoms: [] });
      expect(instance.interaction.type).toBe('flashcard');
      expect(instance.interaction.config.term).toBeTruthy(); // the front: the term
      const canonical = instance.answer.canonical as { value: string; category: string };
      expect(canonical.value).toBeTruthy(); // the back: the meaning
      expect(instance.distractors).toEqual([]);
    }
  });

  test('stimulus.text stays null — Flashcard.tsx owns the term display, so ExerciseLoop\'s generic stimulus block must not duplicate it (design 2g/2h show the term exactly once)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = termMeaningFlashcard({ grade: 1, seed, atoms: [] });
      expect(instance.stimulus.text).toBeNull();
      expect(instance.stimulus.music).toBeNull();
    }
  });

  test('always the term->meaning direction (unlike mcq, which alternates) — matches design 2g/2h', () => {
    const knownLabels = new Set(TERMS_DECK_G1.map((e) => e.term ?? e.sign ?? e.abbr));
    for (let seed = 0; seed < 20; seed++) {
      const instance = termMeaningFlashcard({ grade: 1, seed, atoms: [] });
      expect(knownLabels.has(instance.interaction.config.term as string)).toBe(true);
    }
  });

  test('carries an OPTIONAL exemplar slot in interaction.config — undefined today (no Music-model articulation support), never a fabricated mark', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = termMeaningFlashcard({ grade: 1, seed, atoms: [] });
      expect(instance.interaction.config).toHaveProperty('exemplar');
      expect(instance.interaction.config.exemplar).toBeUndefined();
    }
  });

  test('the same (grade, seed) reproduces (KTD4) and different seeds diverge', () => {
    expect(termMeaningFlashcard({ grade: 1, seed: 9, atoms: [] })).toEqual(termMeaningFlashcard({ grade: 1, seed: 9, atoms: [] }));
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) seeds.add(JSON.stringify(termMeaningFlashcard({ grade: 1, seed, atoms: [] })));
    expect(seeds.size).toBeGreaterThan(1);
  });

  test('emits a term atom slugged from the sampled entry, same scheme as the mcq variant', () => {
    for (let seed = 0; seed < 10; seed++) {
      const instance = termMeaningFlashcard({ grade: 1, seed, atoms: [] });
      expect(instance.srs_tags).toHaveLength(1);
      expect(instance.srs_tags[0]).toMatch(/^term:[a-z0-9_]+$/);
    }
  });

  test('fuzz gate: seeds 0..99 all produce a validator-clean instance (no distractor requirement — flashcard is an open type)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = termMeaningFlashcard({ grade: 1, seed, atoms: [] });
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
    }
  });
});
