// Multi-grade lesson loader (U9, grade-2-foundation U1/U2). Each
// curriculum/gradeN-lessons.json is authored data; loadDoc zod-validates one
// doc, cross-checks every referenced atom/template against the live generator
// registries at that doc's grade, and asserts its unlock graph is a single
// acyclic, fully-reachable chain. It fails loud at import time on any
// dangling reference, malformed graph, or lesson id reused across grades.
// grade1-lessons.json and grade2-lessons.json are both registered; Level 2
// stays static-locked (levels.ts) until a later unit wires up dynamic
// unlock, so grade-2 content loads and is pinned but isn't reachable yet.

import { z } from 'zod';
import grade1Raw from '../../curriculum/grade1-lessons.json';
import grade2Raw from '../../curriculum/grade2-lessons.json';
import grade3Raw from '../../curriculum/grade3-lessons.json';
import { CONTEXT_KINDS, parseAtom } from '../engine/atoms';
import { GENERATORS } from '../engine/generators';
import { BAR_PROPERTIES } from '../engine/generators/find-the-bar';
import { TERM_ATOM_SLUGS } from '../engine/generators/term-meaning';
import { isCompoundTimeSignature } from '../engine/metre';
import { diatonicPitchesInRange, renderableTimeSignatures, scopeForGrade } from '../engine/scope';
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
// `grade` is stamped onto every lesson at load time from its doc's grade — it
// is not part of the authored JSON or the zod schema (see loadDoc).
export type Lesson = z.infer<typeof LessonSchema> & { grade: number };
export type LessonsDoc = Omit<z.infer<typeof LessonsDocSchema>, 'lessons'> & { lessons: Lesson[] };

/** Throws if an SRS-atom id does not resolve to something a generator can emit at `grade`. */
export function assertAtomResolves(atom: string, grade: number): void {
  const { kind, parts } = parseAtom(atom);
  switch (kind) {
    case 'rhythm_sum':
      if (parts.length !== 0) throw new Error(`lessons: malformed rhythm_sum atom "${atom}"`);
      return;
    case 'bar_validity':
      if (parts.length !== 0) throw new Error(`lessons: malformed bar_validity atom "${atom}"`);
      return;
    case 'add_time_signature': {
      if (parts.length === 0) return; // legacy bare atom (grade 1)
      if (parts.length !== 1) throw new Error(`lessons: malformed add_time_signature atom "${atom}"`);
      const [sig] = parts;
      if (!scopeForGrade(grade).timeSignatures.includes(sig) || !renderableTimeSignatures(grade).includes(sig)) {
        throw new Error(`lessons: atom "${atom}" is not a renderable G${grade} time signature`);
      }
      return;
    }
    case 'metre': {
      if (parts.length !== 1) throw new Error(`lessons: malformed metre atom "${atom}"`);
      const [sig] = parts;
      if (!scopeForGrade(grade).timeSignatures.includes(sig) || !renderableTimeSignatures(grade).includes(sig)) {
        throw new Error(`lessons: atom "${atom}" is not a renderable G${grade} time signature`);
      }
      return;
    }
    case 'anacrusis': {
      if (parts.length !== 1) throw new Error(`lessons: malformed anacrusis atom "${atom}"`);
      const [sig] = parts;
      if (
        isCompoundTimeSignature(sig) ||
        !renderableTimeSignatures(grade).includes(sig) ||
        !scopeForGrade(grade).rhythmDevices.includes('anacrusis')
      ) {
        throw new Error(`lessons: atom "${atom}" is not a renderable G${grade} simple anacrusis signature`);
      }
      return;
    }
    case 'note_read': {
      const [clef, pitch] = parts;
      if (!scopeForGrade(grade).clefs.includes(clef as Clef)) throw new Error(`lessons: atom "${atom}" has clef outside G${grade} scope`);
      const natural = (pitch ?? '').replace(/[#b]/, '');
      if (!diatonicPitchesInRange(clef as Clef, grade).includes(natural)) {
        throw new Error(`lessons: atom "${atom}" pitch is outside the ${clef} G${grade} range`);
      }
      return;
    }
    case 'key_sig': {
      const [key] = parts;
      const [tonic, mode] = (key ?? '').split('_');
      if (mode === 'major') {
        if (!scopeForGrade(grade).keysMajor.includes(tonic)) {
          throw new Error(`lessons: atom "${atom}" is not a G${grade} major key`);
        }
        return;
      }
      if (mode === 'minor') {
        if (!scopeForGrade(grade).keysMinor.includes(tonic)) {
          throw new Error(`lessons: atom "${atom}" is not a G${grade} minor key`);
        }
        return;
      }
      throw new Error(`lessons: atom "${atom}" is not a G${grade} key signature`);
    }
    case 'scale': {
      const [spec] = parts;
      const [tonic, mode, ...formParts] = (spec ?? '').split('_');
      const form = formParts.join('_');
      const scope = scopeForGrade(grade);
      if (mode !== 'minor' || !scope.keysMinor.includes(tonic) || !scope.minorForms.includes(form)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} scale`);
      }
      return;
    }
    case 'interval': {
      // Grade-agnostic: the above-tonic 2nd..octave range holds at every grade
      // this curriculum currently covers, so there is no scope call here.
      const n = Number(parts[0]);
      if (!Number.isInteger(n) || n < 2 || n > 8) throw new Error(`lessons: atom "${atom}" is not a G1 interval (2..8)`);
      return;
    }
    case 'interval_type': {
      // D4: only resolves where the grade's namingStyle is the number+type
      // widening (grade 3+) — a grade-1/2 lesson can never own this atom kind.
      const n = Number(parts[0]);
      if (!Number.isInteger(n) || n < 2 || n > 8) {
        throw new Error(`lessons: atom "${atom}" is not a G3 interval (2..8)`);
      }
      if (scopeForGrade(grade).intervalRule.namingStyle !== 'number_and_type') {
        throw new Error(`lessons: atom "${atom}" is not a number+type interval at grade ${grade}`);
      }
      return;
    }
    case 'term': {
      const [slug] = parts;
      if (!TERM_ATOM_SLUGS.has(slug)) throw new Error(`lessons: atom "${atom}" references an unknown term`);
      return;
    }
    case 'context': {
      const [kind] = parts;
      if (!CONTEXT_KINDS.includes(kind)) {
        throw new Error(`lessons: atom "${atom}" is not a Music-in-Context sub-question`);
      }
      return;
    }
    case 'find_bar': {
      const [property] = parts;
      if (!(BAR_PROPERTIES as readonly string[]).includes(property)) {
        throw new Error(`lessons: atom "${atom}" is not a find-the-bar property`);
      }
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

/** Parses, cross-checks, and returns one grade's lesson doc, with `grade` stamped onto every lesson. */
export function loadDoc(raw: unknown): LessonsDoc {
  const parsed = LessonsDocSchema.parse(raw);
  const lessons: Lesson[] = parsed.lessons.map((lesson) => ({ ...lesson, grade: parsed.grade }));

  for (const lesson of lessons) {
    for (const template of lesson.templates) {
      if (!(template in GENERATORS)) throw new Error(`lessons: "${lesson.id}" uses unknown template "${template}"`);
    }
    for (const atom of lesson.atoms) assertAtomResolves(atom, lesson.grade);
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
  assertUnlockGraph(lessons);

  return { ...parsed, lessons };
}

/** Throws if any lesson id is reused across two different grade docs (within-doc dupes are a separate concern). */
export function assertNoCrossDocDuplicateIds(docs: readonly LessonsDoc[]): void {
  const docIndexesById = new Map<string, Set<number>>();
  docs.forEach((doc, docIndex) => {
    for (const lesson of doc.lessons) {
      const docIndexes = docIndexesById.get(lesson.id) ?? new Set<number>();
      docIndexes.add(docIndex);
      docIndexesById.set(lesson.id, docIndexes);
    }
  });
  for (const [id, docIndexes] of docIndexesById) {
    if (docIndexes.size > 1) {
      const grades = [...docIndexes].map((i) => docs[i].grade);
      throw new Error(`lessons: id "${id}" is used by more than one grade doc (grades ${grades.join(', ')})`);
    }
  }
}

// Grade-1 first — order matters for the interim single-root-per-grade unlock
// behavior (see U2 of the grade2-new-major-keys plan).
const GRADE_DOCS: readonly LessonsDoc[] = [loadDoc(grade1Raw), loadDoc(grade2Raw), loadDoc(grade3Raw)];

assertNoCrossDocDuplicateIds(GRADE_DOCS);

export const LESSONS_BY_GRADE: Record<number, Lesson[]> = Object.fromEntries(GRADE_DOCS.map((doc) => [doc.grade, doc.lessons]));

// The grade-1 doc specifically — some grade-1-only surfaces still read this directly.
export const LESSONS_DOC: LessonsDoc = GRADE_DOCS[0];

// Concatenated in grade order so a second registered doc extends this, not rewrites it.
export const LESSONS: Lesson[] = Object.keys(LESSONS_BY_GRADE)
  .map(Number)
  .sort((a, b) => a - b)
  .flatMap((grade) => LESSONS_BY_GRADE[grade]);

export function lessonsForGrade(grade: number): Lesson[] {
  return LESSONS_BY_GRADE[grade] ?? [];
}

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
