// by_ear_verify generator (theory-by-ear U1). Same-or-different only, with no
// "tap where" step — for sources with too few notes to point at (KTD5). It
// composes over a written source template exactly like by_ear_match, but the
// canonical answer is the verdict alone.

import { KB_VERSION } from '../../content/knowledge-base';
import { ORNAMENT_KINDS } from '../atoms';
import type { ChordEvent, Duration, Music, MusicEvent, NoteEvent, Ornament, Pitch } from '../../music/types';
import { byEarAtom, writtenAtomOf } from '../atoms';
import { mulberry32 } from '../rng';
import { scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { semitoneOf, stepPitch } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Two options, so a coin flip must be the honest guess rate. by_ear_match uses
 *  1/3 because answering "different" there still costs a tap-where step. */
const SAME_RATE = 1 / 2;

/** A single sounding pitch a mutation may target: a note, or one tone of a chord. */
export interface SoundingRef {
  eventIndex: number;
  pitchIndex: number | null;
}

/** Every sounding pitch: one ref per note, one per chord tone (KTD9). */
export function soundingRefs(events: readonly MusicEvent[]): SoundingRef[] {
  return events.flatMap((ev, eventIndex): SoundingRef[] => {
    if (ev.type === 'note' && semitoneOf(ev.pitch) !== null) return [{ eventIndex, pitchIndex: null }];
    if (ev.type === 'chord') {
      return ev.pitches.flatMap((p, pitchIndex): SoundingRef[] => (semitoneOf(p) !== null ? [{ eventIndex, pitchIndex }] : []));
    }
    return [];
  });
}

function pitchAt(events: readonly MusicEvent[], ref: SoundingRef): Pitch {
  const ev = events[ref.eventIndex];
  return ref.pitchIndex === null ? (ev as NoteEvent).pitch : (ev as ChordEvent).pitches[ref.pitchIndex];
}

/** A deep-enough copy that the altered voice never aliases the stimulus. */
function cloneMusic(music: Music): Music {
  return {
    ...music,
    voices: music.voices.map((v) => ({
      ...v,
      events: v.events.map((e) => (e.type === 'chord' ? { ...e, pitches: [...e.pitches] } : { ...e })),
    })),
  };
}

/** Returns null when the step would not change what is heard, so a silent
 *  no-op mutation can never ship. */
export function alterOneSoundingPitch(music: Music, ref: SoundingRef, up: boolean, voice = 0): Music | null {
  const original = pitchAt(music.voices[voice].events, ref);
  const moved = stepPitch(original, up);
  if (!moved) return null;
  if (semitoneOf(moved) === semitoneOf(original)) return null;
  const out = cloneMusic(music);
  const ev = out.voices[voice].events[ref.eventIndex];
  if (ref.pitchIndex === null) (ev as NoteEvent).pitch = moved;
  else (ev as ChordEvent).pitches[ref.pitchIndex] = moved;
  return out;
}

/** Duration-bearing events: notes, chords and rests all carry `dur`. */
function durationIndices(events: readonly MusicEvent[]): number[] {
  return events.flatMap((ev, i) => (ev.type === 'note' || ev.type === 'chord' || ev.type === 'rest' ? [i] : []));
}

/** Every named Duration is a distinct length, so any other choice is audibly
 *  different — no enharmonic-style aliasing to guard against. */
function alterOneDuration(music: Music, index: number, rng: () => number, grade: number, voice = 0): Music | null {
  const original = music.voices[voice].events[index] as { dur: Duration };
  const choices = scopeForGrade(grade).noteValues.filter((d) => d !== original.dur);
  if (choices.length === 0) return null;
  const dur = choices[Math.floor(rng() * choices.length)];
  const out = cloneMusic(music);
  const ev = out.voices[voice].events[index] as { dur: Duration; dots?: number };
  ev.dur = dur;
  ev.dots = 0;
  return out;
}

/** The voice the source ringed. satb_voice_recognition highlights any of four,
 *  and its atom names that voice — altering voices[0] would credit the wrong one. */
function highlightedVoice(music: Music): number {
  const i = music.voices.findIndex((v) => v.events.some((e) => 'highlight' in e && e.highlight));
  return i === -1 ? 0 : i;
}

/** Swap the sign, not the note. An `ornament:*` atom is credited for hearing the
 *  ornament, so moving the pitch under it asks a different question. */
function alterOneOrnament(music: Music, voice: number, index: number, rng: () => number): Music | null {
  const original = (music.voices[voice].events[index] as NoteEvent).ornament;
  if (!original) return null;
  const choices = ORNAMENT_KINDS.filter((k) => k !== original.kind);
  const out = cloneMusic(music);
  const ev = out.voices[voice].events[index] as NoteEvent;
  ev.ornament = { ...original, kind: choices[Math.floor(rng() * choices.length)] as Ornament['kind'] };
  return out;
}

/** Events carrying an ornament, so a decorated source alters its sign. */
function ornamentIndices(events: readonly MusicEvent[]): number[] {
  return events.flatMap((ev, i) => (ev.type === 'note' && ev.ornament ? [i] : []));
}

function buildByEarVerify(
  contentSeed: number,
  opts: GenerateOptions,
  idSeed: number,
  generateSource: (templateId: string, opts: GenerateOptions) => ExerciseInstance,
): ExerciseInstance {
  const sourceId = opts.source;
  if (!sourceId) throw new Error('by_ear_verify: needs a `source` template id');

  // Practice hands the DUE atom as the pool, and a due by-ear atom is suffixed.
  const atoms = opts.atoms?.map(writtenAtomOf);
  const source = generateSource(sourceId, { grade: opts.grade, seed: contentSeed, atoms });
  const music = source.stimulus.music as Music | null;
  if (!music || !music.voices?.[0]) throw new Error(`by_ear_verify: source "${sourceId}" emits no music`);

  const voice = highlightedVoice(music);
  const events = music.voices[voice].events;
  const rng = mulberry32(contentSeed);
  // The verdict comes from the ORIGINAL seed, not the retry seed. A "Same" item is
  // trivially valid, so re-rolling it on every retry drifts the answer toward Same.
  const wantSame = mulberry32(idSeed)() < SAME_RATE;
  // Gate on what the source CREDITS, not on what it happens to contain. An
  // ornament present in a rhythm source would otherwise be altered while a
  // rhythm atom took the credit.
  const creditsOrnament = source.srs_tags.some((t) => t.startsWith('ornament:'));
  const ornaments = creditsOrnament ? ornamentIndices(events) : [];

  let altered: Music | null;
  if (wantSame) {
    altered = music;
  } else if (ornaments.length > 0) {
    const index = ornaments[Math.floor(rng() * ornaments.length)];
    altered = alterOneOrnament(music, voice, index, rng);
    if (!altered) throw new Error(`by_ear_verify: source "${sourceId}" has no substitutable ornament`);
  } else if (source.strand === 'rhythm') {
    const indices = durationIndices(events);
    if (indices.length === 0) throw new Error(`by_ear_verify: source "${sourceId}" has no duration-bearing events`);
    const index = indices[Math.floor(rng() * indices.length)];
    altered = alterOneDuration(music, index, rng, opts.grade, voice);
    if (!altered) throw new Error(`by_ear_verify: grade ${opts.grade} has no alternative note value`);
  } else {
    const refs = soundingRefs(events);
    if (refs.length === 0) throw new Error(`by_ear_verify: source "${sourceId}" has no sounding notes to alter`);
    const ref = refs[Math.floor(rng() * refs.length)];
    const up = rng() < 0.5;
    altered = alterOneSoundingPitch(music, ref, up, voice) ?? alterOneSoundingPitch(music, ref, !up, voice);
    if (!altered) throw new Error('by_ear_verify: no audible alteration available at the drawn note');
  }

  const same = altered === music;
  const verdict = same ? 'Same' : 'Different';
  const wrong = same ? 'Different' : 'Same';

  return {
    id: makeInstanceId('by_ear_verify', opts.grade, idSeed),
    template_id: 'by_ear_verify',
    grade: opts.grade,
    strand: source.strand,
    prompt: 'Does what you hear match what is written?',
    stimulus: { music, text: null },
    interaction: {
      type: 'by_ear_verify',
      config: { played_music: altered, source_template: sourceId },
    },
    answer: { canonical: verdict, accepted_alternatives: [] },
    distractors: [wrong],
    hints: ['Listen carefully, then compare what you hear with the notation above.'],
    feedback: {
      correct: 'Correct!',
      incorrect: same
        ? 'What you heard was exactly what is written.'
        : 'What you heard was not exactly what is written.',
      by_distractor: {
        [wrong]: same
          ? 'Nothing changed — what you heard matches the notation exactly.'
          : 'Something changed — what you heard does not match the notation.',
      },
    },
    srs_tags: source.srs_tags.map(byEarAtom),
    kb_version: KB_VERSION,
  };
}

export function makeByEarVerify(
  generateSource: (templateId: string, opts: GenerateOptions) => ExerciseInstance,
): Generator {
  return (opts: GenerateOptions) =>
    generateValidated(opts.seed, (candidateSeed) => buildByEarVerify(candidateSeed, opts, opts.seed, generateSource));
}
