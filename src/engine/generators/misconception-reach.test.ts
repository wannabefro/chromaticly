// A by_distractor key that matches no distractor never fires. The learner gets
// the generic `incorrect` line instead of the named misconception, and nothing
// fails — design rule 5 is violated silently. `misconceptionFor` looks the copy
// up by `optionKey(selected)`, so that is the key the generator has to write.

import { LESSONS } from '../../content/lessons';
import { optionKey } from '../../ui/grading';
import { generate } from './index';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('every by_distractor key reaches a distractor', () => {
  test.each([0, 1, 2, 3, 4, 5])('grade %i', (grade) => {
    const orphans: string[] = [];
    for (const lesson of LESSONS.filter((l) => l.grade === grade)) {
      for (const template of lesson.templates) {
        for (const seed of SEEDS) {
          const instance = generate(template, { grade, seed, atoms: lesson.atoms });
          const map = instance.feedback.by_distractor;
          if (!map) continue;
          const reachable = new Set(instance.distractors.map(optionKey).filter((k) => k !== undefined));
          for (const key of Object.keys(map)) {
            if (!reachable.has(key)) orphans.push(`${lesson.id}/${template}/seed ${seed}: "${key}"`);
          }
        }
      }
    }
    expect(orphans).toEqual([]);
  });
});

// The other direction, which design rule 5 asks for. Measured 2026-08-09:
// 60 of 60 templates comply, so this pins a fact.
describe('a template that offers a pick names the misconception behind it', () => {
  test('no template with pickable distractors leaves them all undiagnosed', () => {
    const seen = new Map<string, { picks: number; diagnosed: number }>();
    for (const lesson of LESSONS) {
      for (const template of lesson.templates) {
        for (const seed of SEEDS) {
          const instance = generate(template, { grade: lesson.grade, seed, atoms: lesson.atoms });
          const picks = instance.distractors.map(optionKey).filter((k) => k !== undefined).length;
          const row = seen.get(template) ?? { picks: 0, diagnosed: 0 };
          if (picks > 0) row.picks++;
          if (Object.keys(instance.feedback.by_distractor ?? {}).length > 0) row.diagnosed++;
          seen.set(template, row);
        }
      }
    }
    const silent = [...seen].filter(([, r]) => r.picks > 0 && r.diagnosed === 0).map(([t]) => t);
    expect(silent).toEqual([]);
  });
});
