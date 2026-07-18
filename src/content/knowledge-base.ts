// Typed, load-time-validated view of curriculum/knowledge-base.json (KTD7:
// content data is shipped as typed static JSON, validated at load with zod;
// malformed data fails loud — parse() throws rather than swallowing errors).

import { z } from 'zod';
import raw from '../../curriculum/knowledge-base.json';

const NoteValueEntrySchema = z.object({
  beats_in_crotchets: z.number(),
  us_name: z.string(),
});

const Grade1ScopeSchema = z.object({
  clefs: z.array(z.string()),
  time_signatures: z.array(z.string()),
  note_values: z.array(z.string()),
  rests: z.array(z.string()),
  keys_major: z.array(z.string()),
  keys_minor: z.array(z.string()),
  intervals: z.object({
    above_tonic_only: z.boolean(),
    naming: z.string(),
    max: z.string(),
  }),
});

const Grade2AddsSchema = z.object({
  time_signatures: z.array(z.string()),
  rhythm_devices: z.array(z.string()),
  pitch_range: z.object({
    ledger_lines: z.string(),
  }),
  keys_major: z.array(z.string()),
  keys_minor: z.array(z.string()),
  minor_forms: z.array(z.string()),
  scale_knowledge: z.array(z.string()),
});

const KnowledgeBaseSchema = z.object({
  theory_data: z.object({
    note_values: z.record(z.string(), NoteValueEntrySchema),
  }),
  grade_scopes: z.object({
    '1': Grade1ScopeSchema,
    '2': z.object({
      adds: Grade2AddsSchema,
    }),
  }),
});

const parsed = KnowledgeBaseSchema.parse(raw);

export const KB = {
  noteValues: parsed.theory_data.note_values,
  grade1: parsed.grade_scopes['1'],
  grade2Adds: parsed.grade_scopes['2'].adds,
};

// knowledge-base.json carries no version field; this constant is the app's
// content-versioning anchor per KTD4/KTD9 (reproducibility across content updates).
export const KB_VERSION = 'g1-2026-07-10';
