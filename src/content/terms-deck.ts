// Typed, load-time-validated flat view of curriculum/terms-signs-deck.json's
// grade_1 (verified) category arrays only. grade_2_seed..grade_5_seed carry
// verified:false and a different shape (flat `entries`, not categorized) —
// they are intentionally never read or validated against the grade_1 schema.

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

const parsedGrade1 = Grade1DeckSchema.parse((raw as { grade_1: unknown }).grade_1);

export interface TermsDeckEntry {
  term?: string;
  sign?: string;
  abbr?: string;
  meaning: string;
  category: Category;
}

export const TERMS_DECK_G1: TermsDeckEntry[] = CATEGORIES.flatMap((category) =>
  parsedGrade1[category].map((entry) => ({ ...entry, category }))
);
