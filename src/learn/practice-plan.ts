// Practice scheduling glue (U11). Generators are atom-scoped (GenerateOptions
// .atoms), so Practice now targets a specific atom: it uses the SRS signal to
// find the weakest due unlocked atom and serves that atom's template scoped to
// exactly that atom. When nothing is due it falls back to a rotation over
// unlocked templates, scoped to a concrete owning lesson's atoms so a reused
// template (e.g. note_naming across treble/bass/accidentals lessons) still
// renders lesson-faithful content rather than the grade-wide scope.

import { LESSONS } from '../content/lessons';
import { selectDue, type SrsState } from './srs';

// atom → the template that teaches it (first lesson/template that lists the atom).
const ATOM_TEMPLATE = new Map<string, string>();
// template → the atoms of the first unlocked-eligible lesson that owns it,
// used to scope the rotation fallback (a template can be shared across lessons).
const TEMPLATE_LESSON_ATOMS = new Map<string, string[]>();
for (const lesson of LESSONS) {
  for (const atom of lesson.atoms) {
    if (!ATOM_TEMPLATE.has(atom)) ATOM_TEMPLATE.set(atom, lesson.templates[0]);
  }
  for (const t of lesson.templates) {
    if (!TEMPLATE_LESSON_ATOMS.has(t)) TEMPLATE_LESSON_ATOMS.set(t, lesson.atoms);
  }
}

/** What Practice should generate next: a template plus the atom scope to pass
 *  as GenerateOptions.atoms. On the due path the scope is the single due atom
 *  (per-atom review); on the rotation path it is the owning lesson's atoms. */
export interface PracticePick {
  template: string;
  atoms: string[];
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
    const template = ATOM_TEMPLATE.get(atom);
    if (template) return { template, atoms: [atom] };
  }
  const templates = unlockedTemplates(isUnlocked);
  if (templates.length === 0) return null;
  const template = templates[step % templates.length];
  return { template, atoms: TEMPLATE_LESSON_ATOMS.get(template) ?? [] };
}
