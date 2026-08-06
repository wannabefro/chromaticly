// by-ear card routing (theory-by-ear stage two U2). SetRunner, practice-plan and
// the lessons suite all call this instead of hardcoding a card id (KTD7).

import { writtenAtomOf } from '../atoms';
import type { ExerciseInstance } from '../schema';
import { generate } from './index';
import type { GenerateOptions } from './types';

export const DEFAULT_BY_EAR_CARD = 'by_ear_match';
export const FALLBACK_BY_EAR_CARD = 'by_ear_verify';

interface ByEarLesson {
  id: string;
  grade: number;
  atoms: string[];
  by_ear_atoms?: string[];
  by_ear_source?: string | null;
}

const RESOLVED = new Map<string, string>();

/** The card is a property of the LESSON, not of its source template.
 *  `ornament_recognition` draws 3 notes for ornaments-to-sign-5 and 1 for
 *  ornaments-4, so the same template needs different cards. */
export function byEarCardFor(lesson: ByEarLesson): string {
  const cached = RESOLVED.get(lesson.id);
  if (cached) return cached;

  const source = lesson.by_ear_source ?? undefined;
  const card = source && canServeMatch(lesson, source) ? DEFAULT_BY_EAR_CARD : FALLBACK_BY_EAR_CARD;
  RESOLVED.set(lesson.id, card);
  return card;
}

/** The written twins of the declared by-ear atoms, or the whole pool. Mirrors
 *  `byEarPool`, inlined so content does not import back into the engine. */
function poolOf(lesson: ByEarLesson): string[] {
  const declared = lesson.by_ear_atoms;
  return declared?.length ? declared.map(writtenAtomOf) : lesson.atoms;
}

/** Keep the richer card wherever it works: it asks which note differs, not only
 *  whether one does. Every declared atom must serve it ALONE — Practice hands one
 *  due atom, and a throw there lands in a render with no ErrorBoundary above it. */
function canServeMatch(lesson: ByEarLesson, source: string): boolean {
  return poolOf(lesson).every((atom) => {
    try {
      generate(DEFAULT_BY_EAR_CARD, { grade: lesson.grade, seed: 0, atoms: [atom], source });
      return true;
    } catch {
      return false;
    }
  });
}

/** Practice draws an arbitrary seed, so no load-time probe can prove every seed
 *  builds. by_ear_match throws when its source happens to draw too few notes,
 *  and that lands in a render with no ErrorBoundary — so degrade, never throw. */
export function generateByEar(template: string, opts: GenerateOptions): ExerciseInstance {
  try {
    return generate(template, opts);
  } catch (err) {
    if (template === FALLBACK_BY_EAR_CARD) throw err;
    return generate(FALLBACK_BY_EAR_CARD, opts);
  }
}
