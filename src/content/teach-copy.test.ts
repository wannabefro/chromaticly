// Teach-copy casing (chromaticly-e3z.19). design/README.md sets sentence case
// everywhere, so emphasis is markup — *term* for a term or sign being named,
// **word** for spoken stress — never an ALL-CAPS run.

import { LESSONS } from './lessons';

/** Acronyms and mnemonics whose capitals carry meaning, not emphasis. */
const CAPS_ALLOWED = new Set(['ABRSM', 'SATB', 'FACE', 'FEE']);

const TOKEN = '(?:[A-Z]{2,}|[0-9]+(?:ST|ND|RD|TH))';
const RUN = new RegExp(`\\b${TOKEN}(?:[ -]${TOKEN})*\\b`, 'g');

/** Every authored prose field of a lesson, as `<lesson id> <field>` -> text. */
function prose(): [string, string][] {
  const out: [string, string][] = [];
  for (const lesson of LESSONS) {
    const teach = lesson.teach;
    if (!teach) continue;
    teach.objectives.forEach((o, i) => out.push([`${lesson.id} objectives[${i}]`, o]));
    out.push([`${lesson.id} concept.title`, teach.concept.title]);
    out.push([`${lesson.id} concept.body`, teach.concept.body]);
    if (teach.smartTip) out.push([`${lesson.id} smartTip`, teach.smartTip]);
    if (teach.didYouKnow) out.push([`${lesson.id} didYouKnow`, teach.didYouKnow]);
  }
  return out;
}

describe('teach copy is sentence case with inline emphasis', () => {
  test('no lesson shouts — an ALL-CAPS run is emphasis, and emphasis is markup', () => {
    const offenders: string[] = [];
    for (const [where, text] of prose()) {
      for (const run of text.match(RUN) ?? []) {
        if (!/[A-Z]{3,}/.test(run) || CAPS_ALLOWED.has(run)) continue;
        offenders.push(`${where}: ${run}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('every emphasis marker is paired, so no asterisk reaches the screen', () => {
    for (const [where, text] of prose()) {
      const stripped = text.replace(/\*\*[^*]+\*\*/g, '').replace(/\*[^*]+\*/g, '');
      expect([where, stripped.includes('*')]).toEqual([where, false]);
    }
  });

  test('an emphasis span never spills across a sentence — a marker pair stays inside one', () => {
    for (const [where, text] of prose()) {
      for (const span of text.match(/\*\*?[^*]+\*\*?/g) ?? []) {
        expect([where, span.includes('. ')]).toEqual([where, false]);
      }
    }
  });
});
