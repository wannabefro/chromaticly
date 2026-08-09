// Two options both correct, and the learner marked wrong for picking the other
// one. Four grade-5 items did this: I-V and IV-V are both imperfect cadences,
// and "which chord comes before it?" offered both.
//
// The trick is that no single item can be judged on its own — "is IV also
// right here?" needs theory. But a generator that accepts IV for this exact
// stem on ANOTHER seed has already answered it. So the sweep learns each stem's
// correct answers from every seed, then checks whether any item offers one of
// them as a distractor.

import { LESSONS } from '../../content/lessons';
import { generate } from './index';

const SEEDS = 64;
const key = (value: unknown) => JSON.stringify(value);

/** Everything the learner can see. The clef lives in `interaction`, so leaving
 *  it out makes a treble and a bass item look like one stem with two answers. */
function stemOf(instance: ReturnType<typeof generate>): string {
  return key([instance.prompt, instance.stimulus.text, instance.stimulus.music, instance.interaction]);
}

describe('no item offers a distractor that is also a correct answer', () => {
  test(`across every lesson and template, ${SEEDS} seeds each`, () => {
    const collisions: string[] = [];
    for (const lesson of LESSONS) {
      for (const template of lesson.templates) {
        const correctFor = new Map<string, Set<string>>();
        const made: { seed: number; instance: ReturnType<typeof generate> }[] = [];
        for (let seed = 0; seed < SEEDS; seed++) {
          const instance = generate(template, { grade: lesson.grade, seed, atoms: lesson.atoms });
          const set = correctFor.get(stemOf(instance)) ?? new Set<string>();
          for (const a of [instance.answer.canonical, ...instance.answer.accepted_alternatives]) set.add(key(a));
          correctFor.set(stemOf(instance), set);
          made.push({ seed, instance });
        }
        for (const { seed, instance } of made) {
          const correct = correctFor.get(stemOf(instance))!;
          const alsoRight = instance.distractors.filter((d) => correct.has(key(d)));
          if (alsoRight.length > 0) {
            collisions.push(
              `${lesson.grade}/${lesson.id}/${template} seed ${seed}: "${instance.prompt}" ` +
                `answers ${key(instance.answer.canonical)} but also offers ${alsoRight.map(key).join(', ')}`,
            );
          }
        }
      }
    }
    expect(collisions).toEqual([]);
  });
});
