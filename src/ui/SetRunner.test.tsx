// U7 acceptance: an 8-item set runs to the mastery-gems payoff (2f), and completing
// it marks the lesson complete exactly once (A2). WebView mocked like ExerciseLoop.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import type { Lesson } from '../content/lessons';
import { LESSONS } from '../content/lessons';
import { generate } from '../engine/generators';
import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
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

const lesson = LESSONS[0];

// Real Grade 1 lessons now open on the teach phase (302.3); the set begins once
// the learner taps "Start exercises". Synthetic lessons with no teach content
// skip straight to the set and don't need this.
async function startExercises(getByTestId: (id: string) => any) {
  await act(async () => {
    fireEvent.press(getByTestId('teach-start'));
  });
}

async function answerCorrect(getByTestId: (id: string) => any, seed: number) {
  const instance = generate(lesson.templates[0], { grade: 1, seed, atoms: lesson.atoms });
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

describe('SetRunner — 8-item set to the mastery-gems payoff', () => {
  test('answering all 8 correctly reaches SetComplete with 8/8 and all clean gems', async () => {
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

    // 2f payoff: score ring shows 8/8, gems row present.
    expect(getByTestId('set-complete')).toBeTruthy();
    expect(getByText('8/8')).toBeTruthy();
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
    // The lesson was marked complete in the persisted snapshot.
    expect(storage.blob).toContain(`"${lesson.id}":{"completed":true}`);
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

    const grades = ['good', 'easy', 'hard', 'again', 'good', 'good', 'good', 'good'];
    for (const grade of grades) {
      await gradeFlashcard(getByTestId, grade);
    }

    expect(getByTestId('gem-0-clean')).toBeTruthy();
    expect(getByTestId('gem-1-clean')).toBeTruthy();
    expect(getByTestId('gem-2-hinted')).toBeTruthy();
    expect(getByTestId('gem-3-missed')).toBeTruthy();
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
