// 8d — one passage, several questions. The invariant that matters is that every
// sub-question is ANSWERABLE: the passage is built at random and then checked, so a
// tie (two bars both holding the highest note) must never reach a learner.

import { KB } from '../../content/knowledge-base';
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

      const [q1, , , q4] = passage.questions;
      expect(q1.answer.canonical).toBe(highestBar);
      expect(q4.answer.canonical).toBe(longestBar);
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
      const q = passage.questions[2];
      const claimed = /in (\d+\/\d+)/.exec(q.prompt)?.[1];

      expect(claimed).toBeDefined();
      expect(q.answer.canonical).toBe(claimed === passage.music.time_sig ? 'True' : 'False');
    }
  });

  test('each sub-question carries its own atom, so mastery moves per skill', () => {
    const tags = buildContextPassage(opts(1)).questions.flatMap((q) => q.srs_tags);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags).toEqual(['find_bar:highest', 'context:highest_note', 'context:time_sig', 'find_bar:longest']);
  });
});
