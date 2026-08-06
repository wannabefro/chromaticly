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
  /** The three seeds, in order. Authored rather than 0,1,2: the seed picks the
   *  clef and the answer, and the first three questions of the app are worth
   *  choosing rather than inheriting. */
  seeds: [number, number, number];
  /** Drives the screen accent and the copy. One accent per screen. */
  strand: Strand;
  /** How PlanScreen names it, one screen earlier. */
  title: string;
}

/** Grades 1-5, and the atom belongs to `note-values` — the grade-1 lesson this
 *  warm-up has always been NAMED after (chromaticly-atz).
 *
 *  It used to drill `note_value_compare`, which is grade-1 SCOPE but is the sole
 *  atom of `rhythm-breve-4`, a GRADE 4 lesson. Retry-until-correct guarantees
 *  mastery, so every new learner arrived with that lesson 3-starred and with real
 *  evidence toward grade-4 rhythm readiness. Scope and ownership are different
 *  questions, and only the first one was being asked.
 *
 *  `add_time_signature` was chosen over the lesson's other two atoms because it is
 *  the only one that keeps the designed shape of screens 4-5: `rhythm_sum` draws
 *  no stimulus notation, so the play affordance and its "tap play" coach mark
 *  would have nothing to point at, and `bar_validity` answers with a row of
 *  ticks rather than one choice. */
const DEFAULT_WARM_UP: WarmUp = {
  template: 'add_time_signature',
  atom: 'add_time_signature',
  // Seeds 0,1,2 all draw BASS clef, which would make the first three staves the
  // app ever shows a learner use a clef they meet in lesson 3 (`bass-notes`),
  // not lesson 1 (`treble-notes`). The question is purely rhythmic, so the clef
  // is incidental to it — which is exactly why it should not be the odd one.
  // These three are treble, and answer 3/4, 2/4 and 4/4 rather than repeating.
  seeds: [3, 5, 6],
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
    // 0 and 1 are the two questions this atom has: the wrap, then the step back.
    // 2 repeats the wrap, which is the one worth meeting twice.
    seeds: [0, 1, 2],
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
