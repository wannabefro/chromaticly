// Practice scheduling glue (U11). Generators can't yet target a specific atom,
// so Practice works at *template* granularity: it uses the SRS signal to find
// the weakest due unlocked atom and serves that atom's template, falling back to
// a rotation over unlocked templates when nothing is due. This wires the tested
// SRS ordering (srs.ts) into generation without atom-level targeting — an honest
// MVP compromise, documented so it isn't mistaken for per-atom review.

import { LESSONS } from '../content/lessons';
import { selectDue, type SrsState } from './srs';

// atom → the template that teaches it (first lesson/template that lists the atom).
const ATOM_TEMPLATE = new Map<string, string>();
for (const lesson of LESSONS) {
  for (const atom of lesson.atoms) {
    if (!ATOM_TEMPLATE.has(atom)) ATOM_TEMPLATE.set(atom, lesson.templates[0]);
  }
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

/** The template Practice should serve next: the template of the weakest due
 *  unlocked atom (SRS-driven), else a rotating unlocked template. null when
 *  nothing is unlocked. */
export function nextPracticeTemplate(
  entries: { atom: string; srs: SrsState }[],
  now: number,
  isUnlocked: (lessonId: string) => boolean,
  step: number,
): string | null {
  const eligible = unlockedAtomSet(isUnlocked);
  for (const atom of selectDue(entries, now, (a) => eligible.has(a))) {
    const template = ATOM_TEMPLATE.get(atom);
    if (template) return template;
  }
  const templates = unlockedTemplates(isUnlocked);
  if (templates.length === 0) return null;
  return templates[step % templates.length];
}
