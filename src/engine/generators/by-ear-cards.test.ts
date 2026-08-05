// The card is a property of the lesson, not its source template — the same
// template draws 3 notes for one lesson and 1 for another.

import { LESSONS } from '../../content/lessons';
import { byEarCardFor } from './by-ear-cards';

function lesson(id: string) {
  return LESSONS.find((l) => l.id === id)!;
}

describe('byEarCardFor — the richer card wherever it works', () => {
  test('a lesson whose source draws enough notes keeps by_ear_match', () => {
    expect(byEarCardFor(lesson('ornaments-to-sign-5'))).toBe('by_ear_match');
  });

  test('the SAME source template on a one-note lesson gets by_ear_verify', () => {
    expect(byEarCardFor(lesson('ornaments-4'))).toBe('by_ear_verify');
  });

  test('a lesson with no by-ear source falls back rather than throwing', () => {
    expect(byEarCardFor(lesson('enharmonics-4'))).toBe('by_ear_verify');
  });

  test('every lesson stage one already wired keeps the card it shipped with', () => {
    const wired = LESSONS.filter((l) => l.by_ear_source);
    expect(wired.filter((l) => byEarCardFor(l) !== 'by_ear_match')).toEqual([]);
  });
});
