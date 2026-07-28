// Cross-lane advisory prerequisites (G6 U6, R10). The authored answer to "this
// grade-5 pitch unit really does lean on grade-3 intervals" — surfaced as a chip
// that names the skill and taps into it, and NEVER as a gate. Nothing is locked
// under this model (R2); an advisory edge that blocked entry would reintroduce
// the gate under a friendlier name.
//
// Deliberately NOT derived from `lesson.unlocks`. Those are two different graphs
// that happen to both be about order: `unlocks` is within-lane sequence inside one
// grade, this is across lanes and across grades. Deriving one from the other would
// make every unlock edge claim a dependency it was never authored to assert, and
// would make this file impossible to author independently as the matrix fills.
//
// Validated at import like `lessons.ts`, and for the same reason: a dangling edge
// renders a chip pointing at nothing, which is worse than no chip at all. Five
// guards fire here, each with a named error.
//
// Portable core: no react-native/expo import.

import { z } from 'zod';
import raw from '../../curriculum/prerequisites.json';
import { LESSONS, type Strand } from './lessons';

const STRANDS = ['rhythm', 'pitch', 'scales_keys', 'intervals', 'chords', 'terms_signs', 'context'] as const;

const EdgeSchema = z.object({
  /** The lesson that leans on something. */
  lesson: z.string().min(1),
  requiresStrand: z.enum(STRANDS),
  requiresGrade: z.number().int().min(1).max(5),
  /** Learner-facing, completing "leans on <strand> — <why>". Lower case, no full
   *  stop: it is a clause inside the chip, not a sentence. */
  why: z.string().min(1),
});

const DocSchema = z.object({
  version: z.string().min(1),
  _comment: z.string().optional(),
  edges: z.array(EdgeSchema),
});

export type Prerequisite = z.infer<typeof EdgeSchema>;

function load(): Prerequisite[] {
  const parsed = DocSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`prerequisites.json is malformed: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }

  const seen = new Set<string>();
  for (const edge of parsed.data.edges) {
    const lesson = LESSONS.find((l) => l.id === edge.lesson);
    if (!lesson) {
      throw new Error(`prerequisites: edge references unknown lesson "${edge.lesson}"`);
    }

    // A lesson leaning on its own strand is within-lane depth order, which the
    // lane list already shows by putting the earlier grade above. Only a CROSS-lane
    // dependency tells the learner something the screen does not. (This is the rule
    // that disqualified "satb-voice-5 needs two-clef reading" — both sides pitch.)
    if (lesson.strand === edge.requiresStrand) {
      throw new Error(
        `prerequisites: "${edge.lesson}" requires its own strand "${edge.requiresStrand}" — that is within-lane depth order, not a cross-lane prerequisite`,
      );
    }

    // Reachability. An edge pointing at a cell with no content renders a chip the
    // learner cannot act on and can never satisfy — the one failure mode that is
    // strictly worse than having no chip.
    const reachable = LESSONS.some((l) => l.strand === edge.requiresStrand && l.grade === edge.requiresGrade);
    if (!reachable) {
      throw new Error(
        `prerequisites: "${edge.lesson}" requires ${edge.requiresStrand} grade ${edge.requiresGrade}, which has no lessons — the chip would point at nothing`,
      );
    }

    const key = `${edge.lesson}::${edge.requiresStrand}`;
    if (seen.has(key)) {
      throw new Error(`prerequisites: duplicate edge "${edge.lesson}" → ${edge.requiresStrand}`);
    }
    seen.add(key);
  }

  return parsed.data.edges;
}

export const PREREQUISITES: Prerequisite[] = load();

/** What `lessonId` leans on, in authored order. Empty for a lesson with no edge —
 *  the acceptable-gap answer to R10's authoring question: most lessons say nothing,
 *  and silence is not a bug. */
export function prerequisitesFor(lessonId: string): Prerequisite[] {
  return PREREQUISITES.filter((edge) => edge.lesson === lessonId);
}

/** Every strand named as a requirement by any edge — for a caller that wants to
 *  know which lanes are load-bearing without walking the whole list. */
export function requiredStrands(): Strand[] {
  return [...new Set(PREREQUISITES.map((edge) => edge.requiresStrand))];
}
