// Grade 1 term_meaning generator (curriculum/exercise-templates.json,
// template_id "term_meaning"). Samples one verified Grade 1 deck entry
// (src/content/terms-deck.ts) and generates either direction — term->meaning
// or meaning->term. Distractors are drawn from the SAME category as the
// answer (the template's diagnostic rule: a tempo term's distractors are
// tempo terms) and carry their own `category` so the validator's
// term_meaning hook can enforce the rule, not just this generator's own
// construction.

import { KB_VERSION } from '../../content/knowledge-base';
import { TERMS_DECK_G1, type TermsDeckEntry } from '../../content/terms-deck';
import { termAtom } from '../atoms';
import { int, mulberry32, pick } from '../rng';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type Direction = 'term_to_meaning' | 'meaning_to_term';

function label(entry: TermsDeckEntry): string {
  return entry.term ?? entry.sign ?? entry.abbr ?? entry.meaning;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function sampleDistinct<T>(rng: () => number, items: T[], n: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = int(rng, 0, pool.length - 1);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const entry = pick(rng, TERMS_DECK_G1);
  const direction = pick<Direction>(rng, ['term_to_meaning', 'meaning_to_term']);

  const pool = TERMS_DECK_G1.filter((e) => e.category === entry.category && e !== entry);
  const distractorEntries = sampleDistinct(rng, pool, 3);

  const termLabel = label(entry);
  const stimulusText = direction === 'term_to_meaning' ? termLabel : entry.meaning;
  const prompt =
    direction === 'term_to_meaning'
      ? `What does "${termLabel}" mean?`
      : `Which term or sign means "${entry.meaning}"?`;

  const canonicalValue = direction === 'term_to_meaning' ? entry.meaning : termLabel;
  const canonical = { value: canonicalValue, category: entry.category };
  const distractors = distractorEntries.map((d) => ({
    value: direction === 'term_to_meaning' ? d.meaning : label(d),
    category: d.category,
  }));

  const categoryLabel = entry.category.replace('_', ' ');

  return {
    id: makeInstanceId('term_meaning', grade, idSeed),
    template_id: 'term_meaning',
    grade,
    strand: 'terms_signs',
    prompt,
    stimulus: { music: null, text: stimulusText },
    interaction: { type: 'mcq', config: { category: entry.category } },
    answer: { canonical, accepted_alternatives: [] },
    distractors,
    hints: [`Think about which ${categoryLabel} terms you already know.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — that's a different ${categoryLabel} term or sign. Review the category and try again.`,
    },
    srs_tags: [termAtom(slugify(termLabel))],
    kb_version: KB_VERSION,
  };
}

export const termMeaning: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed));
