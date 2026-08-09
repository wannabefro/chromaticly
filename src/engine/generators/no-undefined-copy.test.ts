// A failed lookup reaches the learner as the word "undefined" in a sentence, and
// nothing else fails. rhythm_sum shipped `A semibreve is undefined, but the sum
// comes to undefined` because its beats table was keyed on the wrong unit scale.

import { LESSONS } from '../../content/lessons';
import { generate } from './index';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const LEAKS = /\b(undefined|NaN)\b|\[object Object\]/;

/** Every string the learner can read on one item. */
function copyOf(instance: ReturnType<typeof generate>): string[] {
  return [
    instance.prompt,
    instance.stimulus.text ?? '',
    ...(instance.hints ?? []),
    instance.feedback.correct,
    instance.feedback.incorrect,
    ...Object.values(instance.feedback.by_distractor ?? {}),
  ];
}

describe('generated copy never leaks a failed lookup', () => {
  test.each([0, 1, 2, 3, 4, 5])('grade %i', (grade) => {
    const offenders: string[] = [];
    for (const lesson of LESSONS.filter((l) => l.grade === grade)) {
      for (const template of lesson.templates) {
        for (const seed of SEEDS) {
          for (const text of copyOf(generate(template, { grade, seed, atoms: lesson.atoms }))) {
            if (LEAKS.test(text)) offenders.push(`${lesson.id}/${template}/seed ${seed}: ${text}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
