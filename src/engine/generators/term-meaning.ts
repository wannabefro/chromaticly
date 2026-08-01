// term_meaning generator, Grades 1 to 3. It asks either direction, and every
// distractor shares the answer's category — a rule the validator re-checks.

import { KB_VERSION } from '../../content/knowledge-base';
import {
  termsDeckForGrade,
  TERMS_DECK_G1,
  TERMS_DECK_G2,
  TERMS_DECK_G3,
  TERMS_DECK_G4,
  TERMS_DECK_G5,
  type TermsDeckEntry,
} from '../../content/terms-deck';
import type { Music } from '../../music/types';
import { termAtom } from '../atoms';
import { int, mulberry32, pick } from '../rng';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type Direction = 'term_to_meaning' | 'meaning_to_term';

// "signs" and "other_terms" are not adjectives, so the old `${category} terms`
// wording produced "signs terms" and "other terms terms".
const CATEGORY_PLURAL: Record<string, string> = {
  tempo: 'tempo terms',
  dynamics: 'dynamic markings',
  signs: 'signs',
  other_terms: 'terms',
};

const CATEGORY_SINGULAR: Record<string, string> = {
  tempo: 'tempo term',
  dynamics: 'dynamic marking',
  signs: 'sign',
  other_terms: 'term',
};

function categoryPlural(category: string): string {
  return CATEGORY_PLURAL[category] ?? `${category.replace('_', ' ')} terms`;
}

function categorySingular(category: string): string {
  return CATEGORY_SINGULAR[category] ?? `${category.replace('_', ' ')} term`;
}

function label(entry: TermsDeckEntry): string {
  return entry.term ?? entry.sign ?? entry.abbr ?? entry.meaning;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Every term-atom slug the generator can emit — the authoritative vocabulary
 *  for cross-checking `term:<slug>` references (e.g. lesson data). */
export const TERM_ATOM_SLUGS: ReadonlySet<string> = new Set(
  [...TERMS_DECK_G1, ...TERMS_DECK_G2, ...TERMS_DECK_G3, ...TERMS_DECK_G4, ...TERMS_DECK_G5].map((e) => slugify(label(e))),
);

export function termAtomSlugsForGrade(grade: number): ReadonlySet<string> {
  return new Set(termsDeckForGrade(grade).map((e) => slugify(label(e))));
}

/** The lesson's slice of the deck. Grade 1 used to teach the whole 31-entry deck
 *  in one lesson, so sampling the deck and sampling the lesson were the same
 *  thing and `opts.atoms` could be ignored. The pedagogy split (dynamics /
 *  tempo / signs) makes them different: an unscoped draw hands a dynamics
 *  lesson `allegro`, and the credit lands on an atom that lesson never declared
 *  — work the learner did that the app will not count.
 *
 *  An empty intersection falls back to the whole deck rather than throwing:
 *  callers outside the lesson loop (SRS review, the exam paper) pass atom lists
 *  that are not term atoms at all, and the deck-wide draw is right for them. */
function deckFor(atoms: string[], grade: number): TermsDeckEntry[] {
  const full = termsDeckForGrade(grade);
  const wanted = new Set(atoms.filter((atom) => atom.startsWith('term:')).map((atom) => atom.slice(5)));
  if (wanted.size === 0) return full;
  const scoped = full.filter((entry) => wanted.has(slugify(label(entry))));
  return scoped.length > 0 ? scoped : full;
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

function build(contentSeed: number, grade: number, idSeed: number, deck: TermsDeckEntry[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const entry = pick(rng, deck);
  const direction = pick<Direction>(rng, ['term_to_meaning', 'meaning_to_term']);

  // The grade's whole deck: one lesson rarely holds three same-category wrongs.
  // A same-meaning entry is barred, and no two distractors may share a meaning
  // either: "which term means slow?" has four right answers across the
  // languages (adagio, lento, lent, langsam), and the other direction would
  // print the same option text twice.
  const seenMeanings = new Set([entry.meaning]);
  const pool = termsDeckForGrade(grade).filter((e) => {
    if (e.category !== entry.category || e === entry || seenMeanings.has(e.meaning)) return false;
    seenMeanings.add(e.meaning);
    return true;
  });
  const distractorEntries = sampleDistinct(rng, pool, 3);

  const termLabel = label(entry);
  const stimulusText = direction === 'term_to_meaning' ? termLabel : entry.meaning;
  // Grade 5 mixes German with Italian, and telling them apart is the skill.
  const LANGS: Record<string, string> = { de: 'German', fr: 'French' };
  const langName = entry.lang ? LANGS[entry.lang] : undefined;
  const prompt =
    direction === 'term_to_meaning'
      ? `What does ${langName ? `the ${langName} term ` : ''}"${termLabel}" mean?`
      : `Which term or sign means "${entry.meaning}"?`;

  const canonicalValue = direction === 'term_to_meaning' ? entry.meaning : termLabel;
  const canonical = { value: canonicalValue, category: entry.category };
  const distractors = distractorEntries.map((d) => ({
    value: direction === 'term_to_meaning' ? d.meaning : label(d),
    category: d.category,
  }));

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
    hints: [`Think about which ${categoryPlural(entry.category)} you already know.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — that's a different ${categorySingular(entry.category)}. Review the category and try again.`,
    },
    srs_tags: [termAtom(slugify(termLabel))],
    kb_version: KB_VERSION,
  };
}

export const termMeaning: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, deckFor(opts.atoms, opts.grade)));

// --- Flashcard variant (U7/AD2): term recall as a self-graded flashcard —
// front = term, revealed = meaning + an optional notated exemplar, no
// distractors (grading is self-reported, not deep-equal). A separate
// template_id ("term_meaning_flashcard") rather than a mode flag on the
// existing generator, so `term_meaning` (mcq) stays byte-identical for every
// existing caller/test and U9 can point a lesson's `templates` at the
// flashcard id the same way it points at any other generator.

/** The current Music model has no articulation/dynamics/tempo markup (no
 *  staccato dot, accent, hairpin, or tempo marking — see src/music/types.ts),
 *  so no G1 term/sign can be honestly rendered as a notated exemplar without
 *  inventing a mark the renderer can't draw. This stays undefined for every
 *  entry until the Music model grows that vocabulary; the field is wired
 *  end-to-end (here -> Flashcard.tsx -> NotationCard) so populating it later
 *  needs no further plumbing. */
function exemplarFor(_entry: TermsDeckEntry): Music | undefined {
  return undefined;
}

function buildFlashcard(contentSeed: number, grade: number, idSeed: number, deck: TermsDeckEntry[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const entry = pick(rng, deck);
  const termLabel = label(entry);

  return {
    id: makeInstanceId('term_meaning_flashcard', grade, idSeed),
    template_id: 'term_meaning_flashcard',
    grade,
    strand: 'terms_signs',
    prompt: `What does "${termLabel}" mean?`,
    // stimulus.text stays null (unlike the mcq variant): Flashcard.tsx owns the
    // whole front/back card, including the term, so ExerciseLoop's generic
    // stimulus-text block must not ALSO render it above the card (design 2g/2h
    // show the term exactly once, inside the card).
    stimulus: { music: null, text: null },
    interaction: { type: 'flashcard', config: { term: termLabel, category: entry.category, exemplar: exemplarFor(entry) } },
    answer: { canonical: { value: entry.meaning, category: entry.category }, accepted_alternatives: [] },
    distractors: [],
    hints: [],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — that's a different ${categorySingular(entry.category)}.`,
    },
    srs_tags: [termAtom(slugify(termLabel))],
    kb_version: KB_VERSION,
  };
}

export const termMeaningFlashcard: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) =>
    buildFlashcard(candidateSeed, opts.grade, opts.seed, deckFor(opts.atoms, opts.grade)),
  );
