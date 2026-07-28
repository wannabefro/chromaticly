// Per-strand lane depth (G6 U2) — the single derivation behind the Learn tab,
// the profile radar, exam readiness, and the placement result. Four presentations,
// one function: R3's "these must never disagree" becomes structural rather than a
// convention someone has to remember.
//
// Two things this deliberately does NOT do:
//
//   • It never writes. Decay lives here, in a derived reading, never in the
//     stored `mastered` flag — that flag is monotonic by design (mastery.ts) and
//     is read by stars, lesson completion and the level map. Making it decay
//     would un-complete finished lessons.
//   • It never assumes a dense (strand × grade) matrix. Four of the seven strands
//     are stubs today: chords has nothing below grade 4, context is a single
//     grade-1 lesson. A grade with no content is SKIPPED, not failed, or intervals
//     (content at 1, 3, 4) could never read above 1.
//
// Portable core: no react-native/expo import.

import { LESSONS, type Strand } from '../content/lessons';
import type { ProgressStore, SeededDepth } from './store';

/** How far past its due date an atom drifts before it stops counting as held.
 *  An atom is stale when `now > nextDue + SLACK_FACTOR * interval`, so a
 *  well-known atom (long interval) is forgiven for longer than a shaky one —
 *  which is the point: forgetting scales with how well you knew it.
 *
 *  No data behind the 3 yet; it is a single named constant precisely so the
 *  first dogfood can move it. */
export const SLACK_FACTOR = 3;

/** How fast an unconfirmed placement claim sheds a grade, in days.
 *
 *  A seed is a two-minute sample, not evidence of practice. Without expiry a
 *  learner who places at grade 3 and never returns reads grade 3 forever, which
 *  fails R5 for exactly the people placement exists for. It holds at full depth
 *  for one interval, then drops a grade per interval until it says nothing. */
export const SEED_INTERVAL_DAYS = 30;

export interface LaneDepth {
  /** Highest grade `g` such that every content-bearing grade ≤ `g` is held. 0 is a
   *  real value meaning "nothing held here yet" — there is no floor at 1. */
  depth: number;
  /** Every content-bearing grade currently held. Under a sparse matrix this can
   *  include a grade ABOVE an unheld one, so it is not recoverable from `depth`
   *  — which is why the radar's held/content projection needs it (KTD10). */
  heldGrades: number[];
  /** Every grade that has content for this strand. */
  contentGrades: number[];
  /** The depth this lane would read if nothing had gone stale — set only when
   *  decay actually lowered an earned depth, so the UI can say "was 4". */
  decayedFrom?: number;
  source: 'seed' | 'evidence';
}

export const STRAND_ORDER: Strand[] = ['rhythm', 'pitch', 'scales_keys', 'intervals', 'chords', 'terms_signs', 'context'];

/** (strand → grade → atom ids), built once at module load — the same shape and
 *  rationale as practice-plan's ATOM_TEMPLATE map. Atom ids are de-duplicated per
 *  cell: 11 ids appear in two grades of one strand (e.g. `rest:semibreve` in G1
 *  and G4), and each occurrence is genuine evidence for the cell that lists it. */
const MATRIX: Map<string, Map<number, Set<string>>> = new Map();
for (const lesson of LESSONS) {
  let byGrade = MATRIX.get(lesson.strand);
  if (!byGrade) {
    byGrade = new Map();
    MATRIX.set(lesson.strand, byGrade);
  }
  let atoms = byGrade.get(lesson.grade);
  if (!atoms) {
    atoms = new Set();
    byGrade.set(lesson.grade, atoms);
  }
  for (const atom of lesson.atoms) atoms.add(atom);
}

/** The grades that have content for `strand`, ascending. */
export function contentGradesFor(strand: Strand): number[] {
  return [...(MATRIX.get(strand)?.keys() ?? [])].sort((a, b) => a - b);
}

/** The atom ids `strand` teaches at `grade`. */
export function atomsFor(strand: Strand, grade: number): string[] {
  return [...(MATRIX.get(strand)?.get(grade) ?? [])];
}

/** A seed's depth after expiry. Whole grades shed per elapsed interval, floored
 *  at 0. `day` is measured in whole days since the epoch, like every other time
 *  in the engine. */
export function decayedSeedDepth(seed: SeededDepth, now: number): number {
  const elapsed = Math.max(0, now - seed.day);
  return Math.max(0, seed.depth - Math.floor(elapsed / SEED_INTERVAL_DAYS));
}

/** Whether an atom has drifted past its slack window.
 *
 *  The interval comes from the atom's own `nextDue - lastReviewed`, not from
 *  `BOX_INTERVALS[box]`: the graded (flashcard) path computes an ease-scaled
 *  interval independent of the box table, so a box-table read would call a
 *  perfectly fresh Easy card stale. Floored at 1 so a box-0 atom (interval 0)
 *  gets a real window rather than being stale the moment it is written — a
 *  different floor from the migration's, which deliberately uses 0 because there
 *  the quantity is a due DATE, not a window. */
function isStale(srs: { lastReviewed: number; nextDue: number }, now: number): boolean {
  const interval = Math.max(1, srs.nextDue - srs.lastReviewed);
  return now > srs.nextDue + SLACK_FACTOR * interval;
}

/** A cell is held when every atom in it is mastered AND at most half are stale.
 *  One lapsed atom in six must not drop a whole grade; a majority must. */
function cellHeld(store: ProgressStore, strand: Strand, grade: number, now: number, ignoreStaleness: boolean): boolean {
  const atoms = atomsFor(strand, grade);
  if (atoms.length === 0) return false;
  let stale = 0;
  for (const atom of atoms) {
    const progress = store.getAtom(atom);
    if (!progress.mastery.mastered) return false;
    if (!ignoreStaleness && isStale(progress.srs, now)) stale += 1;
  }
  return stale * 2 <= atoms.length;
}

/** The highest `g` whose content-bearing predecessors are all held. Contiguous by
 *  construction: holding G4 while G3 is unheld reads 1, not 4 — but `heldGrades`
 *  still records the G4 hold, because the radar counts what you know rather than
 *  how far you have got. */
function depthFrom(contentGrades: number[], held: Set<number>): number {
  let depth = 0;
  for (const grade of contentGrades) {
    if (!held.has(grade)) break;
    depth = grade;
  }
  return depth;
}

/** The most recent write sequence across a strand's atoms — 0 when untouched.
 *  Derived, never stored: it is only ever compared against a seed's `seq`. */
function lastAttemptSeq(store: ProgressStore, strand: Strand): number {
  let max = 0;
  for (const grade of contentGradesFor(strand)) {
    for (const atom of atomsFor(strand, grade)) {
      const seq = store.getAtom(atom).srs.seq ?? 0;
      if (seq > max) max = seq;
    }
  }
  return max;
}

function depthForStrand(store: ProgressStore, strand: Strand, now: number): LaneDepth {
  const contentGrades = contentGradesFor(strand);

  // 1. Authority. A seed governs while it is at least as recent as anything the
  //    learner has actually done in this strand. Compared by `seq`, never by day:
  //    a re-test and a practice attempt on the SAME day must still order, and
  //    that is precisely the case the per-skill re-test exists for.
  const seed = store.seededDepthFor(strand);
  if (seed && seed.seq >= lastAttemptSeq(store, strand)) {
    const depth = decayedSeedDepth(seed, now);
    return {
      depth,
      // A seed asserts a contiguous claim ("I'm about grade 3"), so every content
      // grade at or below it is held — exact, not an approximation.
      heldGrades: contentGrades.filter((g) => g <= depth),
      contentGrades,
      ...(depth < seed.depth ? { decayedFrom: seed.depth } : {}),
      source: 'seed' as const,
    };
  }

  // 2. Evidence.
  const held = new Set(contentGrades.filter((g) => cellHeld(store, strand, g, now, false)));
  const heldIgnoringStaleness = new Set(contentGrades.filter((g) => cellHeld(store, strand, g, now, true)));

  const depth = depthFrom(contentGrades, held);
  const undecayed = depthFrom(contentGrades, heldIgnoringStaleness);

  return {
    depth,
    heldGrades: contentGrades.filter((g) => held.has(g)),
    contentGrades,
    ...(undecayed > depth ? { decayedFrom: undecayed } : {}),
    source: 'evidence' as const,
  };
}

/** Every lane's depth at `now` (whole days since the epoch). The one derivation —
 *  callers present it differently, they never re-derive it. */
export function laneDepths(store: ProgressStore, now: number): Record<Strand, LaneDepth> {
  return Object.fromEntries(STRAND_ORDER.map((strand) => [strand, depthForStrand(store, strand, now)])) as Record<Strand, LaneDepth>;
}
