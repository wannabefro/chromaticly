// by_ear_match (theory-by-ear U2). The invariant that carries this template is
// that the played music is AUDIBLY different when the answer says it is. A
// mutation that silently produces identical music would make every item
// unanswerable while every structural assertion still passed.

import { byEarPool, LESSONS } from '../../content/lessons';
import { deriveSeed } from '../rng';
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

// Both defects below need a sweep over the seeds SetRunner asks for.
describe('by_ear_match — the copy and the sound survive a full sweep', () => {
  const wired = LESSONS.filter((l) => l.by_ear_source);
  const sweep = wired.flatMap((lesson) =>
    Array.from({ length: 30 }, (_, plays) =>
      generate('by_ear_match', {
        grade: lesson.grade,
        seed: deriveSeed(plays, 0),
        atoms: byEarPool(lesson),
        source: lesson.by_ear_source!,
      }),
    ),
  );

  test('the sweep is wide enough to be worth reading', () => {
    expect(sweep.length).toBeGreaterThan(1000);
  });

  test('no feedback line reads "The note 12 note" — ordinal never falls back to a phrase', () => {
    const broken = sweep.flatMap((i) => Object.values(i.feedback.by_distractor ?? {}).filter((s) => /note \d+ note/.test(s)));
    expect(broken).toEqual([]);
  });

  // The altered note is a bare letter, so an earlier accidental carried onto it.
  const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SIGN: Record<string, number> = { '^': 1, '^^': 2, _: -1, __: -2, '=': 0 };

  const SHARPS = 'FCGDAEB';
  const FLATS = 'BEADGCF';
  // Circle of fifths, independent of the emitter's own key map.
  const SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  const FLAT_KEYS = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
  const SHARP_MINORS = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];
  const FLAT_MINORS = ['A', 'D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab'];

  function keyShifts(keyToken: string): Record<string, number> {
    const minor = keyToken.endsWith('m');
    const tonic = minor ? keyToken.slice(0, -1) : keyToken;
    const sharp = (minor ? SHARP_MINORS : SHARP_KEYS).indexOf(tonic);
    const flat = (minor ? FLAT_MINORS : FLAT_KEYS).indexOf(tonic);
    const out: Record<string, number> = {};
    if (sharp > 0) for (let i = 0; i < sharp; i++) out[SHARPS[i]] = 1;
    else if (flat > 0) for (let i = 0; i < flat; i++) out[FLATS[i]] = -1;
    return out;
  }

  function soundedSemitones(abc: string, keyToken = 'C'): number[] {
    const key = keyShifts(keyToken);
    const bar = new Map<string, number>();
    const out: number[] = [];
    for (const [, bars, sign, letter, marks] of abc.matchAll(/(\|+)|(?:(\^\^|__|\^|_|=)?([A-Ga-g])([',]*)\d*)/g)) {
      if (bars) {
        bar.clear(); // an accidental's scope ends at the barline
        continue;
      }
      const upper = letter.toUpperCase();
      const octave = (letter === upper ? 4 : 5) + (marks.match(/'/g)?.length ?? 0) - (marks.match(/,/g)?.length ?? 0);
      const slot = `${upper}${octave}`;
      // A bar accidental is per letter AND octave; a key accidental is per letter.
      const shift = sign ? SIGN[sign] : (bar.get(slot) ?? key[upper] ?? 0);
      bar.set(slot, shift);
      out.push((octave + 1) * 12 + SEMI[upper] + shift);
    }
    return out;
  }

  function pitchSemitone(pitch: string): number {
    const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/.exec(pitch)!;
    const shift = m[2] ? (m[2][0] === '#' ? m[2].length : -m[2].length) : 0;
    return (Number(m[3]) + 1) * 12 + SEMI[m[1]] + shift;
  }

  test('the emitted ABC sounds exactly the pitches the generator chose', () => {
    const wrong: string[] = [];
    for (const inst of sweep) {
      for (const music of [inst.stimulus.music as Music, (inst.interaction.config as { played_music: Music }).played_music]) {
        const lines = musicToAbc(music).trim().split('\n');
        const body = lines.pop()!;
        const keyToken = lines.find((l) => l.startsWith('K:'))!.slice(2).trim().split(/\s+/)[0];
        const wanted = music.voices[0].events.filter((e) => e.type === 'note').map((e) => pitchSemitone((e as NoteEvent).pitch));
        const sounded = soundedSemitones(body, keyToken);
        if (JSON.stringify(wanted) !== JSON.stringify(sounded)) wrong.push(`${inst.id}: K=${keyToken} ${body} -> ${sounded} want ${wanted}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test('the resolver itself catches a carried accidental, or the test above proves nothing', () => {
    expect(soundedSemitones('^F8 F8')).toEqual([66, 66]);
    expect(soundedSemitones('^F8 =F8')).toEqual([66, 65]);
    expect(soundedSemitones('^F8 | F8')).toEqual([66, 65]);
    expect(soundedSemitones('F8 | F8', 'G')).toEqual([66, 66]);
  });
});
