// by_ear_verify (theory-by-ear U1). The invariant that carries this template,
// same as by_ear_match: a "different" instance must be AUDIBLY different. A
// mutation that silently produces identical music makes every item
// unanswerable while every structural assertion still passes.

import { isByEarAtom, writtenAtomOf } from '../atoms';
import type { ChordEvent, Music, NoteEvent } from '../../music/types';
import { generate } from './index';
import { validate } from '../validator';
import { alterOneSoundingPitch, soundingRefs } from './by-ear-verify';

const ORNAMENT_ATOMS = ['ornament:trill', 'ornament:turn', 'ornament:upper_mordent', 'ornament:appoggiatura'];
const NOTE_ATOMS = ['note_read:treble:C4', 'note_read:treble:D4', 'note_read:treble:E4'];

function make(seed = 0, source = 'note_naming', grade = 1, atoms = NOTE_ATOMS) {
  return generate('by_ear_verify', { grade, seed, atoms, source });
}

function played(inst: ReturnType<typeof make>): Music {
  return (inst.interaction.config as { played_music: Music }).played_music;
}

function verdictOf(inst: ReturnType<typeof make>): 'Same' | 'Different' {
  return inst.answer.canonical as 'Same' | 'Different';
}

function noteMusic(pitch: string): Music {
  return { clef: 'treble', key_sig: null, time_sig: null, voices: [{ events: [{ type: 'note', pitch, dur: 'crotchet' }] }] };
}

describe('alterOneSoundingPitch — the mutation function that must never be a silent no-op', () => {
  test('a natural note steps to an audibly different pitch', () => {
    const music = noteMusic('C4');
    const altered = alterOneSoundingPitch(music, { eventIndex: 0, pitchIndex: null }, true);
    expect(altered).not.toBeNull();
    expect((altered!.voices[0].events[0] as NoteEvent).pitch).not.toBe('C4');
  });

  test('an enharmonic step that would sound identical is rejected, not silently emitted', () => {
    // E#4 stepped up drops its accidental to bare "F4" — the same sounding pitch.
    const music = noteMusic('E#4');
    const altered = alterOneSoundingPitch(music, { eventIndex: 0, pitchIndex: null }, true);
    expect(altered).toBeNull();
  });

  test('altering a chord tone changes only the targeted pitch, not the whole chord', () => {
    const music: Music = {
      clef: 'treble',
      key_sig: null,
      time_sig: null,
      voices: [{ events: [{ type: 'chord', pitches: ['C4', 'E4', 'G4'], dur: 'semibreve' }] }],
    };
    const altered = alterOneSoundingPitch(music, { eventIndex: 0, pitchIndex: 1 }, true);
    const pitches = (altered!.voices[0].events[0] as ChordEvent).pitches;
    expect(pitches[1]).not.toBe('E4');
    expect([pitches[0], pitches[2]]).toEqual(['C4', 'G4']);
  });

  test('the original music object is never mutated in place', () => {
    const music = noteMusic('C4');
    alterOneSoundingPitch(music, { eventIndex: 0, pitchIndex: null }, true);
    expect((music.voices[0].events[0] as NoteEvent).pitch).toBe('C4');
  });
});

describe('soundingRefs — the pool of pitches a mutation may target', () => {
  test('a single note yields exactly one ref', () => {
    const music = noteMusic('C4');
    expect(soundingRefs(music.voices[0].events)).toEqual([{ eventIndex: 0, pitchIndex: null }]);
  });

  test('a chord yields one ref per chord tone', () => {
    const events = [{ type: 'chord' as const, pitches: ['C4', 'E4', 'G4'], dur: 'semibreve' as const }];
    expect(soundingRefs(events)).toEqual([
      { eventIndex: 0, pitchIndex: 0 },
      { eventIndex: 0, pitchIndex: 1 },
      { eventIndex: 0, pitchIndex: 2 },
    ]);
  });

  test('a rest contributes no ref — there is nothing to alter its pitch', () => {
    const events = [{ type: 'rest' as const, dur: 'crotchet' as const }];
    expect(soundingRefs(events)).toEqual([]);
  });
});

describe('by_ear_verify — a single-note source', () => {
  test('a "Different" instance is played on a pitch that differs from the written one', () => {
    let checked = 0;
    for (let seed = 0; seed < 60; seed++) {
      const inst = make(seed);
      if (verdictOf(inst) !== 'Different') continue;
      const written = (inst.stimulus.music as Music).voices[0].events[0] as NoteEvent;
      const heard = played(inst).voices[0].events[0] as NoteEvent;
      expect(heard.pitch).not.toBe(written.pitch);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('a "Same" instance is event-for-event equal to the written music', () => {
    let checked = 0;
    for (let seed = 0; seed < 60; seed++) {
      const inst = make(seed);
      if (verdictOf(inst) !== 'Same') continue;
      expect(played(inst)).toEqual(inst.stimulus.music);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('there is no position step — the interaction never carries a positions list', () => {
    const inst = make(0);
    expect((inst.interaction.config as { positions?: unknown }).positions).toBeUndefined();
  });

  test('seeds 0..99 validate', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(validate(make(seed))).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('by_ear_verify — a chord source (KTD9, out of scope for by_ear_match)', () => {
  const CHORD_ATOMS = ['chord:I', 'chord:IV', 'chord:V'];

  function makeChord(seed: number) {
    return generate('by_ear_verify', { grade: 4, seed, atoms: CHORD_ATOMS, source: 'chord_recognition' });
  }

  test('a "Different" chord instance alters exactly one tone, not the whole chord', () => {
    let checked = 0;
    for (let seed = 0; seed < 60; seed++) {
      const inst = makeChord(seed);
      if (inst.answer.canonical !== 'Different') continue;
      const written = (inst.stimulus.music as Music).voices[0].events[0] as ChordEvent;
      const heard = (inst.interaction.config as { played_music: Music }).played_music.voices[0].events[0] as ChordEvent;
      const differing = written.pitches.filter((p, i) => p !== heard.pitches[i]);
      expect(differing.length).toBe(1);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('by_ear_verify — a rhythmic source alters a duration, never a pitch', () => {
  function makeRhythm(seed: number) {
    return generate('by_ear_verify', { grade: 4, seed, atoms: [], source: 'note_value_compare' });
  }

  test('a "Different" rhythmic instance changes a duration and leaves every pitch alone', () => {
    let checked = 0;
    for (let seed = 0; seed < 60; seed++) {
      const inst = makeRhythm(seed);
      if (inst.answer.canonical !== 'Different') continue;
      const written = (inst.stimulus.music as Music).voices[0].events as NoteEvent[];
      const heard = (inst.interaction.config as { played_music: Music }).played_music.voices[0].events as NoteEvent[];
      for (let i = 0; i < written.length; i++) expect(heard[i].pitch).toBe(written[i].pitch);
      expect(written.some((ev, i) => ev.dur !== heard[i].dur)).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('by_ear_verify — the single-atom pool Practice hands a due atom', () => {
  test('a pool of exactly one due by-ear atom draws that note without throwing', () => {
    expect(() =>
      generate('by_ear_verify', { grade: 1, seed: 0, atoms: ['note_read:treble:C4:by_ear'], source: 'note_naming' }),
    ).not.toThrow();
  });
});

describe('by_ear_verify — srs_tags credit the by-ear atom, never the written one', () => {
  test('every tag is :by_ear-suffixed and maps back to a written atom the lesson declares', () => {
    const inst = make(0);
    expect(inst.srs_tags.length).toBeGreaterThan(0);
    for (const tag of inst.srs_tags) {
      expect(isByEarAtom(tag)).toBe(true);
      expect(writtenAtomOf(tag)).not.toBe(tag);
    }
  });
});

describe('the by_ear_verify validator hook recomputes rather than trusts', () => {
  test('claiming "Same" while the played music differs is rejected', () => {
    const seed = Array.from({ length: 40 }, (_, s) => s).find((s) => verdictOf(make(s)) === 'Different');
    const inst = JSON.parse(JSON.stringify(make(seed))) as ReturnType<typeof make>;
    inst.answer.canonical = 'Same';
    expect(validate(inst).ok).toBe(false);
  });

  test('claiming "Different" while the played music is identical is rejected', () => {
    const seed = Array.from({ length: 40 }, (_, s) => s).find((s) => verdictOf(make(s)) === 'Same');
    const inst = JSON.parse(JSON.stringify(make(seed))) as ReturnType<typeof make>;
    inst.answer.canonical = 'Different';
    expect(validate(inst).ok).toBe(false);
  });

  test('a played event whose duration changed against a non-rhythmic source is rejected alongside the pitch it also changed', () => {
    const seed = Array.from({ length: 40 }, (_, s) => s).find((s) => verdictOf(make(s)) === 'Different');
    const inst = JSON.parse(JSON.stringify(make(seed))) as ReturnType<typeof make>;
    const ev = played(inst).voices[0].events[0] as NoteEvent;
    ev.dur = ev.dur === 'crotchet' ? 'minim' : 'crotchet';
    expect(validate(inst).ok).toBe(false);
  });

  test('a missing source is a loud failure, not a default', () => {
    expect(() => generate('by_ear_verify', { grade: 1, seed: 0, atoms: NOTE_ATOMS })).toThrow();
  });
});

// A two-option card must be a coin flip. It was 63% "Different" on release: the
// 1/3 rate was copied from by_ear_match, where answering "different" still costs
// a tap-where step. Found by /council 2026-08-06.
describe('by_ear_verify — a guesser gets no edge', () => {
  test('the verdict is near even across 300 seeds', () => {
    const verdicts = Array.from({ length: 300 }, (_, seed) =>
      make(seed).answer.canonical,
    );
    const same = verdicts.filter((v) => v === 'Same').length;
    expect(same).toBeGreaterThan(120);
    expect(same).toBeLessThan(180);
  });
});

// The mutation must follow the CREDIT, not what the music happens to contain.
// Found by the Codex outsider seat 2026-08-06: the ornament branch preceded the
// strand check, so an ornament in a rhythm source would be altered while a
// rhythm atom took the credit.
describe('by_ear_verify — the altered thing is the credited thing', () => {
  test('a source that credits no ornament atom never alters an ornament', () => {
    for (let seed = 0; seed < 60; seed++) {
      const inst = make(seed, 'note_naming');
      if (inst.srs_tags.some((t) => t.startsWith('ornament:'))) continue;
      const w = (inst.stimulus.music as Music).voices.flatMap((v) => v.events) as NoteEvent[];
      const p = played(inst).voices.flatMap((v) => v.events) as NoteEvent[];
      expect(w.map((e) => e.ornament?.kind)).toEqual(p.map((e) => e.ornament?.kind));
    }
  });

  test('a source that credits an ornament atom alters the ornament, not the pitch', () => {
    const differing = Array.from({ length: 40 }, (_, s) => make(s, 'ornament_recognition', 4, ORNAMENT_ATOMS)).filter(
      (i) => i.answer.canonical === 'Different',
    );
    expect(differing.length).toBeGreaterThan(0);
    for (const inst of differing) {
      const w = (inst.stimulus.music as Music).voices[0].events as NoteEvent[];
      const p = played(inst).voices[0].events as NoteEvent[];
      expect(w.map((e) => e.pitch)).toEqual(p.map((e) => e.pitch));
    }
  });
});
