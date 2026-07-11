import { initialMastery, lessonComplete, MASTERY_THRESHOLD, recordAttempt, type MasteryState } from './mastery';

const correct = { correct: true, hintsUsed: 0 };
const wrong = { correct: false, hintsUsed: 0 };
const hinted = { correct: true, hintsUsed: 1 };

function fold(attempts: { correct: boolean; hintsUsed: number }[]): MasteryState {
  return attempts.reduce(recordAttempt, initialMastery());
}

describe('mastery — KTD10: mastered after 3 consecutive hint-free correct', () => {
  test('three unaided correct in a row masters the atom', () => {
    const state = fold([correct, correct, correct]);
    expect(state.streak).toBe(MASTERY_THRESHOLD);
    expect(state.mastered).toBe(true);
  });

  test('two correct then wrong resets the streak to 0 (not yet mastered)', () => {
    const state = fold([correct, correct, wrong]);
    expect(state.streak).toBe(0);
    expect(state.mastered).toBe(false);
  });

  test('a hint-assisted correct does not advance the streak (why: hinted != unaided mastery)', () => {
    const state = fold([correct, correct, hinted]);
    expect(state.streak).toBe(0);
    expect(state.mastered).toBe(false);
  });
});

describe('mastery — mastery is sticky once earned', () => {
  test('a wrong answer after mastery keeps mastered true but resets the live streak', () => {
    const state = fold([correct, correct, correct, wrong]);
    expect(state.mastered).toBe(true);
    expect(state.streak).toBe(0);
  });
});

describe('mastery — lessonComplete', () => {
  const mastered: MasteryState = { streak: 3, mastered: true };
  const partial: MasteryState = { streak: 1, mastered: false };

  test('a lesson is complete only when every one of its atoms is mastered', () => {
    const table: Record<string, MasteryState> = { a: mastered, b: mastered };
    expect(lessonComplete(['a', 'b'], (x) => table[x])).toBe(true);
  });

  test('one unmastered atom leaves the lesson incomplete', () => {
    const table: Record<string, MasteryState> = { a: mastered, b: partial };
    expect(lessonComplete(['a', 'b'], (x) => table[x])).toBe(false);
  });

  test('an atom with no recorded progress is not mastered', () => {
    expect(lessonComplete(['a'], () => undefined)).toBe(false);
  });
});
