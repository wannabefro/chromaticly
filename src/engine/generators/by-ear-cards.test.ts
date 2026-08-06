// The card is a property of the lesson, not its source template — the same
// template draws 3 notes for one lesson and 1 for another.

import { LESSONS } from '../../content/lessons';
import { byEarCardFor, generateByEar } from './by-ear-cards';

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

  // U3 wired 22 more lessons whose source draws too few notes for by_ear_match,
  // so only the stage-one set is held to the richer card.
  const U3_VERIFY_ONLY = new Set([
    'treble-notes',
    'bass-notes',
    'accidentals',
    'ledger-lines-2',
    'ledger-lines-3',
    'alto-reading-4',
    'double-accidentals-4',
    'tenor-reading-5',
    'intervals',
    'intervals-2',
    'intervals-3',
    'intervals-4',
    'compound-intervals-5',
    'degrees-1',
    'degrees-2',
    'degrees-3',
    'chords-4',
    'chord-inversions-5',
    'cadences-5',
    'satb-voice-5',
    'rhythm-breve-4',
    'ornaments-4',
  ]);

  test('every lesson stage one already wired keeps the card it shipped with', () => {
    const stageOne = LESSONS.filter((l) => l.by_ear_source && !U3_VERIFY_ONLY.has(l.id));
    expect(stageOne.filter((l) => byEarCardFor(l) !== 'by_ear_match')).toEqual([]);
  });
});

// No load-time probe can prove every seed builds: Practice draws an arbitrary
// one, and generateValidated explores derived seeds from THAT seed. Found by
// /council 2026-08-06 — rests-1 / rest:minim / seed 31 threw into a render.
describe('generateByEar — an unlucky seed degrades, it never throws', () => {
  test('a seed where by_ear_match cannot build falls back to by_ear_verify', () => {
    const opts = { grade: 1, seed: 31, atoms: ['rest:minim'], source: 'rest_completion' };
    expect(generateByEar('by_ear_match', opts).template_id).toBe('by_ear_verify');
  });

  test('a seed where it can build is left alone', () => {
    const opts = { grade: 1, seed: 0, atoms: ['rest:minim'], source: 'rest_completion' };
    expect(generateByEar('by_ear_match', opts).template_id).toBe('by_ear_match');
  });
});
