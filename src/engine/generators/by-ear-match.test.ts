// by_ear_match (theory-by-ear U2). The invariant that carries this template is
// that the played music is AUDIBLY different when the answer says it is. A
// mutation that silently produces identical music would make every item
// unanswerable while every structural assertion still passed.

import { generate } from './index';
import { musicToAbc } from '../../music/abc-emitter';
import type { Music, NoteEvent } from '../../music/types';
import { validate } from '../validator';

const RESTS_G1 = ['rest:crotchet', 'rest:minim', 'rest:semibreve'];

function make(seed = 0, source = 'rest_completion', grade = 1, atoms = RESTS_G1) {
  return generate('by_ear_match', { grade, seed, atoms, source });
}

function played(inst: ReturnType<typeof make>): Music {
  return (inst.interaction.config as { played_music: Music }).played_music;
}

function verdictOf(inst: ReturnType<typeof make>) {
  return inst.answer.canonical as { verdict: 'same' | 'different'; position: number | null };
}

function totalUnits(music: Music): number {
  return music.voices[0].events.length;
}

describe('by_ear_match', () => {
  test('a "different" item really sounds different — the emitted abc, not a flag', () => {
    let checked = 0;
    for (let seed = 0; seed < 60; seed++) {
      const inst = make(seed);
      if (verdictOf(inst).verdict !== 'different') continue;
      expect(musicToAbc(played(inst))).not.toBe(musicToAbc(inst.stimulus.music as Music));
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('a "same" item is byte-identical when emitted, so the honest answer is same', () => {
    let checked = 0;
    for (let seed = 0; seed < 60; seed++) {
      const inst = make(seed);
      if (verdictOf(inst).verdict !== 'same') continue;
      expect(musicToAbc(played(inst))).toBe(musicToAbc(inst.stimulus.music as Music));
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('neither answer is right for every seed, so the first tap is not a free guess', () => {
    const verdicts = new Set(Array.from({ length: 60 }, (_, s) => verdictOf(make(s)).verdict));
    expect(verdicts).toEqual(new Set(['same', 'different']));
  });

  test('the mutation never changes a duration, so bar totals survive (KTD9)', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      const before = inst.stimulus.music as Music;
      const after = played(inst);
      expect(totalUnits(after)).toBe(totalUnits(before));
      for (let i = 0; i < before.voices[0].events.length; i++) {
        expect(after.voices[0].events[i].type).toBe(before.voices[0].events[i].type);
        expect((after.voices[0].events[i] as NoteEvent).dur).toBe((before.voices[0].events[i] as NoteEvent).dur);
      }
    }
  });

  test('exactly one event differs on a "different" item, and the canonical index names it', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      const { verdict, position } = verdictOf(inst);
      if (verdict !== 'different') continue;
      const before = inst.stimulus.music as Music;
      const after = played(inst);
      const differing = before.voices[0].events.flatMap((ev, i) =>
        (ev as NoteEvent).pitch !== (after.voices[0].events[i] as NoteEvent).pitch ? [i] : [],
      );
      expect(differing).toEqual([position]);
    }
  });

  test('the altered note is always a tappable position, never a rest or a barline', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = make(seed);
      const { position } = verdictOf(inst);
      if (position === null) continue;
      const positions = (inst.interaction.config as { positions: number[] }).positions;
      expect(positions).toContain(position);
      expect((inst.stimulus.music as Music).voices[0].events[position].type).toBe('note');
    }
  });

  test('every distractor has its own line, and no two share one', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = make(seed);
      const reasons = inst.feedback.by_distractor ?? {};
      for (const d of inst.distractors as string[]) expect(typeof reasons[d]).toBe('string');
      expect(new Set(Object.values(reasons)).size).toBe(inst.distractors.length);
      expect(Object.values(reasons)).not.toContain(inst.feedback.incorrect);
    }
  });

  test('an unaltered position is told what is written there, not just that it is wrong', () => {
    const inst = make(0);
    const positions = (inst.interaction.config as { positions: number[] }).positions;
    const events = (inst.stimulus.music as Music).voices[0].events;
    for (const d of inst.distractors as string[]) {
      if (!d.startsWith('pos:')) continue;
      const i = Number(d.slice(4));
      // The learner-facing name, never the internal "B4" — the octave digit is
      // an implementation detail and reads as a typo on the card.
      const written = (events[i] as NoteEvent).pitch;
      expect(inst.feedback.by_distractor?.[d]).toContain(written.replace(/-?\d+$/, ''));
      expect(inst.feedback.by_distractor?.[d]).not.toContain(written);
    }
  });

  test('the srs tags are the source’s own atoms, suffixed — by-ear credit, never written', () => {
    const inst = make(0);
    expect(inst.srs_tags.length).toBeGreaterThan(0);
    for (const tag of inst.srs_tags) expect(tag.endsWith(':by_ear')).toBe(true);
  });

  test('a source that emits no music is refused rather than served silently', () => {
    expect(() => generate('by_ear_match', { grade: 1, seed: 0, atoms: ['term:cantabile'], source: 'term_meaning' })).toThrow();
  });

  test('a missing source is a loud failure, not a default', () => {
    expect(() => generate('by_ear_match', { grade: 1, seed: 0, atoms: RESTS_G1 })).toThrow();
  });

  test('seeds 0..99 validate', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(validate(make(seed))).toEqual({ ok: true, errors: [] });
    }
  });
});

// A hook that rejects nothing equals no hook. These feed it instances the
// generator cannot produce.
describe('the by_ear_match validator hook recomputes rather than trusts', () => {
  function tampered(mutate: (inst: ReturnType<typeof make>) => void) {
    const inst = JSON.parse(JSON.stringify(make(0))) as ReturnType<typeof make>;
    mutate(inst);
    return validate(inst);
  }

  test('a canonical position that does not name the altered note is rejected', () => {
    const { verdict, position } = verdictOf(make(0));
    expect(verdict).toBe('different'); // else the tamper below is vacuous
    const result = tampered((i) => {
      (i.answer.canonical as { position: number }).position = position === 0 ? 1 : 0;
    });
    expect(result.ok).toBe(false);
  });

  test('claiming "same" while the played music differs is rejected', () => {
    const seed = Array.from({ length: 40 }, (_, s) => s).find((s) => verdictOf(make(s)).verdict === 'different');
    const inst = JSON.parse(JSON.stringify(make(seed))) as ReturnType<typeof make>;
    inst.answer.canonical = { verdict: 'same', position: null };
    expect(validate(inst).ok).toBe(false);
  });

  test('a played bar whose duration changed is rejected — that alters the bar, not the pitch', () => {
    const result = tampered((i) => {
      const ev = played(i).voices[0].events.find((e) => e.type === 'note') as NoteEvent;
      ev.dur = ev.dur === 'crotchet' ? 'minim' : 'crotchet';
    });
    expect(result.ok).toBe(false);
  });
});
