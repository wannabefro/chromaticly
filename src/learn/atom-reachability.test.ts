// Every atom a lesson credits must be one review can serve. An atom that is
// earned and then unreachable is a skill the learner can never revisit — and
// three separate classes of it shipped unnoticed (key_sig, context, interval).

import { creditedAtoms, LESSONS } from '../content/lessons';
import { generate } from '../engine/generators';
import { nextPracticeTemplate } from './practice-plan';
import { initialSrs, reviewSrs } from './srs';

const ALL = [...new Set(LESSONS.flatMap(creditedAtoms))];

function servedTagsFor(atom: string): { template: string; tagged: boolean } | null {
  const pick = nextPracticeTemplate([{ atom, srs: reviewSrs(initialSrs(0), false, 0) }], 10_000_000_000, 0);
  if (!pick) return null;
  for (let seed = 0; seed < 6; seed++) {
    try {
      const inst = generate(pick.template, { grade: pick.grade, seed, atoms: pick.atoms, source: pick.source });
      if (inst.srs_tags.includes(atom)) return { template: pick.template, tagged: true };
    } catch {
      continue;
    }
  }
  return { template: pick.template, tagged: false };
}

describe('every credited atom is reachable by review', () => {
  test('the curriculum credits exactly the atoms it currently declares', () => {
    // Move this only for a syllabus line. Past moves: `git log -L28,29:$0`.
    expect(ALL.length).toBe(847);
  });

  test('every atom routes to a template', () => {
    expect(ALL.filter((a) => servedTagsFor(a) === null)).toEqual([]);
  });

  test('every atom is served an exercise that credits it', () => {
    expect(ALL.filter((a) => servedTagsFor(a)?.tagged === false)).toEqual([]);
  });
});
