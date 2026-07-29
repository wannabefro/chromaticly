import {
  classifyGem,
  emptySet,
  gems,
  isComplete,
  recordItem,
  score,
  SCORED_SIZE,
  segmentStates,
  SET_SIZE,
  WARM_UP_ITEMS,
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

// chromaticly-inr: eight items are PRESENTED and seven are SCORED, because the
// first is a warm-up. The two numbers are asserted against each other rather
// than written out, so a change to either one has to be deliberate.
describe('exercise-set — the warm-up is presented but never scored', () => {
  test('the scored size is the presented size minus the warm-up', () => {
    expect(SCORED_SIZE).toBe(SET_SIZE - WARM_UP_ITEMS);
    expect(WARM_UP_ITEMS).toBeGreaterThan(0);
  });

  test('the progress bar still draws SET_SIZE slots — the warm-up is shown, not hidden', () => {
    expect(segmentStates(emptySet())).toHaveLength(SET_SIZE);
  });

  test('the lead-in slots read warmup, never current — there is nothing to earn there', () => {
    const states = segmentStates(emptySet());
    expect(states.slice(0, WARM_UP_ITEMS)).toEqual(new Array(WARM_UP_ITEMS).fill('warmup'));
  });

  test('a lead-in slot stays warmup even while it IS the current item', () => {
    expect(segmentStates(emptySet(), 0)[0]).toBe('warmup');
  });
});

describe('exercise-set — a set completes exactly at SCORED_SIZE items', () => {
  test('is not complete before SCORED_SIZE items are recorded', () => {
    const state = fold(new Array(SCORED_SIZE - 1).fill(clean));
    expect(isComplete(state)).toBe(false);
  });

  test('is complete at exactly SCORED_SIZE items', () => {
    const state = fold(new Array(SCORED_SIZE).fill(clean));
    expect(isComplete(state)).toBe(true);
    expect(gems(state)).toHaveLength(SCORED_SIZE);
  });

  test('recording one item past a full set throws', () => {
    const full = fold(new Array(SCORED_SIZE).fill(clean));
    expect(() => recordItem(full, clean)).toThrow();
  });
});

describe('exercise-set — score counts clean+hinted (the "X/7" ring)', () => {
  test('5 clean + 1 hinted + 1 missed scores 6 of 7', () => {
    const state = fold([clean, clean, clean, clean, clean, hinted, missed]);
    expect(score(state)).toBe(SCORED_SIZE - 1);
  });

  test('an empty set scores 0', () => {
    expect(score(emptySet())).toBe(0);
  });
});

describe('exercise-set — segmentStates maps recorded/current/todo for the ProgressSegments header', () => {
  test('after [correct, incorrect], slots read warmup, done, incorrect, current, then todo', () => {
    const state = fold([clean, missed]);
    expect(segmentStates(state)).toEqual([
      'warmup',
      'done',
      'incorrect',
      'current',
      'todo',
      'todo',
      'todo',
      'todo',
    ]);
  });

  test('an empty set has the first scored slot current and the rest todo', () => {
    expect(segmentStates(emptySet())).toEqual([
      'warmup',
      'current',
      'todo',
      'todo',
      'todo',
      'todo',
      'todo',
      'todo',
    ]);
  });

  test('a complete set has no current slot, and the lead-in is still warmup', () => {
    const state = fold(new Array(SCORED_SIZE).fill(clean));
    expect(segmentStates(state)).toEqual(['warmup', ...new Array(SCORED_SIZE).fill('done')]);
  });

  // The counter SetRunner advances runs over PRESENTED items, so slot k is the
  // current one when itemIndex is k — not when k gems have been recorded. Passing
  // a gem index here would light the wrong slot by exactly the warm-up's width.
  test('currentIndex is a presented index, not a gem index', () => {
    const state = fold([clean]);
    expect(segmentStates(state, 2)[2]).toBe('current');
    expect(segmentStates(state, 2)[1]).toBe('done');
  });
});
