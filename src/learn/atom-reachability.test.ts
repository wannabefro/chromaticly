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
    // 725 before First steps (chromaticly-dhe), which adds 21: one pulse, seven
    // letters, seven keyboard letters, two stave-anatomy kinds, four note shapes.
    // 746 before the major-scale lessons, which add 9 `major_steps:<tonic>` atoms
    // — A/Bb/Eb at grade 2, E/Ab at 3, B/Db at 4, F#/Gb at 5. The syllabus asks
    // for the SCALES as well as the key signatures at every one of those grades.
    // 755 before the minor-key primary triads, which add 3: chord_minor:I/IV/V.
    // G4 item 4 asks for those chords in ANY key set for the grade; the course
    // had only the major ones (chromaticly-7xv).
    // 845 before grouping 5/4 and 7/4, which add 4 (two atoms, two by-ear). The
    // syllabus sets four irregular signatures and asks for the grouping of all
    // of them; grouping-5 taught only the two /8 ones.
    expect(ALL.length).toBe(849);
  });

  test('every atom routes to a template', () => {
    expect(ALL.filter((a) => servedTagsFor(a) === null)).toEqual([]);
  });

  test('every atom is served an exercise that credits it', () => {
    expect(ALL.filter((a) => servedTagsFor(a)?.tagged === false)).toEqual([]);
  });
});
