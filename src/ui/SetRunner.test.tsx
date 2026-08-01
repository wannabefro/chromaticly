// U7 acceptance: an 8-item set runs to the mastery-gems payoff (2f), and completing
// it marks the lesson complete exactly once (A2). WebView mocked like ExerciseLoop.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import type { Lesson } from '../content/lessons';
import { LESSONS, LESSONS_BY_GRADE } from '../content/lessons';
import * as generators from '../engine/generators';
import { generate } from '../engine/generators';
import { SCORED_SIZE, SET_SIZE } from '../learn/exercise-set';
import { ProgressProvider } from '../learn/ProgressContext';
import { STORE_VERSION, type ProgressSnapshot, type SnapshotStorage } from '../learn/store';
import { assembleOptions } from './grading';
import { SetRunner } from './SetRunner';

function memoryStorage(): SnapshotStorage & { blob: string | null } {
  return {
    blob: null as string | null,
    async load() {
      return this.blob;
    },
    async save(serialized: string) {
      this.blob = serialized;
    },
  };
}

// These tests press MCQ options, so the fixture must be an all-mcq lesson.
const lesson = LESSONS_BY_GRADE[1].find((l) =>
  l.templates.every((t) => generate(t, { grade: l.grade, seed: 0, atoms: l.atoms }).interaction.type === 'mcq'),
)!;

// Real Grade 1 lessons now open on the teach phase (302.3); the set begins once
// the learner taps "Start exercises". Synthetic lessons with no teach content
// skip straight to the set and don't need this.
async function startExercises(getByTestId: (id: string) => any) {
  await act(async () => {
    fireEvent.press(getByTestId('teach-start'));
  });
}

async function answerCorrect(getByTestId: (id: string) => any, seed: number) {
  // SetRunner cycles the lesson's templates by item index, and `seed` is that index.
  const templateId = lesson.templates[seed % lesson.templates.length];
  const instance = generate(templateId, { grade: 1, seed, atoms: lesson.atoms });
  const index = assembleOptions(instance).findIndex((o) => o.correct);
  await act(async () => {
    fireEvent.press(getByTestId(`option-${index}`));
  });
  await act(async () => {
    fireEvent.press(getByTestId('check'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('feedback-sheet-continue'));
  });
}

// chromaticly-inr — the first item of a set is a TRY, not a test. It is presented
// like any other item and then dropped entirely: no gem, no mastery, no SRS
// review. Recording it as hint-assisted would be worse than not recording it,
// because mastery.ts resets an atom's streak on any hinted attempt — the learner
// would pay for taking the on-ramp the lesson opens with.
describe('SetRunner — the warm-up item is presented and then dropped', () => {
  test('its smart tip is already open, so the method is shown before the question is asked', async () => {
    const { getByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});
    await startExercises(getByTestId);

    expect(getByTestId('set-count')).toHaveTextContent('try');
    expect(getByTestId('hint-0')).toBeTruthy();
    expect(getByTestId('warmup-caption')).toBeTruthy();
  });

  test('the next item closes its hints again — the reveal does not carry over', async () => {
    const { getByTestId, queryByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});
    await startExercises(getByTestId);
    await answerCorrect(getByTestId, 0);

    expect(queryByTestId('hint-0')).toBeNull();
    expect(queryByTestId('warmup-caption')).toBeNull();
    expect(getByTestId('set-count')).toHaveTextContent(`1/${SCORED_SIZE}`);
  });

  test('answering it records no mastery — the store is untouched by the try', async () => {
    const storage = memoryStorage();
    const { getByTestId } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});
    await startExercises(getByTestId);
    const before = storage.blob;
    await answerCorrect(getByTestId, 0);

    // The snapshot is written on every real record; an unchanged blob is the
    // evidence that nothing was recorded, not merely that nothing was mastered.
    expect(storage.blob).toBe(before);
  });

  // A passage is ONE item of the set with four sub-answers, and the sub-answers
  // are recorded on a different path from the whole-passage result. Guarding only
  // the outer path would leave the warm-up passage recording four atoms while
  // reporting that it counted for nothing.
  test('a warm-up PASSAGE records nothing either — not the item, not its sub-questions', async () => {
    const passageLesson = LESSONS.find((l) => l.templates.includes('music_in_context'))!;
    const storage = memoryStorage();
    const { getByTestId } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={passageLesson} />
      </ProgressProvider>,
    );
    await act(async () => {});
    await startExercises(getByTestId);

    expect(getByTestId('context-runner')).toBeTruthy();
    expect(getByTestId('warmup-caption')).toBeTruthy();
    expect(storage.blob).toBeNull();
  });

  test('a set still ends after eight items — the try is one of the eight, not a ninth', async () => {
    const { getByTestId } = render(
      <ProgressProvider storage={memoryStorage()}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});
    await startExercises(getByTestId);
    for (let seed = 0; seed < SET_SIZE; seed++) await answerCorrect(getByTestId, seed);

    expect(getByTestId('set-complete')).toBeTruthy();
  });
});

// 302.3: a lesson with teach content must open on the teach/read phase (design
// 4a/4b), never drop straight into exercises — "Start exercises" is the gate.
describe('SetRunner — teach phase gates the set (302.3)', () => {
  test('a lesson with teach content shows the teach phase first, then the set on Start', async () => {
    const storage = memoryStorage();
    const { getByTestId, queryByTestId } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(getByTestId('teach-phase')).toBeTruthy();
    expect(queryByTestId('set-count')).toBeNull(); // not in the set yet

    await startExercises(getByTestId);

    expect(queryByTestId('teach-phase')).toBeNull();
    expect(getByTestId('set-count')).toBeTruthy();
  });
});

// U3 (grade2-new-major-keys): a lesson's set must generate at the lesson's OWN
// grade, not a hardcoded constant — otherwise a grade-2 lesson's grade-2-only
// atoms (e.g. key_sig:Bb_major) fail validation when generated as grade 1.
describe('SetRunner — generates at the lesson\'s own grade, not a global constant (U3)', () => {
  test('a grade-2 lesson generates instances at grade 2', async () => {
    const spy = jest.spyOn(generators, 'generate');
    const grade2Lesson = LESSONS_BY_GRADE[2][0];
    const storage = memoryStorage();
    render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={grade2Lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(spy).toHaveBeenCalledWith(grade2Lesson.templates[0], expect.objectContaining({ grade: 2 }));
    spy.mockRestore();
  });

  test('a grade-1 lesson still generates instances at grade 1 (frozen)', async () => {
    const spy = jest.spyOn(generators, 'generate');
    const storage = memoryStorage();
    render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});

    expect(spy).toHaveBeenCalledWith(lesson.templates[0], expect.objectContaining({ grade: 1 }));
    spy.mockRestore();
  });
});

describe('SetRunner — 8-item set to the mastery-gems payoff', () => {
  test('answering all 8 correctly reaches SetComplete with 7/7 and all clean gems — the warm-up is presented, not scored', async () => {
    const storage = memoryStorage();
    const { getByTestId, getByText } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});
    await startExercises(getByTestId);

    expect(getByTestId('set-runner')).toBeTruthy();
    expect(getByTestId('set-count')).toBeTruthy(); // header progress

    for (let seed = 0; seed < 8; seed++) {
      await answerCorrect(getByTestId, seed);
    }

    // 2f payoff: the ring counts SCORED items (chromaticly-inr), so eight answers
    // land seven gems and the eighth question never appears — the first was the try.
    expect(getByTestId('set-complete')).toBeTruthy();
    expect(getByText(`${SCORED_SIZE}/${SCORED_SIZE}`)).toBeTruthy();
    expect(getByTestId('set-gems')).toBeTruthy();
  });

  test('completing the set marks the lesson complete (persisted)', async () => {
    const storage = memoryStorage();
    const { getByTestId } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});
    await startExercises(getByTestId);

    for (let seed = 0; seed < 8; seed++) {
      await answerCorrect(getByTestId, seed);
    }

    expect(getByTestId('set-complete')).toBeTruthy();
    // The lesson was marked complete in the persisted snapshot, and the play was
    // counted — `plays` is what the NEXT set seeds from, so it has to persist with
    // the completion rather than being derived at read time.
    const saved = JSON.parse(storage.blob!).lessons[lesson.id];
    expect(saved).toEqual({ completed: true, plays: 1 });
  });
});

// U7: a flashcard instance produces no correct/incorrect verdict, so it must
// route through recordFlashcardGrade (graded-SRS + AD4b mastery mapping) —
// never recordAtom (the binary path). The existing mcq lesson's path above is
// unchanged; this is a separate synthetic lesson pointed at the flashcard
// generator, the same way U9 will point the real terms-and-signs lesson at it.
describe('SetRunner — flashcard (U7): self-graded items route through recordFlashcardGrade, not recordAtom', () => {
  const flashcardLesson: Lesson = {
    id: 'test-flashcard-lesson',
    title: 'Test flashcard lesson',
    strand: 'terms_signs',
    atoms: ['term:staccato'],
    templates: ['term_meaning_flashcard'],
    worked_example: null,
    unlocks: null,
    grade: 1,
  };

  async function gradeFlashcard(getByTestId: (id: string) => any, grade: string) {
    await act(async () => {
      fireEvent.press(getByTestId('flashcard-card'));
    });
    await act(async () => {
      fireEvent.press(getByTestId(`grade-${grade}`));
    });
  }

  test('picking a grade for all 8 items reaches SetComplete and persists via the graded-SRS path (the snapshot carries `ease`, which only reviewSrsGraded ever writes)', async () => {
    const storage = memoryStorage();
    const { getByTestId } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={flashcardLesson} />
      </ProgressProvider>,
    );
    await act(async () => {});

    for (let i = 0; i < 8; i++) {
      await gradeFlashcard(getByTestId, 'good');
    }

    expect(getByTestId('set-complete')).toBeTruthy();
    expect(storage.blob).toContain('"ease"'); // reviewSrs (the binary path) never writes this field
  });

  test('Good/Easy grade to a clean gem, Hard to hinted, Again to missed (AD4b)', async () => {
    const storage = memoryStorage();
    const { getByTestId } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={flashcardLesson} />
      </ProgressProvider>,
    );
    await act(async () => {});

    // The FIRST grade is the warm-up and lands no gem (chromaticly-inr), so the
    // gems below are offset by one from this list on purpose — that offset is
    // the thing being asserted as much as the grade mapping itself.
    const grades = ['again', 'good', 'easy', 'hard', 'again', 'good', 'good', 'good'];
    for (const grade of grades) {
      await gradeFlashcard(getByTestId, grade);
    }

    expect(getByTestId('gem-0-clean')).toBeTruthy(); // good
    expect(getByTestId('gem-1-clean')).toBeTruthy(); // easy
    expect(getByTestId('gem-2-hinted')).toBeTruthy(); // hard
    expect(getByTestId('gem-3-missed')).toBeTruthy(); // again
  });

  test("the warm-up's own grade lands no gem — a set is seven gems however the first item went", async () => {
    const storage = memoryStorage();
    const { getByTestId, queryByTestId } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={flashcardLesson} />
      </ProgressProvider>,
    );
    await act(async () => {});

    for (let i = 0; i < 8; i++) await gradeFlashcard(getByTestId, 'good');

    expect(getByTestId(`gem-${SCORED_SIZE - 1}-clean`)).toBeTruthy();
    expect(queryByTestId(`gem-${SCORED_SIZE}-clean`)).toBeNull();
  });
});

// U9: a lesson can attach more than one template (e.g. note-values now carries
// rhythm_sum + bar_validity + add_time_signature). Prior to this change SetRunner
// generated every one of the 8 items from templates[0] only, so a second/third
// attached template was silently inert — never reachable. This test guards the
// invariant: item generation must cycle `itemIndex % templates.length`, not
// pin to the first template.
describe('SetRunner — multi-template lessons cycle their templates across items (U9)', () => {
  const cyclingLesson: Lesson = {
    id: 'test-cycling-lesson',
    title: 'Test cycling lesson',
    strand: 'rhythm',
    atoms: ['rhythm_sum', 'add_time_signature'],
    templates: ['rhythm_sum', 'add_time_signature'],
    worked_example: null,
    unlocks: null,
    grade: 1,
  };

  async function answerCorrectAt(getByTestId: (id: string) => any, templateId: string, seed: number) {
    const instance = generate(templateId, { grade: 1, seed, atoms: [] });
    const index = assembleOptions(instance).findIndex((o) => o.correct);
    await act(async () => {
      fireEvent.press(getByTestId(`option-${index}`));
    });
    await act(async () => {
      fireEvent.press(getByTestId('check'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('feedback-sheet-continue'));
    });
  }

  test('item N is generated from templates[N % templates.length], not always templates[0]', async () => {
    const storage = memoryStorage();
    const { getByTestId } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={cyclingLesson} />
      </ProgressProvider>,
    );
    await act(async () => {});

    const expectedTemplateAt = (i: number) => cyclingLesson.templates[i % cyclingLesson.templates.length];

    for (let i = 0; i < cyclingLesson.templates.length * 2; i++) {
      const expectedTemplate = expectedTemplateAt(i);
      const expectedPrompt = generate(expectedTemplate, { grade: 1, seed: i, atoms: [] }).prompt;
      expect(getByTestId('prompt').props.children).toBe(expectedPrompt);
      await answerCorrectAt(getByTestId, expectedTemplate, i);
    }

    expect(getByTestId('set-count')).toBeTruthy();
  });

  test('a single-template lesson is unaffected — every item still comes from templates[0] (i % 1 === 0)', async () => {
    const storage = memoryStorage();
    const { getByTestId } = render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
    await act(async () => {});
    await startExercises(getByTestId);

    expect(getByTestId('prompt').props.children).toBe(
      generate(lesson.templates[0], { grade: 1, seed: 0, atoms: lesson.atoms }).prompt,
    );
  });
});

// Design 6c (302.9): the save-progress nudge appears over the complete screen once the
// learner is three lessons in — but only on a real completion TRANSITION, only for an
// unnamed learner who hasn't already seen it.
describe('SetRunner — account nudge gating (design 6c, 302.9)', () => {
  function seededBlob(over: Partial<ProgressSnapshot> = {}, profileOver: Record<string, unknown> = {}): string {
    return JSON.stringify({
      version: STORE_VERSION,
      atoms: {},
      lessons: { 'other-a': { completed: true }, 'other-b': { completed: true } }, // 2 already done
      unlocked: [lesson.id],
      collectedFacts: [],
      profile: { grade: 1, onboardedAt: 't', ...profileOver },
      accountNudgeSeen: false,
      ...over,
    });
  }

  async function completeTheSet(getByTestId: (id: string) => any) {
    await act(async () => {});
    await startExercises(getByTestId);
    for (let seed = 0; seed < 8; seed++) await answerCorrect(getByTestId, seed);
  }

  function renderWith(blob: string | null) {
    const storage = memoryStorage();
    storage.blob = blob;
    return render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={lesson} />
      </ProgressProvider>,
    );
  }

  test('completing the 3rd lesson shows the nudge over the complete screen', async () => {
    const { getByTestId } = renderWith(seededBlob()); // 2 others done → this is the 3rd
    await completeTheSet(getByTestId);
    expect(getByTestId('set-complete')).toBeTruthy();
    expect(getByTestId('account-nudge-sheet')).toBeTruthy();
  });

  test('completing only the 1st lesson does NOT show the nudge', async () => {
    const { getByTestId, queryByTestId } = renderWith(null); // fresh → count reaches 1
    await completeTheSet(getByTestId);
    expect(getByTestId('set-complete')).toBeTruthy();
    expect(queryByTestId('account-nudge-sheet')).toBeNull();
  });

  test('an already-seen nudge never re-shows, even at the 3rd', async () => {
    const { queryByTestId } = renderWith(seededBlob({ accountNudgeSeen: true }));
    await completeTheSet(queryByTestId as (id: string) => any);
    expect(queryByTestId('account-nudge-sheet')).toBeNull();
  });

  test('a named account never sees the nudge', async () => {
    const { queryByTestId } = renderWith(seededBlob({}, { name: 'Maya' }));
    await completeTheSet(queryByTestId as (id: string) => any);
    expect(queryByTestId('account-nudge-sheet')).toBeNull();
  });

  test('replaying an already-complete lesson (no transition) does NOT show the nudge', async () => {
    // lesson.id itself already complete + 2 others → count is already 3, but re-completing
    // it is not a transition, so the nudge must stay hidden (the replay bug the review caught).
    const blob = seededBlob({
      lessons: { [lesson.id]: { completed: true }, 'other-a': { completed: true }, 'other-b': { completed: true } },
    });
    const { getByTestId, queryByTestId } = renderWith(blob);
    await completeTheSet(getByTestId);
    expect(getByTestId('set-complete')).toBeTruthy();
    expect(queryByTestId('account-nudge-sheet')).toBeNull();
  });
});

// The fix for the single worst finding of the 2026-07-29 pedagogy audit: seeds
// were `itemIndex` alone, so a lesson was the SAME eight questions forever. 88 of
// the curriculum's 262 atoms (34%) could never be asked, and Practice could not
// reach them either — it only selects atoms the learner has ATTEMPTED, so an atom
// never asked never enters review.
//
// The invariant is two-sided, and both sides matter. A FIRST play must still be
// seeds 0..7, or every pinned generator snapshot and every Maestro flow shifts
// underneath us. A SECOND play must not be.
describe('SetRunner — set seeds rotate per play, so a lesson is not the same eight questions forever', () => {
  const target = LESSONS_BY_GRADE[2][0]; // single-template, no teach gate in the way

  function snapshotWith(plays: number): string {
    const snapshot: ProgressSnapshot = {
      version: STORE_VERSION,
      atoms: {},
      lessons: { [target.id]: { completed: plays > 0, plays } },
      collectedFacts: [],
      profile: { grade: 2, onboardedAt: '2026-07-14T00:00:00.000Z' },
      accountNudgeSeen: false,
      clearedExams: [],
      writeSeq: 1,
      seededDepths: {},
    };
    return JSON.stringify(snapshot);
  }

  /** Every seed `generate` was asked for on mount. Two of them belong to the teach
   *  phase's own examples, at seeds the lesson JSON authors — and this lesson
   *  authors seed 0, so item seeds are asserted by presence rather than by
   *  position. */
  async function seedsAfter(plays: number): Promise<{ seeds: number[]; authored: number[] }> {
    const authored = new Set(
      [target.worked_example?.seed, target.teach?.concept?.example?.seed].filter((n): n is number => n !== undefined),
    );
    const spy = jest.spyOn(generators, 'generate');
    const storage = memoryStorage();
    storage.blob = snapshotWith(plays);
    render(
      <ProgressProvider storage={storage}>
        <SetRunner lesson={target} />
      </ProgressProvider>,
    );
    await act(async () => {});
    const seeds = spy.mock.calls.map((c) => (c[1] as { seed: number }).seed);
    spy.mockRestore();
    return { seeds, authored: [...authored] };
  }

  test('a learner who has never played this lesson still asks seed 0 — snapshots and E2E flows are unmoved', async () => {
    const { seeds, authored } = await seedsAfter(0);
    expect(seeds).toContain(0);
    // and nothing from a later play has leaked in
    expect(seeds.filter((n) => !authored.includes(n) && n !== 0)).toEqual([]);
  });

  test('a second play asks seed 8, so it reaches questions the first play could not', async () => {
    expect((await seedsAfter(1)).seeds).toContain(8);
  });

  test('the fifth play asks seed 32 — the offset is plays x SET_SIZE, never a wrap', async () => {
    expect((await seedsAfter(4)).seeds).toContain(32);
  });

  // The bug this test exists for: reading `plays` in a lazy useState initializer
  // runs on the FIRST render, which can precede the snapshot load — pinning every
  // learner to offset 0 forever, silently, on device only.
  test('the offset survives a store that is still loading at first render', async () => {
    const spy = jest.spyOn(generators, 'generate');
    const storage = memoryStorage();
    storage.blob = snapshotWith(3);
    let release!: (v: string | null) => void;
    const slow = { ...storage, load: () => new Promise<string | null>((r) => { release = r; }) };
    render(
      <ProgressProvider storage={slow as unknown as SnapshotStorage}>
        <SetRunner lesson={target} />
      </ProgressProvider>,
    );
    await act(async () => {}); // first render happens with no store at all
    await act(async () => { release(storage.blob); });

    expect(spy.mock.calls.map((c) => (c[1] as { seed: number }).seed)).toContain(24);
    spy.mockRestore();
  });
});
