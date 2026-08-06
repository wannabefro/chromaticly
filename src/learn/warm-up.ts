// Which atom the coached warm-up drills, per starting level.
//
// One definition, because five surfaces read it and they must not drift: the
// generator call, the recorded atom, the screen accent, PlanScreen's name for it,
// and LandedScreen's "your first <strand> point" copy. Before this they were five
// literals in three files, and one of them was already wrong (chromaticly-atz).
//
// The atom is a CONSTANT across all three questions and that is deliberate:
// retry-until-correct (KTD3b) guarantees three in a row on one atom, which is what
// makes the warm-up's mastery point real. Variety therefore has to come from the
// generator's seed space, never from swapping atoms mid-loop.
//
// Portable core: no react-native/expo import.

import { alphabetAtom } from '../engine/atoms';
import type { Strand } from '../content/lessons';

export interface WarmUp {
  /** The generator template. Not always the atom id — `alphabet_step` serves
   *  `alphabet:<letter>`, and conflating the two is how the two drift. */
  template: string;
  /** The one atom all three questions credit. */
  atom: string;
  /** The grade handed to the generator, which need not be the learner's. */
  grade: number;
  /** Drives the screen accent and the copy. One accent per screen. */
  strand: Strand;
  /** How PlanScreen names it, one screen earlier. */
  title: string;
}

/** Grades 1-5. `note_value_compare` is grade-1 SCOPE, which is why it is safe to
 *  generate before a profile exists.
 *
 *  It is NOT a grade-1 lesson's atom — it is the sole atom of `rhythm-breve-4`,
 *  so this warm-up hands every new learner a fully 3-starred GRADE 4 lesson.
 *  That is chromaticly-atz, and fixing it is a one-line change here once the
 *  replacement grade-1 rhythm atom is chosen. */
const DEFAULT_WARM_UP: WarmUp = {
  template: 'note_value_compare',
  atom: 'note_value_compare',
  grade: 1,
  strand: 'rhythm',
  title: 'Note values warm-up',
};

/** First steps. A learner who picks this level has never read music, so the
 *  warm-up must not open with notation — `note_value_compare` asks them to
 *  compare two noteheads, and retry-until-correct then turns a question they
 *  cannot read into a wall they brute-force until they guess.
 *
 *  `alphabet:G` needs no notation and no audio, and G is chosen over the other
 *  six letters because its two questions are the wrap ("after G" -> A, the fact
 *  the whole lesson exists for) and an ordinary step ("before G" -> F). */
const WARM_UPS: Record<number, WarmUp> = {
  0: {
    template: 'alphabet_step',
    atom: alphabetAtom('G'),
    grade: 0,
    strand: 'pitch',
    title: 'Musical alphabet warm-up',
  },
};

/** `grade` is the level the learner just chose. Null before they choose, which
 *  only happens if the warm-up is reached out of order — fall back rather than
 *  throw, since an on-ramp must never be the thing that fails. */
export function warmUpFor(grade: number | null | undefined): WarmUp {
  return (grade != null ? WARM_UPS[grade] : undefined) ?? DEFAULT_WARM_UP;
}
