// The authored cross-lane prerequisite graph (G6 U6, R10).
//
// Every guard below exists because the failure it catches produces a chip that is
// worse than no chip: one pointing at a lesson that does not exist, at a strand
// that does not exist, at a grade with nothing in it, or at the learner's own lane.
// They fire at IMPORT, so a bad edge cannot reach a device.

import { LESSONS, lessonById } from './lessons';
import { PREREQUISITES, prerequisitesFor, requiredStrands } from './prerequisites';

/** Re-import the module against a substituted doc, so each guard can be proven
 *  to fire rather than merely asserted to exist. */
function loadWith(edges: unknown[]): () => void {
  return () => {
    jest.isolateModules(() => {
      jest.doMock('../../curriculum/prerequisites.json', () => ({ version: '1.0.0', edges }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./prerequisites');
    });
  };
}

const VALID = { lesson: 'transposing-instruments-5', requiresStrand: 'intervals', requiresGrade: 3, why: 'x' };

describe('prerequisites — the authored graph', () => {
  test('every edge names a real lesson, and requires a strand that lesson does not own', () => {
    expect(PREREQUISITES.length).toBeGreaterThan(0);
    for (const edge of PREREQUISITES) {
      const lesson = lessonById(edge.lesson);
      expect(lesson).toBeDefined();
      expect(lesson!.strand).not.toBe(edge.requiresStrand);
    }
  });

  test('every required cell has content, so every chip can actually be acted on', () => {
    for (const edge of PREREQUISITES) {
      const cell = LESSONS.filter((l) => l.strand === edge.requiresStrand && l.grade === edge.requiresGrade);
      expect(cell.length).toBeGreaterThan(0);
    }
  });

  test('`why` is a clause, not a sentence — it completes "leans on <strand> — <why>"', () => {
    for (const edge of PREREQUISITES) {
      expect(edge.why).not.toMatch(/\.$/);
      expect(edge.why[0]).toBe(edge.why[0].toLowerCase());
    }
  });

  test('prerequisitesFor returns the edges for a listed lesson, in authored order', () => {
    const edges = prerequisitesFor('transposing-instruments-5');
    expect(edges.map((e) => e.requiresStrand)).toEqual(['intervals', 'scales_keys']);
    expect(edges.map((e) => e.requiresGrade)).toEqual([3, 4]);
  });

  // Most lessons say nothing, and silence is the answer to R10's authoring
  // question, not an unfinished job — so an unlisted lesson must be a quiet [].
  test('prerequisitesFor returns [] for an unlisted lesson — no chip, no crash', () => {
    expect(prerequisitesFor('treble-notes')).toEqual([]);
    expect(prerequisitesFor('no-such-lesson')).toEqual([]);
  });

  test('requiredStrands lists each load-bearing lane once', () => {
    expect(new Set(requiredStrands())).toEqual(new Set(['intervals', 'scales_keys']));
  });
});

// The graph must stay independently authored. If a later refactor derives either
// from the other, one of these two directions breaks — which is the point.
describe('prerequisites — not `unlocks` under another name', () => {
  test('the graph is neither a superset nor a subset of the unlocks chain', () => {
    const unlockPairs = new Set(
      LESSONS.filter((l) => l.unlocks).map((l) => `${l.unlocks}::${l.id}`), // target leans on source
    );
    const prereqPairs = new Set(
      PREREQUISITES.flatMap((edge) =>
        LESSONS.filter((l) => l.strand === edge.requiresStrand && l.grade === edge.requiresGrade).map(
          (l) => `${edge.lesson}::${l.id}`,
        ),
      ),
    );

    const shared = [...prereqPairs].filter((p) => unlockPairs.has(p));
    expect(shared).toEqual([]); // not a subset
    expect(unlockPairs.size).toBeGreaterThan(prereqPairs.size); // and not a superset
  });

  test('every edge crosses a lane boundary — `unlocks` never does', () => {
    for (const edge of PREREQUISITES) {
      expect(lessonById(edge.lesson)!.strand).not.toBe(edge.requiresStrand);
    }
    // ...whereas the unlocks chain stays inside one grade, which is what makes the
    // two graphs answer different questions.
    for (const lesson of LESSONS.filter((l) => l.unlocks)) {
      expect(lessonById(lesson.unlocks!)?.grade).toBe(lesson.grade);
    }
  });
});

describe('prerequisites — import-time guards', () => {
  test('a dangling lesson id fails with a named error', () => {
    expect(loadWith([{ ...VALID, lesson: 'no-such-lesson' }])).toThrow(/unknown lesson "no-such-lesson"/);
  });

  test('an unknown strand fails with a named error', () => {
    expect(loadWith([{ ...VALID, requiresStrand: 'vibes' }])).toThrow(/malformed/);
  });

  test('a requiresGrade outside 1-5 fails', () => {
    expect(loadWith([{ ...VALID, requiresGrade: 6 }])).toThrow(/malformed/);
    expect(loadWith([{ ...VALID, requiresGrade: 0 }])).toThrow(/malformed/);
  });

  // The guard that stops an unfixable chip shipping: chords teaches nothing below
  // grade 4, so an edge pointing at grade 2 could never be satisfied.
  test('an edge whose required cell has no lessons fails', () => {
    expect(LESSONS.some((l) => l.strand === 'chords' && l.grade === 2)).toBe(false);
    expect(loadWith([{ ...VALID, requiresStrand: 'chords', requiresGrade: 2 }])).toThrow(/has no lessons/);
  });

  // The rule that disqualified the SATB candidate: both sides were pitch, which is
  // within-lane depth order the lane list already shows.
  test('an edge requiring the lesson\'s OWN strand fails', () => {
    expect(lessonById('transposing-instruments-5')!.strand).toBe('pitch');
    expect(loadWith([{ ...VALID, requiresStrand: 'pitch', requiresGrade: 4 }])).toThrow(/within-lane depth order/);
  });

  test('a duplicated (lesson, strand) edge fails rather than rendering two chips', () => {
    expect(loadWith([VALID, { ...VALID, why: 'again' }])).toThrow(/duplicate edge/);
  });

  test('an empty `why` fails — the chip has nothing to say', () => {
    expect(loadWith([{ ...VALID, why: '' }])).toThrow(/malformed/);
  });

  test('the real doc loads clean', () => {
    expect(loadWith(PREREQUISITES)).not.toThrow();
  });
});
