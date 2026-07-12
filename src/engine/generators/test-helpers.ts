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
