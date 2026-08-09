// An alternative the grader rejects is dead, and the learner is marked wrong for
// an answer the generator promised to accept. Shape is checked before grade:
// feeding a malformed alternative back in compares undefined with undefined.

import { LESSONS } from '../../content/lessons';
import { gradeStaveInput, gradeText } from '../../ui/grading';
import { generate } from './index';

const SEEDS = 16;

/** Free-response only: an MCQ alternative cannot be selected. */
const FREE_RESPONSE = new Set(['stave_input', 'text_input']);

describe('every accepted alternative is actually accepted', () => {
  test.each([0, 1, 2, 3, 4, 5])('grade %i', (grade) => {
    const inert: string[] = [];
    for (const lesson of LESSONS.filter((l) => l.grade === grade)) {
      for (const template of lesson.templates) {
        for (let seed = 0; seed < SEEDS; seed++) {
          const instance = generate(template, { grade, seed, atoms: lesson.atoms });
          const type = instance.interaction.type;
          if (!FREE_RESPONSE.has(type)) continue;
          for (const alt of instance.answer.accepted_alternatives) {
            const where = `${lesson.id}/${template}/seed ${seed}: ${JSON.stringify(alt)}`;
            if (type === 'text_input') {
              if (typeof alt !== 'string') inert.push(`${where} — not a string`);
              else if (!gradeText(instance, alt)) inert.push(`${where} — gradeText rejects it`);
              continue;
            }
            const shaped = alt as { pitch?: unknown; dur?: unknown };
            if (typeof shaped?.pitch !== 'string' || typeof shaped?.dur !== 'string') {
              inert.push(`${where} — not a { pitch, dur }, so the grader can never match it`);
            } else if (!gradeStaveInput(instance, { pitch: shaped.pitch, dur: shaped.dur })) {
              inert.push(`${where} — gradeStaveInput rejects it`);
            }
          }
        }
      }
    }
    expect(inert).toEqual([]);
  });
});
