// Practice scheduling glue (U11). Generators are atom-scoped (GenerateOptions
// .atoms), so Practice now targets a specific atom: it uses the SRS signal to
// find the weakest due unlocked atom and serves that atom's template scoped to
// exactly that atom. When nothing is due it falls back to a rotation over
// unlocked (lesson, template) pairs (D12): every unlocked lesson contributes
// one pair per template it lists, scoped to that lesson's own atoms/grade, so
// a template reused across lessons or grades (e.g. scale_construction owned by
// both a grade-2 and a grade-3 lesson) rotates through EVERY unlocked owner
// instead of being permanently pinned to one.

import { LESSONS } from '../content/lessons';
import { selectDue, type SrsState } from './srs';

// atom → the template and grade of the first lesson/template that lists the atom
// (first-owner-wins; the same atom id reused across two grades is not yet handled —
// see practice-plan's module doc comment and D10 of the grade2-new-major-keys plan).
const ATOM_TEMPLATE = new Map<string, { template: string; grade: number }>();
for (const lesson of LESSONS) {
  for (const atom of lesson.atoms) {
    if (!ATOM_TEMPLATE.has(atom)) ATOM_TEMPLATE.set(atom, { template: lesson.templates[0], grade: lesson.grade });
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

/** The rotation unit (D12): one pick per (unlocked lesson, template it lists) pair,
 *  scoped to that lesson's own atoms/grade. A template shared across lessons —
 *  including across grades, e.g. scale_construction owned by both a grade-2 and a
 *  grade-3 lesson — contributes one entry per unlocked owner, so rotation reaches
 *  every unlocked owner's content instead of pinning to a single (first) owner. */
function unlockedRotationPairs(isUnlocked: (lessonId: string) => boolean): PracticePick[] {
  const pairs: PracticePick[] = [];
  for (const lesson of LESSONS) {
    if (!isUnlocked(lesson.id)) continue;
    for (const template of lesson.templates) pairs.push({ template, atoms: lesson.atoms, grade: lesson.grade });
  }
  return pairs;
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
 *  scoped to that atom), else a rotating unlocked (lesson, template) pair (D12),
 *  scoped to that lesson's own atoms/grade. null when nothing is unlocked. */
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
  const pairs = unlockedRotationPairs(isUnlocked);
  if (pairs.length === 0) return null;
  return pairs[step % pairs.length];
}
