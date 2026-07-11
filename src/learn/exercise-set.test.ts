import {
  classifyGem,
  emptySet,
  gems,
  isComplete,
  recordItem,
  score,
  segmentStates,
  SET_SIZE,
  type ExerciseSetState,
} from './exercise-set';

const clean = { correct: true, hintsUsed: 0 };
const hinted = { correct: true, hintsUsed: 1 };
const missed = { correct: false, hintsUsed: 0 };

function fold(results: { correct: boolean; hintsUsed: number }[]): ExerciseSetState {
  return results.reduce(recordItem, emptySet());
}

describe('exercise-set — classifyGem (KTD3, parity with KTD10 hint tracking)', () => {
  test('correct with 0 hints classifies clean', () => {
    expect(classifyGem(clean)).toBe('clean');
  });

  test('correct with 1+ hints classifies hinted, never clean (a hinted-correct is not unaided)', () => {
    expect(classifyGem(hinted)).toBe('hinted');
    expect(classifyGem({ correct: true, hintsUsed: 3 })).toBe('hinted');
    expect(classifyGem(hinted)).not.toBe('clean');
  });

  test('incorrect classifies missed regardless of hints used', () => {
    expect(classifyGem(missed)).toBe('missed');
    expect(classifyGem({ correct: false, hintsUsed: 2 })).toBe('missed');
  });
});

describe('exercise-set — a set completes exactly at SET_SIZE items', () => {
  test('is not complete before SET_SIZE items are recorded', () => {
    const state = fold(new Array(SET_SIZE - 1).fill(clean));
    expect(isComplete(state)).toBe(false);
  });

  test('is complete at exactly SET_SIZE items', () => {
    const state = fold(new Array(SET_SIZE).fill(clean));
    expect(isComplete(state)).toBe(true);
    expect(gems(state)).toHaveLength(SET_SIZE);
  });

  test('recording a 9th item on a full set throws', () => {
    const full = fold(new Array(SET_SIZE).fill(clean));
    expect(() => recordItem(full, clean)).toThrow();
  });
});

describe('exercise-set — score counts clean+hinted (the "X/8" ring)', () => {
  test('6 clean + 1 hinted + 1 missed scores 7/8', () => {
    const state = fold([clean, clean, clean, clean, clean, clean, hinted, missed]);
    expect(score(state)).toBe(7);
  });

  test('an empty set scores 0', () => {
    expect(score(emptySet())).toBe(0);
  });
});

describe('exercise-set — segmentStates maps recorded/current/todo for the ProgressSegments header', () => {
  test('after [correct, incorrect], slots read done, incorrect, current, then todo', () => {
    const state = fold([clean, missed]);
    expect(segmentStates(state)).toEqual([
      'done',
      'incorrect',
      'current',
      'todo',
      'todo',
      'todo',
      'todo',
      'todo',
    ]);
  });

  test('an empty set has slot 0 current and the rest todo', () => {
    expect(segmentStates(emptySet())).toEqual([
      'current',
      'todo',
      'todo',
      'todo',
      'todo',
      'todo',
      'todo',
      'todo',
    ]);
  });

  test('a complete set has no current slot', () => {
    const state = fold(new Array(SET_SIZE).fill(clean));
    expect(segmentStates(state)).toEqual(new Array(SET_SIZE).fill('done'));
  });
});
