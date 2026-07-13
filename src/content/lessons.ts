// Grade 1 lesson sequence (U9): the ordered learn-path Learn-path lite consumes.
// curriculum/grade1-lessons.json is authored data; this module loads and
// zod-validates it, then cross-checks every referenced atom/template against the
// live generator registries and asserts the unlock graph is a single acyclic,
// fully-reachable chain. It fails loud at import time on any dangling reference
// or malformed graph — a typo'd atom id is a bug, not a silently-dropped lesson.

import { z } from 'zod';
import raw from '../../curriculum/grade1-lessons.json';
import { parseAtom } from '../engine/atoms';
import { GENERATORS } from '../engine/generators';
import { TERM_ATOM_SLUGS } from '../engine/generators/term-meaning';
import { diatonicPitchesInRange, G1_CLEFS, G1_KEYS_MAJOR } from '../engine/scope';
import type { Clef } from '../music/types';
import { assertRhythmFillsBars } from './teach-rhythm';

const WorkedExampleSchema = z.object({
  template_id: z.string(),
  grade: z.number().int().min(1).max(5),
  seed: z.number().int(),
});

// The teach/read phase ahead of the exercise set (design 4a/4b). Every field but
// `objectives` and `concept` is optional so a lesson can carry only the cards it
// needs. `example` refs reuse the worked-example shape (a seeded generator call)
// so teach notation comes from the same engine as the exercises.
const TeachSchema = z.object({
  objectives: z.array(z.string().min(1)).min(1),
  concept: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    example: WorkedExampleSchema.nullable().optional(),
  }),
  smartTip: z.string().min(1).nullable().optional(),
  didYouKnow: z.string().min(1).nullable().optional(),
  // The by-ear card's rhythm is authored, not generated: it must be a metrically
  // valid excerpt, which the exercise generators deliberately are not (302.3.5).
  theoryInSound: z
    .object({
      prompt: z.string().min(1),
      timeSignature: z.string().min(3),
      notes: z.array(z.string().min(1)).min(2),
    })
    .nullable()
    .optional(),
});

const LessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  strand: z.enum(['rhythm', 'pitch', 'scales_keys', 'intervals', 'chords', 'terms_signs', 'context']),
  atoms: z.array(z.string()).min(1),
  templates: z.array(z.string()).min(1),
  worked_example: WorkedExampleSchema.nullable().optional(),
  teach: TeachSchema.nullable().optional(),
  unlocks: z.string().nullable(),
});

const LessonsDocSchema = z.object({
  grade: z.number().int().min(1).max(5),
  version: z.string().min(1),
  lessons: z.array(LessonSchema).min(1),
});

export type WorkedExample = z.infer<typeof WorkedExampleSchema>;
export type Teach = z.infer<typeof TeachSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type LessonsDoc = z.infer<typeof LessonsDocSchema>;

/** Throws if an SRS-atom id does not resolve to something a generator can emit. */
export function assertAtomResolves(atom: string): void {
  const { kind, parts } = parseAtom(atom);
  switch (kind) {
    case 'rhythm_sum':
      if (parts.length !== 0) throw new Error(`lessons: malformed rhythm_sum atom "${atom}"`);
      return;
    case 'bar_validity':
      if (parts.length !== 0) throw new Error(`lessons: malformed bar_validity atom "${atom}"`);
      return;
    case 'add_time_signature':
      if (parts.length !== 0) throw new Error(`lessons: malformed add_time_signature atom "${atom}"`);
      return;
    case 'note_read': {
      const [clef, pitch] = parts;
      if (!G1_CLEFS.includes(clef as Clef)) throw new Error(`lessons: atom "${atom}" has clef outside G1 scope`);
      const natural = (pitch ?? '').replace(/[#b]/, '');
      if (!diatonicPitchesInRange(clef as Clef).includes(natural)) {
        throw new Error(`lessons: atom "${atom}" pitch is outside the ${clef} G1 range`);
      }
      return;
    }
    case 'key_sig': {
      const [key] = parts;
      const [tonic, mode] = (key ?? '').split('_');
      if (mode !== 'major' || !G1_KEYS_MAJOR.includes(tonic)) {
        throw new Error(`lessons: atom "${atom}" is not a G1 major key`);
      }
      return;
    }
    case 'interval': {
      const n = Number(parts[0]);
      if (!Number.isInteger(n) || n < 2 || n > 8) throw new Error(`lessons: atom "${atom}" is not a G1 interval (2..8)`);
      return;
    }
    case 'term': {
      const [slug] = parts;
      if (!TERM_ATOM_SLUGS.has(slug)) throw new Error(`lessons: atom "${atom}" references an unknown term`);
      return;
    }
    default:
      throw new Error(`lessons: atom "${atom}" has unknown kind "${kind}"`);
  }
}

/** Assert the `unlocks` links form one acyclic chain reaching every lesson but the first. */
export function assertUnlockGraph(lessons: Lesson[]): void {
  const byId = new Map(lessons.map((l) => [l.id, l]));

  for (const lesson of lessons) {
    if (lesson.unlocks !== null && !byId.has(lesson.unlocks)) {
      throw new Error(`lessons: "${lesson.id}" unlocks unknown lesson "${lesson.unlocks}"`);
    }
  }

  // Reachable set: every lesson named as some lesson's `unlocks` target.
  const unlocked = new Set(lessons.map((l) => l.unlocks).filter((id): id is string => id !== null));
  const roots = lessons.filter((l) => !unlocked.has(l.id));
  if (roots.length !== 1) {
    throw new Error(`lessons: expected exactly one starting lesson, found ${roots.length}`);
  }

  // Walk from the single root; a cycle or fork shows up as a revisit or a miss.
  const seen = new Set<string>();
  let cursor: string | null = roots[0].id;
  while (cursor !== null) {
    if (seen.has(cursor)) throw new Error(`lessons: unlock graph has a cycle at "${cursor}"`);
    seen.add(cursor);
    cursor = byId.get(cursor)!.unlocks;
  }
  if (seen.size !== lessons.length) {
    const stranded = lessons.filter((l) => !seen.has(l.id)).map((l) => l.id);
    throw new Error(`lessons: unreachable from the start: ${stranded.join(', ')}`);
  }
}

function load(): LessonsDoc {
  const doc = LessonsDocSchema.parse(raw);
  for (const lesson of doc.lessons) {
    for (const template of lesson.templates) {
      if (!(template in GENERATORS)) throw new Error(`lessons: "${lesson.id}" uses unknown template "${template}"`);
    }
    for (const atom of lesson.atoms) assertAtomResolves(atom);
    if (lesson.worked_example && !(lesson.worked_example.template_id in GENERATORS)) {
      throw new Error(`lessons: "${lesson.id}" worked example uses unknown template "${lesson.worked_example.template_id}"`);
    }
    const conceptExample = lesson.teach?.concept.example;
    if (conceptExample && !(conceptExample.template_id in GENERATORS)) {
      throw new Error(`lessons: "${lesson.id}" teach example uses unknown template "${conceptExample.template_id}"`);
    }
    // A by-ear rhythm that doesn't fill whole bars would play as nonsense and its
    // beat grid would be a lie — fail at import, not on device.
    if (lesson.teach?.theoryInSound) assertRhythmFillsBars(lesson.teach.theoryInSound);
  }
  assertUnlockGraph(doc.lessons);
  return doc;
}

export const LESSONS_DOC: LessonsDoc = load();
export const LESSONS: Lesson[] = LESSONS_DOC.lessons;

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
