// The five First steps generators (grade 0, chromaticly-dhe).
//
// Two properties matter across all five and are asserted as a table: they must be
// valid at EVERY grade, not grade 0 alone (grade2-smoke hands every registered
// generator grade 2), and they must survive a single-atom pool, because Practice
// serves one due atom as the whole sampling scope.
//
// The per-generator cases below are the pedagogy, not the plumbing. Each one
// guards a specific thing the level exists to teach, and each would still fail if
// the generator kept working but started teaching the wrong thing.

import { ALPHABET_LETTERS, alphabetAtom, keyboardAtom, noteShapeAtom, pulseAtom, staveAnatomyAtom } from '../atoms';
import { generate } from './index';

const TEMPLATES = ['pulse_count', 'alphabet_step', 'keyboard_find', 'stave_position', 'note_shape_length'];
const SEEDS = Array.from({ length: 30 }, (_, i) => i);

/** Every grade in the supported band. A First steps generator that only worked at
 *  grade 0 would need a grade2-smoke exclusion list; grade-tolerance is what keeps
 *  the three ledgers unmodified. */
const ALL_GRADES = [0, 1, 2, 3, 4, 5];

describe('every First steps generator — the properties the ledgers depend on', () => {
  test.each(TEMPLATES)('%s generates at every grade 0-5, over 30 seeds', (template) => {
    for (const grade of ALL_GRADES) {
      for (const seed of SEEDS) expect(generate(template, { grade, seed, atoms: [] })).toBeTruthy();
    }
  });

  // Practice hands ONE due atom as the pool. A generator that assumed a full pool
  // would crash the Practice tab on its own atom.
  test.each([
    ['alphabet_step', alphabetAtom('G')],
    ['keyboard_find', keyboardAtom('D')],
    ['stave_position', staveAnatomyAtom('higher_lower')],
    ['note_shape_length', noteShapeAtom('minim')],
  ])('%s serves a single-atom pool, and credits that atom', (template, atom) => {
    for (const seed of SEEDS) {
      expect(generate(template, { grade: 0, seed, atoms: [atom] }).srs_tags).toEqual([atom]);
    }
  });

  test.each(TEMPLATES)('%s is a pure function of its seed', (template) => {
    for (const seed of SEEDS) {
      const a = generate(template, { grade: 0, seed, atoms: [] });
      const b = generate(template, { grade: 0, seed, atoms: [] });
      expect(a).toEqual(b);
    }
  });

  // The house rule (misconception-coverage.test.ts, design rule 5): EVERY
  // distractor a learner can pick names its own misconception. The first version
  // of this test skipped when by_distractor was absent, which let stave_position
  // ship with none at all — a vacuous pass, caught by the repo-wide test instead.
  // A distractor drawn by position rather than by the seeded RNG is the same
  // every time, so a value that appears ONLY when it is correct is a free mark.
  test.each([
    ['alphabet_step', 3],
    ['note_shape_length', 2],
  ])('%s varies its distractor set across seeds rather than taking a fixed slice', (template, minimumSets) => {
    const sets = SEEDS.map((seed) => generate(template, { grade: 0, seed, atoms: [] }).distractors.slice().sort().join());
    expect(new Set(sets).size).toBeGreaterThanOrEqual(minimumSets);
  });

  test.each(TEMPLATES)('%s writes a distinct by_distractor line for every distractor it emits', (template) => {
    for (const seed of SEEDS) {
      const instance = generate(template, { grade: 0, seed, atoms: [] });
      if (instance.distractors.length === 0) continue; // keyboard_tap has no options
      const byDistractor = instance.feedback.by_distractor;
      expect(byDistractor).toBeTruthy();
      const lines = instance.distractors.map((d) => byDistractor![d]);
      for (const line of lines) expect(line).toBeTruthy();
      expect(new Set(lines).size).toBe(lines.length);
    }
  });
});

describe('pulse_count (lesson 1) — aural, and never notated', () => {
  // The lesson teaches pulse BEFORE any symbol. A stave on screen defeats it.
  test('it draws no notation and carries the bar as audio instead', () => {
    for (const seed of SEEDS) {
      const instance = generate('pulse_count', { grade: 0, seed, atoms: [] });
      expect(instance.stimulus.music).toBeNull();
      expect(instance.stimulus.text).toBeNull();
      expect(instance.interaction.type).toBe('aural_mcq');
      expect(instance.interaction.config.played_music).toBeTruthy();
    }
  });

  test('the played bar holds exactly as many beats as the answer claims', () => {
    for (const seed of SEEDS) {
      const instance = generate('pulse_count', { grade: 0, seed, atoms: [] });
      const played = instance.interaction.config.played_music as { voices: { events: unknown[] }[] };
      expect(played.voices[0].events).toHaveLength(Number(instance.answer.canonical));
    }
  });

  test('it credits the pulse atom', () => {
    expect(generate('pulse_count', { grade: 0, seed: 0, atoms: [] }).srs_tags).toEqual([pulseAtom()]);
  });

  // Every grade-0 bar is four beats, and that is a DECISION, not a side effect
  // of GRADE_0_SCOPE naming one metre (chromaticly-3uv, ruled 2026-08-07).
  // Lesson 1 teaches a learner to FEEL a pulse, not to count variable metres; a
  // 3/4 bar arrives in Grade 1. So the answer being predictable is the cost of
  // the lesson doing one thing, and it is accepted.
  //
  // `beatsPerBarFor` reads the scope, so adding a metre to grade 0 would start
  // varying the count silently. This test is what makes that a failure.
  test('the pulse bar is four beats on every seed — fixed by decision, not by scope', () => {
    for (const seed of SEEDS) {
      expect(generate('pulse_count', { grade: 0, seed, atoms: [] }).answer.canonical).toBe('4');
    }
  });
});

describe('alphabet_step (lesson 2) — the wrap after G is the point', () => {
  // Grade 1 states the wrap in a subordinate clause and never drills it. If the
  // generator cannot produce it, the lesson does not teach the thing it exists for.
  test('the G-to-A wrap is reachable, and its feedback names it', () => {
    const wraps = SEEDS.map((seed) => generate('alphabet_step', { grade: 0, seed, atoms: [alphabetAtom('G')] })).filter(
      (i) => i.prompt.includes('after G'),
    );
    expect(wraps.length).toBeGreaterThan(0);
    expect(wraps[0].answer.canonical).toBe('A');
    expect(wraps[0].feedback.correct).toContain('no H');
  });

  test('the A-to-G wrap downward is reachable too', () => {
    const wraps = SEEDS.map((seed) => generate('alphabet_step', { grade: 0, seed, atoms: [alphabetAtom('A')] })).filter(
      (i) => i.prompt.includes('before A'),
    );
    expect(wraps.length).toBeGreaterThan(0);
    expect(wraps[0].answer.canonical).toBe('G');
  });

  test('every answer is one of the seven letters, and never the letter asked about', () => {
    for (const seed of SEEDS) {
      const instance = generate('alphabet_step', { grade: 0, seed, atoms: [] });
      expect(ALPHABET_LETTERS).toContain(instance.answer.canonical);
      expect(instance.distractors).not.toContain(instance.answer.canonical);
    }
  });
});

describe('keyboard_find (lesson 3) — answered on the keyboard, located by the black keys', () => {
  test('it answers on the keyboard, not in a multiple choice', () => {
    for (const seed of SEEDS) {
      expect(generate('keyboard_find', { grade: 0, seed, atoms: [] }).interaction.type).toBe('keyboard_tap');
    }
  });

  test('the answer is a pitch inside the keyboard component span', () => {
    for (const seed of SEEDS) {
      expect(generate('keyboard_find', { grade: 0, seed, atoms: [] }).answer.canonical).toMatch(/^[A-G]4$/);
    }
  });

  // Keyboard.tsx draws C4..F5, so C D E F appear twice and both are tappable.
  // Marking the upper one wrong contradicts the atom, which is keyed by LETTER.
  test('where the keyboard draws the letter twice, both octaves are accepted', () => {
    for (const letter of ['C', 'D', 'E', 'F']) {
      const instance = generate('keyboard_find', { grade: 0, seed: 0, atoms: [keyboardAtom(letter)] });
      expect(instance.answer.accepted_alternatives).toEqual([`${letter}5`]);
    }
  });

  test('where it draws the letter once, there is no alternative to accept', () => {
    for (const letter of ['G', 'A', 'B']) {
      const instance = generate('keyboard_find', { grade: 0, seed: 0, atoms: [keyboardAtom(letter)] });
      expect(instance.answer.accepted_alternatives).toEqual([]);
    }
  });

  // The landmark IS the lesson: you find a note by the black keys around it.
  test('its hint names the black-key group, never a count from the end', () => {
    for (const seed of SEEDS) {
      expect(generate('keyboard_find', { grade: 0, seed, atoms: [] }).hints[0]).toMatch(/black keys?/);
    }
  });
});

describe('stave_position (lesson 4) — both question shapes, and the clef qualification', () => {
  test('the line-or-space shape asks about one note and offers exactly the two answers', () => {
    for (const seed of SEEDS) {
      const instance = generate('stave_position', { grade: 0, seed, atoms: [staveAnatomyAtom('line_or_space')] });
      expect(instance.prompt).toContain('on a line');
      expect([instance.answer.canonical, ...instance.distractors].sort()).toEqual(['In a space', 'On a line']);
      expect(instance.stimulus.music).toBeTruthy();
    }
  });

  test('the higher-lower shape draws two notes to compare', () => {
    for (const seed of SEEDS) {
      const instance = generate('stave_position', { grade: 0, seed, atoms: [staveAnatomyAtom('higher_lower')] });
      const music = instance.stimulus.music as { voices: { events: unknown[] }[] };
      expect(music.voices[0].events).toHaveLength(2);
    }
  });

  // The bug the validator hook caught and this suite missed: the generator
  // compared pitches with `>`, which is a STRING comparison, so 'C5' > 'D4' is
  // false and the "higher" note could sound lower. Asserted here directly, over
  // every grade, because the wider a grade's range the more octaves it spans and
  // the more often lexicographic order disagrees with pitch order.
  test('the note it calls higher really is the higher pitch, at every grade', () => {
    const ord = (p: string) => Number(p[1]) * 7 + ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(p[0]);
    for (const grade of ALL_GRADES) {
      for (const seed of SEEDS) {
        const instance = generate('stave_position', { grade, seed, atoms: [staveAnatomyAtom('higher_lower')] });
        const music = instance.stimulus.music as { voices: { events: { pitch: string }[] }[] };
        const [first, second] = music.voices[0].events.map((e) => e.pitch);
        const expected = ord(first) > ord(second) ? 'The first one' : 'The second one';
        expect(instance.answer.canonical).toBe(expected);
        expect(ord(first)).not.toBe(ord(second));
      }
    }
  });

  // chromaticly-bpu.2. Objective 3 is "up the page is pitch, left to right is
  // time", and only the pitch half had an atom.
  test('the earlier-later shape names the notes by height, never by side', () => {
    for (const seed of SEEDS) {
      const instance = generate('stave_position', { grade: 0, seed, atoms: [staveAnatomyAtom('earlier_later')] });
      expect(instance.prompt).toContain('first');
      expect([instance.answer.canonical, ...instance.distractors].sort()).toEqual(['The higher one', 'The lower one']);
    }
  });

  // Options named "left"/"right" would answer the question in their own labels.
  // Naming them by height is what forces the left-to-right read.
  test('the note it calls first really is the one drawn first, at every grade', () => {
    const ord = (p: string) => Number(p[1]) * 7 + ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(p[0]);
    for (const grade of ALL_GRADES) {
      for (const seed of SEEDS) {
        const instance = generate('stave_position', { grade, seed, atoms: [staveAnatomyAtom('earlier_later')] });
        const music = instance.stimulus.music as { voices: { events: { pitch: string }[] }[] };
        const [first, second] = music.voices[0].events.map((e) => e.pitch);
        expect(instance.answer.canonical).toBe(ord(first) > ord(second) ? 'The higher one' : 'The lower one');
        expect(ord(first)).not.toBe(ord(second));
      }
    }
  });

  // Both orders must occur, or the answer is a constant a learner can ride.
  test('the higher note leads on some draws and trails on others', () => {
    const answers = new Set(
      SEEDS.map((seed) => generate('stave_position', { grade: 0, seed, atoms: [staveAnatomyAtom('earlier_later')] }).answer.canonical),
    );
    expect(answers).toEqual(new Set(['The higher one', 'The lower one']));
  });

  // Content correction 2. Unqualified, "higher on the stave means higher in pitch"
  // is false the moment the learner meets the bass clef in Grade 1.
  test('every higher-lower explanation qualifies itself to one clef', () => {
    for (const seed of SEEDS) {
      const instance = generate('stave_position', { grade: 0, seed, atoms: [staveAnatomyAtom('higher_lower')] });
      expect(`${instance.feedback.correct} ${instance.hints.join(' ')}`).toMatch(/clef/);
    }
  });
});

describe('note_shape_length (lesson 5) — shape and meaning arrive together', () => {
  // Content correction 3. A learner who only meets the flagged quaver does not
  // recognise a beamed pair as quavers, which is the first thing Grade 1 shows them.
  test('a quaver is drawn beamed as well as flagged', () => {
    const quavers = SEEDS.map((seed) => generate('note_shape_length', { grade: 0, seed, atoms: [noteShapeAtom('quaver')] }));
    const eventCounts = quavers.map((i) => (i.stimulus.music as { voices: { events: unknown[] }[] }).voices[0].events.length);
    expect(eventCounts).toContain(2); // beamed pair
    expect(eventCounts).toContain(1); // single, flagged
  });

  // Content correction 4. Note type gives relative NOTATED duration, not which
  // performed sound literally lasts longer.
  test('the copy says a shape is WRITTEN AS a length, never that it lasts longer', () => {
    for (const seed of SEEDS) {
      const instance = generate('note_shape_length', { grade: 0, seed, atoms: [] });
      expect(instance.feedback.correct).toContain('written as');
      expect(instance.feedback.correct).not.toContain('lasts longer');
    }
  });

  test('every shape it names is one of the four, and is in the grade scope', () => {
    for (const seed of SEEDS) {
      const instance = generate('note_shape_length', { grade: 0, seed, atoms: [] });
      expect(['semibreve', 'minim', 'crotchet', 'quaver']).toContain(instance.answer.canonical);
    }
  });

  test('the name and its length are taught in the same breath, never split', () => {
    const instance = generate('note_shape_length', { grade: 0, seed: 0, atoms: [noteShapeAtom('minim')] });
    expect(instance.feedback.correct).toContain('minim');
    expect(instance.feedback.correct).toContain('2 beats');
  });
});
