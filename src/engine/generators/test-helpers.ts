// Shared test fixtures for the atom-scoped generator contract. Generator specs
// build GenerateOptions through `optsFor` so the (grade, seed, atoms) shape lives
// in one place; `atomsForLesson` pulls a lesson's real declared atoms from the
// curriculum so tests stay in sync with grade1-lessons.json rather than inlining
// atom arrays that can drift.

import { lessonById } from '../../content/lessons';
import type { GenerateOptions } from './types';

/** The declared atoms of a curriculum lesson, e.g. atomsForLesson('treble-notes'). */
export function atomsForLesson(lessonId: string): string[] {
  const lesson = lessonById(lessonId);
  if (!lesson) throw new Error(`test-helpers: no lesson "${lessonId}"`);
  return lesson.atoms;
}

/** GenerateOptions for a fixed seed and atom scope. Generators that ignore atoms
 *  (interval/rhythm/term/bar/add-time) can pass any scope, including []. */
export function optsFor(atoms: string[], seed: number): GenerateOptions {
  return { grade: 1, seed, atoms };
}

/** A valid atom scope for any template id, for tests that iterate every
 *  generator. note_naming (and key_signature_id) derive their pool from atoms
 *  and need a real lesson set; the rest ignore the field. */
export function atomsForTemplate(templateId: string): string[] {
  if (templateId === 'note_naming') return atomsForLesson('treble-notes');
  if (templateId === 'key_signature_id') return atomsForLesson('key-signatures');
  return [];
}
