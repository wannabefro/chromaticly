// Practice scheduling glue (U11; eligibility reworked in G6 U3). Generators are
// atom-scoped (GenerateOptions.atoms), so Practice targets a specific atom: it
// uses the SRS signal to find the weakest due atom and serves that atom's
// template scoped to exactly that atom. When nothing is due it falls back to a
// rotation over (lesson, template) pairs (D12).
//
// Eligibility is now **per-atom, not per-lesson**: an atom is eligible once the
// learner has attempted it, regardless of which lessons are "unlocked" — because
// under non-linear progression nothing is locked, and review must reach every
// atom the learner has actually met (R4).
//
// The rotation scope is where that distinction bites. A pair used to carry the
// whole lesson's atom array, and 11 atom ids appear in two grades of one strand
// (`rest:semibreve` is in both grade-1 and grade-4 rhythm). Scoping the pool to
// "lessons with an attempted atom" would therefore let one grade-1 answer make a
// grade-4 lesson eligible and let rotation generate its unattempted grade-4
// siblings — material the learner has never seen. So a pair's atoms are the
// INTERSECTION of the lesson's atoms with what has been attempted, and a pair
// whose intersection is empty is not emitted at all.

import { LESSONS } from '../content/lessons';
import type { Strand } from '../content/lessons';
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

/** atom → the strand of the first lesson that lists it, for the per-lane filter (R9). */
const ATOM_STRAND = new Map<string, Strand>();
for (const lesson of LESSONS) {
  for (const atom of lesson.atoms) {
    if (!ATOM_STRAND.has(atom)) ATOM_STRAND.set(atom, lesson.strand);
  }
}

/** What Practice should generate next: a template plus the atom scope to pass
 *  as GenerateOptions.atoms, and the grade the owning lesson taught it at (D10) —
 *  generating at the wrong grade fails validation for a scope-shifted atom (e.g.
 *  a grade-2-only key). On the due path the scope is the single due atom
 *  (per-atom review); on the rotation path it is the attempted subset of the
 *  owning lesson's atoms. */
export interface PracticePick {
  template: string;
  atoms: string[];
  grade: number;
}

/** Every template belonging to a lesson the learner has attempted at least one
 *  atom of. */
export function attemptedTemplates(attempted: Set<string>): string[] {
  const templates: string[] = [];
  for (const lesson of LESSONS) {
    if (!lesson.atoms.some((a) => attempted.has(a))) continue;
    for (const t of lesson.templates) if (!templates.includes(t)) templates.push(t);
  }
  return templates;
}

/** The rotation unit (D12): one pick per (lesson, template it lists), scoped to
 *  the attempted atoms this lesson OWNS. A template shared across lessons —
 *  including across grades, e.g. scale_construction owned by both a grade-2 and a
 *  grade-3 lesson — contributes one entry per owner whose content the learner has
 *  met, so rotation reaches everything they have touched and nothing they have not.
 *
 *  Ownership, not mere membership, is the scope — and it is the second half of the
 *  F5a fix. Intersecting with the attempted set alone stops rotation *generating*
 *  an unattempted grade-4 sibling, but still leaves the grade-4 lesson emitting a
 *  pair for the shared atom at GRADE 4: a learner who has only met grade-1
 *  `rest:quaver` would then be served it inside a grade-3 rhythm scope, so the
 *  stimulus around a familiar atom is material they have never seen. First-owner
 *  is already how the due path resolves a shared atom's grade (ATOM_TEMPLATE), so
 *  applying it here makes both paths agree: a shared atom is always reviewed at the
 *  grade that taught it. */
function rotationPairs(attempted: Set<string>, strand?: Strand): PracticePick[] {
  const pairs: PracticePick[] = [];
  for (const lesson of LESSONS) {
    if (strand !== undefined && lesson.strand !== strand) continue;
    const atoms = lesson.atoms.filter((a) => attempted.has(a) && ATOM_TEMPLATE.get(a)?.grade === lesson.grade);
    if (atoms.length === 0) continue;
    for (const template of lesson.templates) pairs.push({ template, atoms, grade: lesson.grade });
  }
  return pairs;
}

/** The atoms the learner has attempted — the eligibility set, straight off the
 *  store's own record of what it has seen. */
export function attemptedAtomSet(entries: { atom: string }[]): Set<string> {
  return new Set(entries.map((e) => e.atom));
}

/** What Practice should serve next: the weakest due attempted atom (SRS-driven,
 *  scoped to that atom), else a rotating (lesson, attempted-atoms) pair (D12).
 *  null when the learner has attempted nothing — Practice is retention, and there
 *  is nothing yet to retain, so the screen shows its empty state and points at
 *  Learn rather than inventing material.
 *
 *  `strand` narrows both paths to one lane (R9). Cross-lane is the default,
 *  because interleaving strands IS the retention benefit. */
export function nextPracticeTemplate(
  entries: { atom: string; srs: SrsState }[],
  now: number,
  step: number,
  strand?: Strand,
): PracticePick | null {
  const eligible = attemptedAtomSet(entries);
  const inLane = (atom: string) => strand === undefined || ATOM_STRAND.get(atom) === strand;

  for (const atom of selectDue(entries, now, (a) => eligible.has(a) && inLane(a))) {
    const owner = ATOM_TEMPLATE.get(atom);
    if (owner) return { template: owner.template, atoms: [atom], grade: owner.grade };
  }
  const pairs = rotationPairs(eligible, strand);
  if (pairs.length === 0) return null;
  return pairs[step % pairs.length];
}
