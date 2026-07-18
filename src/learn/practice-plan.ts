// Practice scheduling glue (U11). Generators are atom-scoped (GenerateOptions
// .atoms), so Practice now targets a specific atom: it uses the SRS signal to
// find the weakest due unlocked atom and serves that atom's template scoped to
// exactly that atom. When nothing is due it falls back to a rotation over
// unlocked templates, scoped to a concrete owning lesson's atoms so a reused
// template (e.g. note_naming across treble/bass/accidentals lessons) still
// renders lesson-faithful content rather than the grade-wide scope.

import { LESSONS } from '../content/lessons';
import { selectDue, type SrsState } from './srs';

// atom → the template and grade of the first lesson/template that lists the atom
// (first-owner-wins; the same atom id reused across two grades is not yet handled —
// see practice-plan's module doc comment and D10 of the grade2-new-major-keys plan).
const ATOM_TEMPLATE = new Map<string, { template: string; grade: number }>();
// template → the atoms and grade of the first unlocked-eligible lesson that owns it,
// used to scope the rotation fallback (a template can be shared across lessons).
const TEMPLATE_LESSON_ATOMS = new Map<string, { atoms: string[]; grade: number }>();
for (const lesson of LESSONS) {
  for (const atom of lesson.atoms) {
    if (!ATOM_TEMPLATE.has(atom)) ATOM_TEMPLATE.set(atom, { template: lesson.templates[0], grade: lesson.grade });
  }
  for (const t of lesson.templates) {
    if (!TEMPLATE_LESSON_ATOMS.has(t)) TEMPLATE_LESSON_ATOMS.set(t, { atoms: lesson.atoms, grade: lesson.grade });
  }
}

/** What Practice should generate next: a template plus the atom scope to pass
 *  as GenerateOptions.atoms, and the grade the owning lesson taught it at (D10) —
 *  generating at the wrong grade fails validation for a scope-shifted atom (e.g.
 *  a grade-2-only key). On the due path the scope is the single due atom
 *  (per-atom review); on the rotation path it is the owning lesson's atoms. */
export interface PracticePick {
  template: string;
  atoms: string[];
  grade: number;
}

export function unlockedTemplates(isUnlocked: (lessonId: string) => boolean): string[] {
  const templates: string[] = [];
  for (const lesson of LESSONS) {
    if (!isUnlocked(lesson.id)) continue;
    for (const t of lesson.templates) if (!templates.includes(t)) templates.push(t);
  }
  return templates;
}

export function unlockedAtomSet(isUnlocked: (lessonId: string) => boolean): Set<string> {
  const set = new Set<string>();
  for (const lesson of LESSONS) {
    if (!isUnlocked(lesson.id)) continue;
    for (const atom of lesson.atoms) set.add(atom);
  }
  return set;
}

/** What Practice should serve next: the weakest due unlocked atom (SRS-driven,
 *  scoped to that atom), else a rotating unlocked template (scoped to its owning
 *  lesson's atoms). null when nothing is unlocked. */
export function nextPracticeTemplate(
  entries: { atom: string; srs: SrsState }[],
  now: number,
  isUnlocked: (lessonId: string) => boolean,
  step: number,
): PracticePick | null {
  const eligible = unlockedAtomSet(isUnlocked);
  for (const atom of selectDue(entries, now, (a) => eligible.has(a))) {
    const owner = ATOM_TEMPLATE.get(atom);
    if (owner) return { template: owner.template, atoms: [atom], grade: owner.grade };
  }
  const templates = unlockedTemplates(isUnlocked);
  if (templates.length === 0) return null;
  const template = templates[step % templates.length];
  const owner = TEMPLATE_LESSON_ATOMS.get(template);
  return { template, atoms: owner?.atoms ?? [], grade: owner?.grade ?? 1 };
}
