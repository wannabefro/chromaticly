// Typed, load-time-validated flat view of the verified decks in
// curriculum/terms-signs-deck.json. The grade 4 and 5 seeds are not verified.

import { z } from 'zod';
import raw from '../../curriculum/terms-signs-deck.json';

const CATEGORIES = ['dynamics', 'tempo', 'other_terms', 'signs'] as const;
type Category = (typeof CATEGORIES)[number];

const TermsEntrySchema = z.object({
  term: z.string().optional(),
  sign: z.string().optional(),
  abbr: z.string().optional(),
  meaning: z.string(),
});

const Grade1DeckSchema = z.object({
  verified: z.literal(true),
  dynamics: z.array(TermsEntrySchema),
  tempo: z.array(TermsEntrySchema),
  other_terms: z.array(TermsEntrySchema),
  signs: z.array(TermsEntrySchema),
});

const DeckSchema = Grade1DeckSchema;

const parsedGrade1 = DeckSchema.parse((raw as { grade_1: unknown }).grade_1);
const parsedGrade2 = DeckSchema.parse((raw as { grade_2: unknown }).grade_2);
const parsedGrade3 = DeckSchema.parse((raw as { grade_3: unknown }).grade_3);

export interface TermsDeckEntry {
  term?: string;
  sign?: string;
  abbr?: string;
  meaning: string;
  category: Category;
}

function flatten(parsed: z.infer<typeof Grade1DeckSchema>): TermsDeckEntry[] {
  return CATEGORIES.flatMap((category) => parsed[category].map((entry) => ({ ...entry, category })));
}

export const TERMS_DECK_G1: TermsDeckEntry[] = flatten(parsedGrade1);
export const TERMS_DECK_G2: TermsDeckEntry[] = flatten(parsedGrade2);
export const TERMS_DECK_G3: TermsDeckEntry[] = flatten(parsedGrade3);

/** Cumulative — the syllabus says "as in preceding grades". */
export function termsDeckForGrade(grade: number): TermsDeckEntry[] {
  if (grade <= 1) return TERMS_DECK_G1;
  if (grade === 2) return [...TERMS_DECK_G1, ...TERMS_DECK_G2];
  return [...TERMS_DECK_G1, ...TERMS_DECK_G2, ...TERMS_DECK_G3];
}
