// note_grouping_metre_id (chromaticly-lgi): the reverse of note_grouping — the
// beaming is printed and the metre is read off it. The item only tests beam
// reading if the printed signature is hidden and the options cannot be told
// apart by counting notes, so both are asserted.

import { generate } from './index';
import { musicToAbc } from '../../music/abc-emitter';
import type { Music } from '../../music/types';
import { validate } from '../validator';

function make(sig: string, seed = 0, grade = 5) {
  return generate('note_grouping_metre_id', { grade, seed, atoms: [`grouping:${sig}`] });
}

/** Beam-group sizes read back off the emitted ABC, not off the model. */
function beamedGroups(music: Music): number[] {
  return musicToAbc(music)
    .split('\n')
    .filter(Boolean)
    .pop()!
    .replace(/\|+/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => (token.match(/[A-Ga-g],*'*\d*/g) ?? []).length)
    .filter((n) => n > 0);
}

describe('note_grouping_metre_id', () => {
  test('the time signature is hidden, not absent — the bar still beams from its own metre', () => {
    const music = make('6/8').stimulus.music as Music;
    expect(music.time_sig).toBe('6/8');
    expect(music.time_sig_hidden).toBe(true);
    expect(musicToAbc(music)).not.toContain('M:6/8');
  });

  test('the printed beaming is the answer metre, never an override', () => {
    for (const sig of ['2/4', '3/4', '6/8', '9/8', '5/8']) {
      const inst = make(sig);
      const music = inst.stimulus.music as Music;
      expect(music.beam_groups).toBeUndefined();
      expect(inst.answer.canonical).toBe(sig);
      expect(beamedGroups(music).length).toBeGreaterThan(1);
    }
  });

  test('6/8 offers 3/4 — the same six quavers, so counting them cannot answer it', () => {
    expect(make('6/8', 1, 3).distractors).toContain('3/4');
  });

  test('a distractor never shares the answer beaming, or two options would be right', () => {
    for (const sig of ['2/4', '4/4', '6/8', '12/8', '7/8']) {
      const inst = make(sig, 2);
      const correct = beamedGroups(inst.stimulus.music as Music).join(' + ');
      for (const d of inst.distractors as string[]) {
        const other = generate('note_grouping_metre_id', { grade: 5, seed: 2, atoms: [`grouping:${d}`] });
        expect(beamedGroups(other.stimulus.music as Music).join(' + ')).not.toBe(correct);
      }
    }
  });

  test('every wrong metre says what it would have beamed instead', () => {
    const inst = make('9/8', 3);
    const reasons = inst.feedback.by_distractor ?? {};
    for (const d of inst.distractors as string[]) expect(reasons[d]).toContain('would beam');
    expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
  });

  test('the tag names the metre, so credit lands on that grouping alone', () => {
    expect(make('6/8', 0, 3).srs_tags).toEqual(['grouping:6/8']);
  });

  test('an atom set naming no grouping fails loud', () => {
    expect(() => generate('note_grouping_metre_id', { grade: 3, seed: 0, atoms: ['metre:6/8'] })).toThrow();
  });

  test('a signature the grade cannot render is not drawn from', () => {
    expect(() => make('6/8', 0, 1)).toThrow();
  });

  test('seeds 0..99 all produce a validator-clean instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(validate(make('9/8', seed, 3))).toEqual({ ok: true, errors: [] });
    }
  });
});
