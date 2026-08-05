// by_ear_verify generator (theory-by-ear U1). Same-or-different only, with no
// "tap where" step — for sources with too few notes to point at (KTD5). It
// composes over a written source template exactly like by_ear_match, but the
// canonical answer is the verdict alone.

import { KB_VERSION } from '../../content/knowledge-base';
import type { ChordEvent, Duration, Music, MusicEvent, NoteEvent, Pitch } from '../../music/types';
import { byEarAtom, writtenAtomOf } from '../atoms';
import { mulberry32 } from '../rng';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** How often the played music matches, so "different" is not always right. */
const SAME_RATE = 1 / 3;

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const DURATIONS: Duration[] = ['breve', 'semibreve', 'minim', 'crotchet', 'quaver', 'semiquaver', 'demisemiquaver'];

interface ParsedPitch {
  letter: string;
  accidental: string;
  octave: number;
}

function parsePitch(pitch: Pitch): ParsedPitch | null {
  const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/.exec(pitch);
  if (!m) return null;
  return { letter: m[1], accidental: m[2] ?? '', octave: Number(m[3]) };
}

/** Absolute semitone height, so an enharmonic "step" that sounds identical is caught. */
function semitoneOf(pitch: Pitch): number | null {
  const p = parsePitch(pitch);
  if (!p) return null;
  const shift = p.accidental.startsWith('#') ? p.accidental.length : -p.accidental.length;
  return (p.octave + 1) * 12 + SEMITONES[p.letter] + shift;
}

/** The next letter name up or down, carrying the octave across the B/C boundary. */
function stepPitch(pitch: Pitch, up: boolean): Pitch | null {
  const p = parsePitch(pitch);
  if (!p) return null;
  const i = LETTERS.indexOf(p.letter as (typeof LETTERS)[number]);
  const next = (i + (up ? 1 : 6)) % 7;
  const octave = up && next === 0 ? p.octave + 1 : !up && i === 0 ? p.octave - 1 : p.octave;
  return `${LETTERS[next]}${octave}`;
}

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
export function alterOneSoundingPitch(music: Music, ref: SoundingRef, up: boolean): Music | null {
  const original = pitchAt(music.voices[0].events, ref);
  const moved = stepPitch(original, up);
  if (!moved) return null;
  if (semitoneOf(moved) === semitoneOf(original)) return null;
  const out = cloneMusic(music);
  const ev = out.voices[0].events[ref.eventIndex];
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
function alterOneDuration(music: Music, index: number, rng: () => number): Music {
  const original = music.voices[0].events[index] as { dur: Duration };
  const choices = DURATIONS.filter((d) => d !== original.dur);
  const dur = choices[Math.floor(rng() * choices.length)];
  const out = cloneMusic(music);
  const ev = out.voices[0].events[index] as { dur: Duration; dots?: number };
  ev.dur = dur;
  ev.dots = 0;
  return out;
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

  const events = music.voices[0].events;
  const rng = mulberry32(contentSeed);
  const wantSame = rng() < SAME_RATE;

  let altered: Music | null;
  if (wantSame) {
    altered = music;
  } else if (source.strand === 'rhythm') {
    const indices = durationIndices(events);
    if (indices.length === 0) throw new Error(`by_ear_verify: source "${sourceId}" has no duration-bearing events`);
    const index = indices[Math.floor(rng() * indices.length)];
    altered = alterOneDuration(music, index, rng);
  } else {
    const refs = soundingRefs(events);
    if (refs.length === 0) throw new Error(`by_ear_verify: source "${sourceId}" has no sounding notes to alter`);
    const ref = refs[Math.floor(rng() * refs.length)];
    const up = rng() < 0.5;
    altered = alterOneSoundingPitch(music, ref, up) ?? alterOneSoundingPitch(music, ref, !up);
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
