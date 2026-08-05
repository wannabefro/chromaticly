// The placement engine (G6 U10, design A1/A2 + 7c). One adaptive walk serves both
// the first-run mixed pass and the per-skill re-test ladder (KTD6) — the same
// stepping rule, a different question budget and a different starting grade.
//
// What this module is NOT:
//
//  • It never writes, and never stamps. It returns bare depths. `day` needs the
//    clock and `seq` needs the store counter, and both are U11's to apply at the
//    moment a measurement resolves (KTD6's three roles: measure, stamp, persist).
//    The return type has no room for either, so the split is unrepresentable
//    rather than merely documented.
//  • It never assumes a dense (strand × grade) matrix, and never assumes every
//    cell can be marked. Both assumptions are false today — see LADDERS below.
//
// Portable core: no react-native/expo import, and no `src/ui` import either. The
// self-graded check reads `instance.interaction.type` against
// `SELF_GRADED_INTERACTIONS` precisely so it does not need the UI registry.

import type { Strand } from '../content/lessons';
import { LESSONS } from '../content/lessons';
import { generate } from '../engine/generators';
import { SELF_GRADED_INTERACTIONS, type ExerciseInstance } from '../engine/schema';
import { atomsFor, contentGradesFor, STRAND_ORDER } from './lane-depth';

/** One item per content-bearing strand on the first-run pass. Seven strands have
 *  content, so the pass is seven questions — the "~8 items" A1 promises. */
export const MIXED_PASS_BUDGET = 1;

/** R7a's "up to four questions" on one skill. `up to` is load-bearing: the
 *  never-revisit rule below usually stops a short ladder well before this. */
export const LADDER_BUDGET = 4;

/** A fixed seed for the load-time probe that decides whether a cell is testable.
 *  Deterministic on purpose — a cell's testability must not depend on which
 *  question the learner happened to draw. */
const PROBE_SEED = 7;

/** A (strand, grade) cell that has content but no question this engine can mark,
 *  with the reason. Exported rather than swallowed: a cell dropping out of a
 *  ladder silently is how a strand quietly stops being measurable. */
export interface PlacementSkip {
  strand: Strand;
  grade: number;
  template: string;
  reason: 'self-graded' | 'no-instance';
}

const skips: PlacementSkip[] = [];
export const PLACEMENT_SKIPS: readonly PlacementSkip[] = skips;

/** (strand → grade → the templates its lessons declare), in authored order. */
const TEMPLATES: Map<string, Map<number, string[]>> = new Map();
for (const lesson of LESSONS) {
  let byGrade = TEMPLATES.get(lesson.strand);
  if (!byGrade) {
    byGrade = new Map();
    TEMPLATES.set(lesson.strand, byGrade);
  }
  const list = byGrade.get(lesson.grade) ?? [];
  for (const template of lesson.templates) if (!list.includes(template)) list.push(template);
  byGrade.set(lesson.grade, list);
}

/** The first template at this cell whose generated item the APP can mark, or
 *  undefined when the cell has none.
 *
 *  Two ways a template drops out, and both are real today:
 *   • It generates a self-graded item. `term_meaning_flashcard` asks the learner
 *     to mark themselves, so it would measure confidence.
 *   • It throws. `key_signature_id` cannot build a valid instance from the
 *     scales_keys grade-2 or grade-4 atom sets, and a generator that throws is
 *     not a question. */
const markable: Map<string, string | undefined> = new Map();

function markableTemplate(strand: Strand, grade: number): string | undefined {
  // Memoised, and not only for speed: `walkItem` calls this on every draw, so an
  // unmemoised version re-probed the cell and pushed a duplicate `PLACEMENT_SKIPS`
  // entry per question asked. The list is meant to be read as "what this build
  // cannot mark", which a growing one is not.
  const key = `${strand}:${grade}`;
  if (markable.has(key)) return markable.get(key);
  const resolved = probeCell(strand, grade);
  markable.set(key, resolved);
  return resolved;
}

function probeCell(strand: Strand, grade: number): string | undefined {
  // Placement decides exam-track grade, so it probes the WRITTEN pool only (R4).
  const atoms = atomsFor(strand, grade, true);
  for (const template of TEMPLATES.get(strand)?.get(grade) ?? []) {
    let instance: ExerciseInstance;
    try {
      instance = generate(template, { grade, seed: PROBE_SEED, atoms });
    } catch {
      skips.push({ strand, grade, template, reason: 'no-instance' });
      continue;
    }
    if (SELF_GRADED_INTERACTIONS.has(instance.interaction.type)) {
      skips.push({ strand, grade, template, reason: 'self-graded' });
      continue;
    }
    return template;
  }
  return undefined;
}

/** Per strand: the grades that both have content AND can be marked, ascending.
 *
 *  Built whole at load, then walked — never filtered during the walk. Filtering
 *  mid-walk lets a strand start on a cell it must skip and then terminate with no
 *  question asked, which reads as a measured 0. Sparse and ragged by nature:
 *  chords is [4, 5], intervals is [1, 3, 4], context is [1]. */
const LADDERS: Map<Strand, number[]> = new Map(
  STRAND_ORDER.map((strand) => [strand, contentGradesFor(strand).filter((grade) => markableTemplate(strand, grade) !== undefined)]),
);

/** The grades `strand` can be placed at, ascending. Empty for a strand with no
 *  markable content — such a strand is never offered an item and never seeded. */
export function ladderFor(strand: Strand): number[] {
  return LADDERS.get(strand) ?? [];
}

/** Every strand the mixed pass can ask about. */
export function placeableStrands(): Strand[] {
  return STRAND_ORDER.filter((strand) => ladderFor(strand).length > 0);
}

/** One strand's walk. `pending` is the grade of the question waiting to be
 *  answered; `null` means the walk is finished and its depth is final. */
export interface StrandWalk {
  strand: Strand;
  ladder: number[];
  budget: number;
  /** Every grade asked, in order. Never contains a repeat. */
  asked: number[];
  /** Every grade answered correctly. */
  passed: number[];
  pending: number | null;
}

/** Where a walk opens.
 *
 *  The mixed pass starts at the ladder's LOWER MEDIAN — `ladder[floor((n-1)/2)]`.
 *  An even-length ladder has no middle, and on a one-item pass the choice IS the
 *  measurement, so it is pinned rather than left to rounding: chords [4,5] opens
 *  at 4, scales_keys [1,2,3,4] at 2.
 *
 *  A re-test starts at the strand's current depth SNAPPED onto the ladder — the
 *  nearest ladder grade at or below it, or the lowest when nothing qualifies.
 *  Snapping is not a nicety: seed decay subtracts whole grades from a number that
 *  was never required to be a content grade, so a decayed chords seed can read 3
 *  when chords has only 4 and 5. Depth 0 snaps to the lowest grade too. */
function openingGrade(ladder: number[], fromDepth?: number): number {
  if (fromDepth === undefined) return ladder[Math.floor((ladder.length - 1) / 2)];
  const atOrBelow = ladder.filter((grade) => grade <= fromDepth);
  return atOrBelow.length > 0 ? atOrBelow[atOrBelow.length - 1] : ladder[0];
}

/** Open a walk. `budget` is how many questions it may ask; `fromDepth` marks it as
 *  a re-test and starts it from what the strand currently reads. */
export function startWalk(strand: Strand, budget: number, fromDepth?: number): StrandWalk {
  const ladder = ladderFor(strand);
  return {
    strand,
    ladder,
    budget,
    asked: [],
    passed: [],
    pending: ladder.length === 0 ? null : openingGrade(ladder, fromDepth),
  };
}

/** Record an answer and choose the next question — up one ladder grade when
 *  right, down one when wrong, skipping absent grades rather than failing them.
 *
 *  The walk stops on whichever comes first:
 *   • the budget is spent;
 *   • the step runs off the end of the ladder;
 *   • **the step would revisit a grade already asked.** This last one is what
 *     makes "up to four" true. A bare budget of 4 lets a two-grade ladder
 *     oscillate 4 → 5 → 4 → 5 and spend every question re-asking grades whose
 *     answer is already known. Under this rule an n-grade ladder asks at most
 *     min(budget, n) questions and never the same grade twice. */
export function answerWalk(walk: StrandWalk, correct: boolean): StrandWalk {
  if (walk.pending === null) return walk;

  const grade = walk.pending;
  const asked = [...walk.asked, grade];
  const passed = correct ? [...walk.passed, grade] : walk.passed;

  const index = walk.ladder.indexOf(grade);
  const next = walk.ladder[index + (correct ? 1 : -1)];
  const finished = asked.length >= walk.budget || next === undefined || asked.includes(next);

  return { ...walk, asked, passed, pending: finished ? null : next };
}

/** The depth a walk resolves to: the highest grade answered correctly, 0 if none.
 *  0 is a real measurement here (R7) and must stay distinguishable from "not
 *  measured", which the outcome type carries by omitting the strand entirely. */
export function walkDepth(walk: StrandWalk): number {
  return walk.passed.reduce((max, grade) => (grade > max ? grade : max), 0);
}

/** One question, with the strand and grade it measures. */
export interface PlacementItem {
  strand: Strand;
  grade: number;
  instance: ExerciseInstance;
}

/** The pending question for a walk, or null when it has none. `seed` varies the
 *  draw so a re-test does not re-ask the identical item; the template is fixed by
 *  the cell, so only the instance changes. */
export function walkItem(walk: StrandWalk, seed: number): PlacementItem | null {
  if (walk.pending === null) return null;
  const grade = walk.pending;
  const template = markableTemplate(walk.strand, grade);
  if (template === undefined) return null;
  return { strand: walk.strand, grade, instance: generate(template, { grade, seed, atoms: atomsFor(walk.strand, grade, true) }) };
}

/** The mixed pass: one walk per placeable strand, asked in `STRAND_ORDER`. */
export interface PlacementSession {
  walks: StrandWalk[];
  /** Index of the walk whose question is on screen. Equals `walks.length` when the
   *  pass is over. */
  index: number;
}

export function startPlacement(): PlacementSession {
  return { walks: placeableStrands().map((strand) => startWalk(strand, MIXED_PASS_BUDGET)), index: 0 };
}

export function currentItem(session: PlacementSession, seed: number): PlacementItem | null {
  const walk = session.walks[session.index];
  return walk ? walkItem(walk, seed) : null;
}

/** Answer the current question and advance to the next strand whose walk is still
 *  open. A walk finishing does not end the pass; running out of walks does. */
export function answerPlacement(session: PlacementSession, correct: boolean): PlacementSession {
  const walk = session.walks[session.index];
  if (!walk) return session;

  const walks = [...session.walks];
  walks[session.index] = answerWalk(walk, correct);

  let index = session.index;
  while (index < walks.length && walks[index].pending === null) index += 1;
  return { walks, index };
}

export function isPlacementComplete(session: PlacementSession): boolean {
  return session.index >= session.walks.length;
}

/** What placement hands U11.
 *
 *  `depths` is PARTIAL and `skipped` is a separate variant, both deliberately. A
 *  total `Record` cannot say "no strand was measured" without fabricating zeros,
 *  and a fabricated 0 is indistinguishable from a measured one — which is the
 *  difference between "you got the chords question wrong" and "you skipped
 *  placement". No `day`, no `seq`: U11 stamps. */
export type PlacementOutcome = { kind: 'placed'; depths: Partial<Record<Strand, number>> } | { kind: 'skipped' };

/** Skipping produces no depths at all. U11 then commits `Profile.grade: 1` and no
 *  seeds, and every lane reads its derived depth — 0 for an untouched store. */
export const SKIPPED_PLACEMENT: PlacementOutcome = { kind: 'skipped' };

/** Resolve a finished (or abandoned) pass. Only walks that actually asked
 *  something appear: a strand the learner never reached was not measured, and
 *  saying it placed at 0 would be a claim the pass never made. */
export function placementOutcome(session: PlacementSession): PlacementOutcome {
  const depths: Partial<Record<Strand, number>> = {};
  for (const walk of session.walks) {
    if (walk.asked.length > 0) depths[walk.strand] = walkDepth(walk);
  }
  return { kind: 'placed', depths };
}
