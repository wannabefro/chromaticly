// cadence_recognition (Grade 5, chromaticly-e3z.5). The invariants here are the
// syllabus's own boundaries — three cadences, four keys, no interrupted — plus
// the one that makes the exercise teach rather than test: the chords rendered
// must actually be the cadence the answer claims.

import { generate } from './index';
import type { ChordEvent, Music, NoteEvent } from '../../music/types';
import { CADENCE_KEYS, CADENCE_KINDS, CADENCES } from './cadence-recognition';
import { buildTriad } from './chord-recognition';

const ATOMS = CADENCE_KINDS.map((k) => `cadence:${k}`);
const CHOOSE_ATOMS = CADENCE_KINDS.map((k) => `cadence_choose:${k}`);
const SEEDS = Array.from({ length: 40 }, (_, i) => i);

function instanceAt(seed: number, atoms: string[] = ATOMS) {
  return generate('cadence_recognition', { grade: 5, seed, atoms });
}

function trebleChords(music: Music): ChordEvent[] {
  return music.voices[0].events.filter((ev): ev is ChordEvent => ev.type === 'chord');
}

function bassNotes(music: Music): NoteEvent[] {
  return music.voices[1].events.filter((ev): ev is NoteEvent => ev.type === 'note');
}

describe('cadence_recognition — the syllabus boundary', () => {
  test('only the four named keys are ever used, never the wider grade-5 key set', () => {
    const keys = new Set<string>();
    for (const seed of SEEDS) {
      const music = instanceAt(seed).stimulus.music as Music;
      keys.add(music.key_sig!.replace('_major', ''));
    }
    expect([...keys].sort()).toEqual([...CADENCE_KEYS].sort());
  });

  // The interrupted cadence is Grade 6. Offering it as a distractor would name a
  // cadence the learner has no way to place.
  test('the interrupted cadence never appears, as an answer or a distractor', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed);
      expect(inst.answer.canonical).not.toBe('interrupted');
      expect(inst.distractors).not.toContain('interrupted');
    }
  });

  test('a lesson naming one cadence only ever draws that one', () => {
    for (const kind of CADENCE_KINDS) {
      for (const seed of [0, 1, 2, 3, 4]) {
        expect(instanceAt(seed, [`cadence:${kind}`]).srs_tags).toEqual([`cadence:${kind}`]);
      }
    }
  });

  test('an atom set naming no cadence fails loud', () => {
    expect(() => instanceAt(0, ['chord:I:a'])).toThrow();
  });
});

describe('cadence_recognition — the rendered chords are the cadence claimed', () => {
  // The invariant a hardcoded stimulus would break: the notes on the staff must
  // be the numerals the answer and feedback talk about.
  test.each(SEEDS)('seed %i renders exactly the chords its cadence names', (seed) => {
    const inst = instanceAt(seed);
    const kind = inst.srs_tags[0].split(':')[1] as (typeof CADENCE_KINDS)[number];
    const spec = CADENCES[kind];
    const music = inst.stimulus.music as Music;
    const key = music.key_sig!.replace('_major', '');
    const chords = trebleChords(music);

    // 'name' shows the pair; the two chord-choice variants show one.
    const expectedNumerals =
      chords.length === 2
        ? null // checked below against the pair
        : [inst.prompt.includes('ends a') ? spec.ends : inst.answer.canonical];

    if (chords.length === 2) {
      const [first, second] = chords;
      expect(second.pitches).toEqual(buildTriad('treble', 5, key, spec.ends));
      expect(spec.approaches.map((n) => buildTriad('treble', 5, key, n))).toContainEqual(first.pitches);
    } else {
      expect(chords).toHaveLength(1);
      expect(expectedNumerals).not.toBeNull();
    }
  });

  test.each(SEEDS)('seed %i puts the chord root in the bass, one per chord', (seed) => {
    const music = instanceAt(seed).stimulus.music as Music;
    const chords = trebleChords(music);
    const bass = bassNotes(music);
    expect(bass).toHaveLength(chords.length);
    for (let i = 0; i < bass.length; i++) {
      // Same letter as the triad's root, an octave or more below it.
      expect(bass[i].pitch[0]).toBe(chords[i].pitches[0][0]);
    }
  });

  test('every stimulus is a grand staff — the bass move is how a cadence is read', () => {
    for (const seed of SEEDS) {
      const music = instanceAt(seed).stimulus.music as Music;
      expect(music.staves).toEqual(['treble', 'bass']);
    }
  });
});

const variantOf = (prompt: string): string =>
  prompt.includes('Which cadence') ? 'name' : prompt.includes('comes before') ? 'approach' : 'complete';

describe('cadence_recognition — what each variant asks', () => {
  // chromaticly-ic5.6. The atom decides the question, both ways round.
  test('a cadence:* atom only ever asks for the name', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed);
      expect(variantOf(inst.prompt)).toBe('name');
      expect(inst.srs_tags[0].startsWith('cadence:')).toBe(true);
    }
  });

  test('a cadence_choose:* atom asks for a chord, and reaches both halves', () => {
    const variants = new Set<string>();
    for (const seed of SEEDS) {
      const inst = instanceAt(seed, CHOOSE_ATOMS);
      variants.add(variantOf(inst.prompt));
      expect(inst.srs_tags[0].startsWith('cadence_choose:')).toBe(true);
      expect(['I', 'IV', 'V']).toContain(inst.answer.canonical);
    }
    expect([...variants].sort()).toEqual(['approach', 'complete']);
  });

  test.each(CADENCE_KINDS)('a single due atom cadence_choose:%s is a whole item', (kind) => {
    const inst = instanceAt(0, [`cadence_choose:${kind}`]);
    expect(inst.srs_tags).toEqual([`cadence_choose:${kind}`]);
    expect(inst.distractors).not.toContain(inst.answer.canonical);
  });

  // The discriminating variant: perfect and plagal both end on I, so asking what
  // ENDS the cadence cannot tell them apart. Asking what precedes it can.
  test('the approach variant answers V for perfect and IV for plagal', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed, CHOOSE_ATOMS);
      if (!inst.prompt.includes('comes before')) continue;
      const kind = inst.srs_tags[0].split(':')[1] as (typeof CADENCE_KINDS)[number];
      expect(CADENCES[kind].approaches).toContain(inst.answer.canonical);
    }
  });

  test('every wrong answer is explained individually, never with one shared string', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors) expect(typeof reasons[d]).toBe('string');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });

  test('the prompt takes the right article — "an imperfect", never "a imperfect"', () => {
    for (const seed of SEEDS) {
      expect(instanceAt(seed).prompt).not.toMatch(/\ba imperfect\b/);
    }
  });
});
