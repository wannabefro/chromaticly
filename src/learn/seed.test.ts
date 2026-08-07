// 302.5: the seeding seam readies a target unit without completing it, so an E2E
// can jump straight to a deep interaction. Guards the invariant the Maestro
// coverage (302.6) relies on: the target is the frontier — playable and not done —
// with its predecessors complete. Since G6 U3 nothing is hard-locked, so what the
// seed fabricates is EVIDENCE (completion + mastery), never reachability.

import { LESSONS, lessonById } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { contentGradesFor, laneDepths, STRAND_ORDER } from './lane-depth';
import { unitStates } from './mastery-rollup';
import { seedExamReady, seedProgressToUnit } from './seed';
import { ProgressStore } from './store';

const AT = '2026-07-13T00:00:00.000Z';

describe('seedProgressToUnit — fast-forward to a target unit (302.5)', () => {
  // This is the seam the E2E flows steer with, so a typo'd unit id has to fail here
  // and say so. Walking off the end of the chain instead would mark every lesson
  // complete and leave the flow to fail later on a confusingly wrong screen.
  test('an unknown unit id fails loud rather than completing the whole curriculum', () => {
    const store = new ProgressStore();
    expect(() => seedProgressToUnit(store, LESSONS, 'intervalz', AT)).toThrow(/unknown unit "intervalz"/);
    expect(Object.values(store.toSnapshot().lessons).filter((l) => l.completed)).toHaveLength(0);
  });

  test('onboards and leaves the target (intervals) ready to play, not completed', () => {
    const store = new ProgressStore();
    seedProgressToUnit(store, LESSONS, 'intervals', AT);

    expect(store.isOnboarded()).toBe(true);
    expect(store.getGrade()).toBe(1);
    expect(store.getLesson('intervals').completed).toBe(false); // ready to play, not done
  });

  test('every lesson before the target is marked complete; the target and beyond are not', () => {
    const store = new ProgressStore();
    seedProgressToUnit(store, LESSONS, 'key-signatures', AT);

    // Predecessors in the chain are complete.
    for (const id of ['treble-notes', 'bass-notes', 'accidentals', 'note-values']) {
      expect(store.getLesson(id).completed).toBe(true);
    }
    // The target and its successor are not complete.
    expect(store.getLesson('key-signatures').completed).toBe(false);
    expect(store.getLesson('intervals').completed).toBe(false);
  });

  test('seedExamReady masters every unit so the Level 1 exam gate opens', () => {
    const store = new ProgressStore();
    seedExamReady(store, LESSONS, AT);

    const level1 = LEVELS.find((l) => l.grade === 1)!; // Level 1 is unconditionally unlocked (D5)
    const rows = unitStates(level1.unitIds, store, (id) => lessonById(id)?.atoms ?? []);
    const earned = rows.reduce((sum, r) => sum + r.stars, 0);

    // The gate opens when earned stars reach the level's threshold.
    expect(earned).toBeGreaterThanOrEqual(level1.examGate!.unlockAtStars);
    expect(store.isOnboarded()).toBe(true);
  });

  test('seeding to the root unit completes nothing', () => {
    const store = new ProgressStore();
    const root = LESSONS.find((l) => !LESSONS.some((o) => o.unlocks === l.id))!;
    seedProgressToUnit(store, LESSONS, root.id, AT);

    expect(store.getLesson(root.id).completed).toBe(false);
    expect(Object.values(store.toSnapshot().lessons).filter((l) => l.completed)).toHaveLength(0);
  });

  // Grade-1 seeding must stay byte-for-byte today's state: existing .maestro flows
  // (e.g. `?seed=key-signatures`) depend on this exact shape, not just "similar".
  test('seeding to a grade-1 unit records no exam clear and completes nothing in grade 2', () => {
    const store = new ProgressStore();
    seedProgressToUnit(store, LESSONS, 'key-signatures', AT);

    expect(store.isExamCleared(1)).toBe(false);
    for (const lesson of LESSONS.filter((l) => l.grade === 2)) {
      expect(store.getLesson(lesson.id).completed).toBe(false);
    }
  });

  // The seam must produce a state reachable by honest play (grade 1 mastered, its
  // exam cleared), so an E2E targeting a grade-2 unit starts from a history a real
  // learner could have, not a fabricated one.
  test('seeding to a grade-2 unit masters grade 1, records its exam cleared, and leaves the target not complete', () => {
    const store = new ProgressStore();
    seedProgressToUnit(store, LESSONS, 'key-signatures-2', AT);

    expect(store.isExamCleared(1)).toBe(true);
    for (const lesson of LESSONS.filter((l) => l.grade === 1)) {
      expect(store.getLesson(lesson.id).completed).toBe(true);
    }
    expect(store.getLesson('key-signatures-2').completed).toBe(false);
  });

  // 'exam' means "the gate is open, the paper isn't taken yet" — it must not
  // fabricate a cleared exam or master anything past the Level 1 gate.
  test('seedExamReady masters only grade-1 lessons and records no exam clear', () => {
    const store = new ProgressStore();
    seedExamReady(store, LESSONS, AT);

    expect(store.isExamCleared(1)).toBe(false);
    for (const lesson of LESSONS.filter((l) => l.grade === 2)) {
      expect(store.getLesson(lesson.id).completed).toBe(false);
    }
  });
});

// The seed claims a grade is mastered end to end. Lane depth is what reads that
// claim, and it reads `creditedAtoms` — `atoms` plus `by_ear_atoms`. Seeding
// `atoms` alone therefore produced a state no honest play can reach: every unit
// 3★ (stars read `atoms`) and the lane still reading depth 0. On device the lane
// opened on grade 1 with everything complete, and 11 Maestro flows scrolled for a
// grade-2 or grade-3 row that was never rendered.
describe('seedProgressToUnit — a seeded grade is HELD, not merely starred', () => {
  const strandsWithGrade1Content = STRAND_ORDER.filter((s) => contentGradesFor(s).includes(1));

  test.each(strandsWithGrade1Content)('%s reads depth 1 after a seed past grade 1', (strand) => {
    const store = new ProgressStore();
    seedProgressToUnit(store, LESSONS, 'key-signatures-2', AT, 100);
    expect(laneDepths(store, 100)[strand].depth).toBe(1);
  });

  // The defect in its own terms: a by-ear atom is credited, so the seed must
  // master it. Naming it here means a future `creditedAtoms` change fails loudly.
  test('every credited atom of a seeded grade is mastered, by-ear included', () => {
    const store = new ProgressStore();
    seedProgressToUnit(store, LESSONS, 'key-signatures-2', AT, 100);
    const byEar = LESSONS.filter((l) => l.grade === 1).flatMap((l) => l.by_ear_atoms ?? []);
    expect(byEar.length).toBeGreaterThan(0);
    for (const atom of byEar) expect(store.getAtom(atom).mastery.mastered).toBe(true);
  });
});
