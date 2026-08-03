// Every atom a lesson claims to teach must be one its own questions can credit.
//
// This exists because of a bug that nothing else could catch. `ornaments-to-sign-5`
// declared six atoms suffixed `:written_to_sign`; its generator emitted the bare
// form. Both halves were individually correct and individually tested — the lesson
// JSON validated, the generator's own suite passed, the pinned seed-stability
// snapshot was green — and the product was a lesson that could never be completed:
// a flawless set scored 0 stars, and the Terms & Signs lane could never hold grade
// 5. The defect lived in the SEAM, so the test has to sit in the seam too.
//
// Two directions, and they fail for different reasons:
//
//   • An emitted tag the lesson does not declare is credit going nowhere. Stars,
//     lesson completion and lane depth are all computed over the DECLARED list, so
//     a stray tag is work the learner did that the app will not count.
//   • A declared atom nothing emits is the reverse: a mastery requirement no
//     question can ever satisfy.
//
// Seed window: `SEEDS_PER_ATOM` sets per atom, which is far more than a learner
// would play but is the point — it asks "is this atom reachable AT ALL", not "is it
// reachable soon". Coverage within a realistic number of plays is a separate
// question, owned by SetRunner's seed rotation.

import { LESSONS, type Lesson } from './lessons';
import { generate } from '../engine/generators';
import { buildContextPassage } from '../engine/generators/context-passage';
import { WRITTEN_ITEMS, WARM_UP_ITEMS } from '../learn/exercise-set';

const SEEDS_PER_ATOM = 40;

function tagsOf(instance: unknown): string[] {
  const o = instance as { srs_tags?: string[]; questions?: { srs_tags?: string[] }[] };
  return [...(o.srs_tags ?? []), ...(o.questions ?? []).flatMap((q) => q.srs_tags ?? [])];
}

/** Every tag the lesson's own templates emit across a wide seed sweep. A seed that
 *  throws is skipped, not failed: generators legitimately reject a seed whose draw
 *  cannot make a valid instance, and `generateValidated` already retries. */
function emittedBy(lesson: Lesson): Set<string> {
  const emitted = new Set<string>();
  const seeds = Math.max(WRITTEN_ITEMS, lesson.atoms.length * SEEDS_PER_ATOM);
  for (let seed = 0; seed < seeds; seed++) {
    const templateId = lesson.templates[seed % lesson.templates.length];
    const opts = { grade: lesson.grade, seed, atoms: lesson.atoms };
    try {
      const instance = templateId === 'music_in_context' ? buildContextPassage(opts) : generate(templateId, opts);
      for (const tag of tagsOf(instance)) emitted.add(tag);
    } catch {
      continue;
    }
  }
  return emitted;
}

const EMITTED = new Map(LESSONS.map((lesson) => [lesson.id, emittedBy(lesson)]));

describe('every lesson can credit the atoms it declares', () => {
  test.each(LESSONS.map((l) => [l.id, l] as const))(
    '%s emits every atom it declares',
    (_id, lesson) => {
      const emitted = EMITTED.get(lesson.id)!;
      expect(lesson.atoms.filter((atom) => !emitted.has(atom))).toEqual([]);
    },
  );

  test.each(LESSONS.map((l) => [l.id, l] as const))(
    '%s declares every atom it emits',
    (_id, lesson) => {
      const declared = new Set(lesson.atoms);
      expect([...EMITTED.get(lesson.id)!].filter((atom) => !declared.has(atom))).toEqual([]);
    },
  );
});

// The specific regression, named. The generic sweep above would catch it, but a
// named test says WHICH lesson broke and why anyone should care.
describe('ornaments keep their direction in the atom id', () => {
  test('the Grade 5 written->sign lesson credits the suffixed atoms, not the Grade 4 bare ones', () => {
    const emitted = EMITTED.get('ornaments-to-sign-5')!;
    for (const atom of emitted) expect(atom).toMatch(/:written_to_sign$/);
  });

  test('the Grade 4 sign->name lesson credits the BARE atoms — the two are different skills', () => {
    const emitted = EMITTED.get('ornaments-4')!;
    for (const atom of emitted) expect(atom).not.toMatch(/:written_to_sign$/);
  });

  test('the two lessons share no atom, so mastering one never masters the other', () => {
    const g5 = EMITTED.get('ornaments-to-sign-5')!;
    const g4 = EMITTED.get('ornaments-4')!;
    expect([...g5].filter((atom) => g4.has(atom))).toEqual([]);
  });
});

// Reachable "at all" is the weak claim. This is the strong one: a learner who
// replays a lesson a handful of times should actually meet everything it teaches.
//
// Before the seed rotation the answer was "never" — a lesson was the same eight
// questions forever, so 34% of the curriculum was unreachable by any amount of
// play. With the rotation it is 69% after one play, 96% after four.
describe('a lesson becomes exhaustive as it is replayed', () => {
  // Seven, not six. Six was calibrated when all eight items of a set counted; the
  // warm-up (93e63b0) made item 1 uncredited, so six plays now credit 42 draws
  // where they used to credit 48. Seven restores the budget (49) rather than
  // quietly shrinking the property this guard tests.
  //
  // The alternative was to move content until `term:ritardando` — the one atom
  // that changes verdict — landed in a scored slot inside six plays. That was
  // rejected: `term_meaning` samples its deck unbiased, so which atom falls where
  // is the seed sequence, and editing the curriculum to suit one sequence fits the
  // content to the test.
  const PLAYS = 7;

  test.each(LESSONS.map((l) => [l.id, l] as const))(
    '%s asks every atom it teaches within six plays',
    (_id, lesson) => {
      const hit = new Set<string>();
      for (let seed = 0; seed < PLAYS * WRITTEN_ITEMS; seed++) {
        // The warm-up slots are PRESENTED but not CREDITED — every warm-up path in
        // SetRunner returns before `recordAtom`. Counting them made this guard
        // measure what the learner is shown rather than what they can master, and
        // an atom drawn only at offset 0 read as reachable while being worth
        // nothing. `WRITTEN_ITEMS`/`WARM_UP_ITEMS` are imported rather than restated so
        // the next change to the set shape cannot leave this behind again.
        if (seed % WRITTEN_ITEMS < WARM_UP_ITEMS) continue;
        const templateId = lesson.templates[seed % WRITTEN_ITEMS % lesson.templates.length];
        const opts = { grade: lesson.grade, seed, atoms: lesson.atoms };
        try {
          const instance = templateId === 'music_in_context' ? buildContextPassage(opts) : generate(templateId, opts);
          for (const tag of tagsOf(instance)) hit.add(tag);
        } catch {
          continue;
        }
      }
      expect(lesson.atoms.filter((atom) => !hit.has(atom))).toEqual([]);
    },
  );

  // There used to be an allowance here for `terms-and-signs`, which declared 31
  // atoms — roughly four sets' worth of distinct content in one lesson, and four
  // times the next largest. An unbiased sampler drawing 8 at a time kept
  // re-drawing, so the lesson never converged however often it was replayed. The
  // pedagogy split into dynamics-1 / tempo-1 / signs-1 removed the allowance, and
  // this ceiling is what stops a future lesson from re-creating the problem.
  test('no lesson is large enough to need an exhaustion allowance', () => {
    expect(Math.max(...LESSONS.map((l) => l.atoms.length))).toBeLessThan(15);
  });
});
