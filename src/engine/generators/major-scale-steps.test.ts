// major_scale_steps (Grade 1, chromaticly-e3z.15). The invariants are the
// scale's own: the pattern is T T S T T T S in every key, the semitones fall
// between the 3rd/4th and the 7th/8th, and the corrupted stimulus really is
// corrupt at the degree the answer names.

import { generate } from './index';
import type { Music, NoteEvent } from '../../music/types';
import { validate } from '../validator';
import { pitchSemitone } from '../interval-quality';

const ATOMS = ['major_steps:C', 'major_steps:G', 'major_steps:D', 'major_steps:F'];
const SEEDS = Array.from({ length: 40 }, (_, i) => i);

function instanceAt(seed: number, atoms: string[] = ATOMS) {
  return generate('major_scale_steps', { grade: 1, seed, atoms });
}

function pitchesOf(music: Music): string[] {
  return music.voices[0].events.filter((ev): ev is NoteEvent => ev.type === 'note').map((ev) => ev.pitch);
}

/** Semitones between adjacent scale notes, seven of them for eight notes. */
function stepsOf(pitches: string[]): number[] {
  return pitches.slice(1).map((p, i) => pitchSemitone(p) - pitchSemitone(pitches[i]));
}

describe('major_scale_steps — the rendered scale really is a major scale', () => {
  test.each(SEEDS)('seed %i renders one ascending octave, eight notes', (seed) => {
    const pitches = pitchesOf(instanceAt(seed).stimulus.music as Music);
    expect(pitches).toHaveLength(8);
    expect(pitchSemitone(pitches[7]) - pitchSemitone(pitches[0])).toBe(12);
  });

  // The 'spot' variant deliberately breaks the pattern, so it is excluded here
  // and checked on its own below.
  test('every uncorrupted stimulus steps 2 2 1 2 2 2 1', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed);
      if (inst.prompt.includes('is wrong')) continue;
      expect(stepsOf(pitchesOf(inst.stimulus.music as Music))).toEqual([2, 2, 1, 2, 2, 2, 1]);
    }
  });

  test('the spot variant breaks the pattern at exactly the degree it asks about', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed);
      if (!inst.prompt.includes('is wrong')) continue;
      const steps = stepsOf(pitchesOf(inst.stimulus.music as Music));
      const degree = Number((inst.answer.canonical as string)[0]);
      // A one-semitone shift at degree d moves the step into it and the step
      // out of it, and nothing else.
      const wrongSteps = steps.map((s, i) => (s === [2, 2, 1, 2, 2, 2, 1][i] ? null : i)).filter((i) => i !== null);
      expect(wrongSteps).toEqual([degree - 2, degree - 1]);
    }
  });
});

describe('major_scale_steps — what the exercise asks', () => {
  test('all three variants appear', () => {
    const seen = new Set(
      SEEDS.map((s) => {
        const p = instanceAt(s).prompt;
        return p.includes('Which pattern') ? 'pattern' : p.includes('is wrong') ? 'spot' : 'where';
      }),
    );
    expect([...seen].sort()).toEqual(['pattern', 'spot', 'where']);
  });

  test('the pattern answer is the real one, and no distractor is', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed);
      if (!inst.prompt.includes('Which pattern')) continue;
      expect(inst.answer.canonical).toBe('T T S T T T S');
      expect(inst.distractors).not.toContain('T T S T T T S');
    }
  });

  test('the where answer is always one of the two real semitone pairs', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed);
      if (!inst.prompt.includes('semitone between them')) continue;
      expect(['3rd and 4th', '7th and 8th']).toContain(inst.answer.canonical);
      for (const d of inst.distractors) expect(['3rd and 4th', '7th and 8th']).not.toContain(d);
    }
  });

  test('no option is ever repeated within an item', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed);
      const options = [inst.answer.canonical as string, ...(inst.distractors as string[])];
      expect(new Set(options).size).toBe(options.length);
    }
  });

  test('every wrong answer is explained individually, never with one shared string', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt(seed);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors) expect(typeof reasons[d as string]).toBe('string');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });
});

describe('major_scale_steps — boundaries', () => {
  test('an atom set naming no major key fails loud', () => {
    expect(() => instanceAt(0, ['key_sig:C_major'])).toThrow();
  });

  test('seeds 0..99 all produce a validator-clean instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(validate(instanceAt(seed))).toEqual({ ok: true, errors: [] });
    }
  });
});
