// Never-violate rule 5 (design/README.md): a wrong answer names the
// misconception. chromaticly-3jl found 15 templates emitting one shared string
// for every distractor. This walks every lesson template and holds the line.

import { LESSONS } from '../../content/lessons';
import { optionKey } from '../../ui/grading';
import { generate } from './index';

/** Templates that may keep one shared string. Empty today, and a new entry
 *  needs a stated reason. */
const SHARED_STRING_ALLOWED = new Map<string, string>();

const SEEDS = [0, 1, 2, 3, 4, 5];

interface Item {
  templateId: string;
  prompt: string;
  distractors: unknown[];
  incorrect: string;
  reasons: Record<string, string>;
}

/** Every distractor-bearing item the curriculum can actually serve. */
function items(): Item[] {
  const out: Item[] = [];
  for (const lesson of LESSONS) {
    for (const templateId of lesson.templates) {
      if (SHARED_STRING_ALLOWED.has(templateId)) continue;
      for (const seed of SEEDS) {
        let instance;
        try {
          instance = generate(templateId, { grade: lesson.grade, seed, atoms: lesson.atoms });
        } catch {
          continue; // an atom set this template cannot serve — other tests own that
        }
        if (instance.interaction.type === 'flashcard' || instance.distractors.length === 0) continue;
        out.push({
          templateId,
          prompt: instance.prompt,
          distractors: instance.distractors,
          incorrect: instance.feedback.incorrect,
          reasons: instance.feedback.by_distractor ?? {},
        });
      }
    }
  }
  return out;
}

describe('every wrong answer names its own misconception', () => {
  const ALL = items();

  test('the curriculum actually exercises a wide template set, so a pass means something', () => {
    expect(new Set(ALL.map((i) => i.templateId)).size).toBeGreaterThanOrEqual(28);
  });

  test('every distractor a learner can pick has feedback written for it', () => {
    const gaps = ALL.filter((i) => i.distractors.some((d) => typeof i.reasons[optionKey(d) ?? ''] !== 'string')).map(
      (i) => `${i.templateId}: ${i.prompt}`,
    );
    expect([...new Set(gaps)]).toEqual([]);
  });

  test('no two distractors in one item share a string — the point is which mistake, not that there was one', () => {
    const shared = ALL.filter((i) => new Set(Object.values(i.reasons)).size !== i.distractors.length).map(
      (i) => `${i.templateId}: ${i.prompt}`,
    );
    expect([...new Set(shared)]).toEqual([]);
  });

  test('a per-distractor reason is never just the shared incorrect line repeated', () => {
    const echoes = ALL.filter((i) => Object.values(i.reasons).some((r) => r === i.incorrect)).map(
      (i) => `${i.templateId}: ${i.prompt}`,
    );
    expect([...new Set(echoes)]).toEqual([]);
  });
});
