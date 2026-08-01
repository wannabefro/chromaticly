// note_grouping (Grades 1-5, chromaticly-18o). The invariant is that the
// correct option is beamed by the metre and the wrong ones are not, so every
// assertion below is about beams: where ABC glues notes together, and where a
// space breaks them.

import { generate } from './index';
import { musicToAbc } from '../../music/abc-emitter';
import type { Music } from '../../music/types';
import { validate } from '../validator';
import { barUnitsFor } from './bar-math';

const SEEDS = Array.from({ length: 24 }, (_, i) => i);

function instanceAt(sig: string, seed: number, grade = 5) {
  return generate('note_grouping', { grade, seed, atoms: [`grouping:${sig}`] });
}

function optionsOf(inst: ReturnType<typeof instanceAt>): Record<string, Music> {
  return (inst.interaction.config as { option_music: Record<string, Music> }).option_music;
}

/** Beam-group sizes read back off the emitted ABC, not off the model. */
function beamedGroups(music: Music): number[] {
  const body = musicToAbc(music).split('\n').filter(Boolean).pop()!;
  return body
    .replace(/\|+/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => (token.match(/[A-Ga-g],*'*\d*/g) ?? []).length)
    .filter((n) => n > 0);
}

describe('note_grouping — the correct option is the one the metre beams', () => {
  test.each(['2/4', '3/4', '4/4', '2/2', '3/2', '3/8', '6/8', '9/8', '12/8', '5/8', '7/8'])(
    '%s: the answer label is exactly the beaming the emitter produces with no override',
    (sig) => {
      const inst = instanceAt(sig, 0);
      const correct = optionsOf(inst)[inst.answer.canonical as string];
      expect(correct.beam_groups).toBeUndefined();
      expect(beamedGroups(correct).join(' + ')).toBe(inst.answer.canonical);
    },
  );

  test('every option holds the same notes — only the beams differ', () => {
    for (const sig of ['3/4', '6/8', '5/8']) {
      const options = Object.values(optionsOf(instanceAt(sig, 1)));
      const counts = options.map((m) => m.voices[0].events.filter((e) => e.type === 'note').length);
      expect(new Set(counts).size).toBe(1);
      const totals = options.map((m) => beamedGroups(m).reduce((a, b) => a + b, 0));
      expect(new Set(totals).size).toBe(1);
    }
  });

  test('each option fills exactly one bar of its time signature', () => {
    for (const sig of ['2/4', '3/2', '9/8', '7/8']) {
      for (const music of Object.values(optionsOf(instanceAt(sig, 2)))) {
        const notes = music.voices[0].events.filter((e) => e.type === 'note').length;
        const unit = music.voices[0].events.find((e) => e.type === 'note')!;
        const perNote = (unit as { dur: string }).dur === 'quaver' ? 4 : 2;
        expect(notes * perNote).toBe(barUnitsFor(sig));
      }
    }
  });

  test('no distractor is beamed the correct way', () => {
    for (const sig of ['2/4', '4/4', '6/8', '12/8', '5/8']) {
      const inst = instanceAt(sig, 3);
      const options = optionsOf(inst);
      for (const d of inst.distractors as string[]) {
        expect(options[d].beam_groups).toBeDefined();
        expect(beamedGroups(options[d]).join(' + ')).toBe(d);
        expect(d).not.toBe(inst.answer.canonical);
      }
    }
  });
});

describe('note_grouping — the groupings the syllabus names', () => {
  // Threes versus twos is the whole difference between 6/8 and 3/4.
  test.each([
    ['6/8', '3 + 3'],
    ['9/8', '3 + 3 + 3'],
    ['12/8', '3 + 3 + 3 + 3'],
    ['3/4', '2 + 2 + 2'],
    ['2/4', '2 + 2'],
    ['4/4', '2 + 2 + 2 + 2'],
    ['2/2', '4 + 4'],
    ['5/8', '3 + 2'],
    ['7/8', '3 + 2 + 2'],
  ])('%s groups as %s', (sig, expected) => {
    expect(instanceAt(sig, 4).answer.canonical).toBe(expected);
  });

  test('3/4 offers the 6/8 reading as a wrong answer, and 6/8 offers the 3/4 one', () => {
    expect(instanceAt('3/4', 5).distractors).toContain('3 + 3');
    expect(instanceAt('6/8', 5).distractors).toContain('2 + 2 + 2');
  });

  test('an irregular metre offers its groups the other way round', () => {
    expect(instanceAt('5/8', 6).distractors).toContain('2 + 3');
    expect(instanceAt('7/8', 6).distractors).toContain('2 + 2 + 3');
  });

  test('a metre whose beat holds one quaver is filled with semiquavers instead', () => {
    const music = Object.values(optionsOf(instanceAt('3/8', 7)))[0];
    expect((music.voices[0].events[0] as { dur: string }).dur).toBe('semiquaver');
  });
});

describe('note_grouping — boundaries', () => {
  test('an atom set naming no time signature fails loud', () => {
    expect(() => generate('note_grouping', { grade: 2, seed: 0, atoms: ['metre:3/4'] })).toThrow();
  });

  test('a signature the grade cannot render is not drawn from', () => {
    expect(() => generate('note_grouping', { grade: 1, seed: 0, atoms: ['grouping:6/8'] })).toThrow();
  });

  test('every wrong answer is explained individually, never with one shared string', () => {
    for (const seed of SEEDS) {
      const inst = instanceAt('6/8', seed, 3);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors) expect(typeof reasons[d as string]).toBe('string');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
    }
  });

  test('the tag names the time signature, so credit lands on that metre alone', () => {
    expect(instanceAt('6/8', 0, 3).srs_tags).toEqual(['grouping:6/8']);
    expect(instanceAt('3/4', 0, 1).srs_tags).toEqual(['grouping:3/4']);
  });

  test('seeds 0..99 all produce a validator-clean instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(validate(instanceAt('9/8', seed, 3))).toEqual({ ok: true, errors: [] });
    }
  });
});
