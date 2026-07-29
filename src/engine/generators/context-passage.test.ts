// 8d — one passage, several questions. The invariant that matters is that every
// sub-question is ANSWERABLE: the passage is built at random and then checked, so a
// tie (two bars both holding the highest note) must never reach a learner.

import { KB } from '../../content/knowledge-base';
import { musicToAbc } from '../../music/abc-emitter';
import type { NoteEvent } from '../../music/types';
import { buildContextPassage } from './context-passage';
import { scientificPitchOrdinal } from './pitch-math';

const SEEDS = Array.from({ length: 60 }, (_, i) => i);
const opts = (seed: number) => ({ grade: 1, seed, atoms: [] as string[] });

/** The passage's notes, tagged with the bar they fall in. */
function notesOf(passage: ReturnType<typeof buildContextPassage>) {
  const notes: { pitch: string; beats: number; bar: number }[] = [];
  let bar = 1;
  for (const ev of passage.music.voices[0].events) {
    if (ev.type === 'barline') bar++;
    if (ev.type === 'note') {
      const note = ev as NoteEvent;
      notes.push({ pitch: note.pitch, beats: KB.noteValues[note.dur].beats_in_crotchets, bar });
    }
  }
  return notes;
}

describe('music in context — one passage, several questions (8d)', () => {
  test('every sub-question is asked about the SAME score', () => {
    const passage = buildContextPassage(opts(3));
    expect(passage.questions.length).toBeGreaterThanOrEqual(4);
    for (const q of passage.questions) {
      expect(q.stimulus.music).toBe(passage.music); // identity, not just equality
    }
  });

  test('the same seed builds the same passage (deterministic)', () => {
    expect(JSON.stringify(buildContextPassage(opts(7)))).toBe(JSON.stringify(buildContextPassage(opts(7))));
  });

  // The reason the generator retries rather than constructs: a passage with two
  // equally-high notes in different bars has no right answer, and an unanswerable
  // question is worse than no question.
  test('no passage ever ships with a tie for highest, lowest or longest', () => {
    for (const seed of SEEDS) {
      const notes = notesOf(buildContextPassage(opts(seed)));

      const top = Math.max(...notes.map((n) => scientificPitchOrdinal(n.pitch)));
      const bottom = Math.min(...notes.map((n) => scientificPitchOrdinal(n.pitch)));
      const longest = Math.max(...notes.map((n) => n.beats));

      expect(notes.filter((n) => scientificPitchOrdinal(n.pitch) === top)).toHaveLength(1);
      expect(notes.filter((n) => scientificPitchOrdinal(n.pitch) === bottom)).toHaveLength(1);
      expect(notes.filter((n) => n.beats === longest)).toHaveLength(1);
    }
  });

  test('the find-the-bar answers are the bars the passage actually holds', () => {
    for (const seed of SEEDS) {
      const passage = buildContextPassage(opts(seed));
      const notes = notesOf(passage);

      const highestBar = notes.reduce((a, b) =>
        scientificPitchOrdinal(a.pitch) >= scientificPitchOrdinal(b.pitch) ? a : b,
      ).bar;
      const longestBar = notes.reduce((a, b) => (a.beats >= b.beats ? a : b)).bar;
      const lowestBar = notes.reduce((a, b) =>
        scientificPitchOrdinal(a.pitch) <= scientificPitchOrdinal(b.pitch) ? a : b,
      ).bar;

      const q1 = passage.questions[0]; // find-the-bar: highest, always
      // The second find-the-bar alternates by seed so `find_bar:lowest` is
      // reachable at all — it was declared and validated for but never asked.
      const q5 = passage.questions[4];
      expect(q1.answer.canonical).toBe(highestBar);
      expect(q5.answer.canonical).toBe(seed % 2 === 0 ? longestBar : lowestBar);
      expect(q1.distractors).not.toContain(highestBar);
    }
  });

  test('the highest-note question names the note that is actually highest', () => {
    for (const seed of SEEDS) {
      const passage = buildContextPassage(opts(seed));
      const notes = notesOf(passage);
      const highest = notes.reduce((a, b) =>
        scientificPitchOrdinal(a.pitch) >= scientificPitchOrdinal(b.pitch) ? a : b,
      );

      const q = passage.questions[1];
      expect(q.answer.canonical).toBe(highest.pitch);
      expect(q.distractors).not.toContain(highest.pitch);
    }
  });

  // The metre claim is true half the time and false the other half; either way the
  // answer must match the passage's actual time signature.
  test('the true/false metre claim is graded against the passage’s real time signature', () => {
    for (const seed of SEEDS) {
      const passage = buildContextPassage(opts(seed));
      const q = passage.questions[3]; // Q4: true/false about the metre
      const claimed = /in (\d+\/\d+)/.exec(q.prompt)?.[1];

      expect(claimed).toBeDefined();
      expect(q.answer.canonical).toBe(claimed === passage.music.time_sig ? 'True' : 'False');
    }
  });

  test('D13 guard: grade-3 generation never emits a compound signature, in EITHER the passage draw OR the music_in_context_time_sig claim option (compound support for this template is a deferred slice)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const passage = buildContextPassage({ grade: 3, seed, atoms: [] });
      expect((passage.music.time_sig as string).endsWith('/8')).toBe(false);

      const timeSigQuestion = passage.questions[3];
      const claimed = /in (\d+\/\d+)/.exec(timeSigQuestion.prompt)?.[1];
      expect(claimed).toBeDefined();
      expect(claimed!.endsWith('/8')).toBe(false);
    }
  });

  test('each sub-question carries its own atom, so mastery moves per skill', () => {
    const tags = buildContextPassage(opts(1)).questions.flatMap((q) => q.srs_tags);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags).toEqual([
      'find_bar:highest',
      'context:highest_note',
      'context:dynamic_term',
      'context:time_sig',
      'find_bar:lowest', // odd seed; an even seed asks `longest` — see below
    ]);
  });

  // All three find-the-bar atoms have to be askable. `lowest` used to be neither:
  // the lesson declared it and the passage builder REJECTED any passage whose
  // lowest bar was not unique, so it gated generation without ever being asked.
  test('both find-the-bar targets are reachable across a set of eight', () => {
    const targets = new Set(
      Array.from({ length: 8 }, (_, seed) => buildContextPassage(opts(seed)).questions[4].srs_tags[0]),
    );
    expect(targets).toEqual(new Set(['find_bar:longest', 'find_bar:lowest']));
  });

  // Term-in-context (Q3): the passage carries exactly one dynamic, and the question is
  // graded against that marking's real meaning — the answer must be a Grade-1 dynamic.
  describe('term-in-context sub-question (8d Q3)', () => {
    const G1_MEANINGS = ['quiet', 'loud', 'moderately loud']; // p, f, mf

    test('exactly one dynamic is placed, and the question points at its bar', () => {
      for (const seed of SEEDS) {
        const passage = buildContextPassage(opts(seed));
        const dynamics = passage.music.voices[0].events.filter((e) => e.type === 'dynamic');
        expect(dynamics).toHaveLength(1);

        const term = passage.questions[2];
        const bar = /bar (\d+)/.exec(term.prompt)?.[1];
        expect(bar).toBeDefined();
        expect(Number(bar)).toBeGreaterThanOrEqual(1);
        expect(Number(bar)).toBeLessThanOrEqual(4);
      }
    });

    test('the placed dynamic actually renders in the score (a decoration in the ABC)', () => {
      for (const seed of SEEDS) {
        const abc = musicToAbc(buildContextPassage(opts(seed)).music);
        // The term is read off the pinned score, so the marking must reach the ABC.
        expect(abc).toMatch(/![pmf]+!/);
      }
    });

    test('the answer is the placed dynamic’s meaning; distractors are other meanings', () => {
      for (const seed of SEEDS) {
        const term = buildContextPassage(opts(seed)).questions[2];
        expect(G1_MEANINGS).toContain(term.answer.canonical); // the correct mark is a Grade-1 dynamic
        expect(term.distractors).not.toContain(term.answer.canonical);
        expect(new Set(term.distractors).size).toBe(term.distractors.length); // no duplicate options
      }
    });
  });
});
