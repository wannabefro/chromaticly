// by_ear_match generator (theory-by-ear U2). The learner sees the lesson's own
// notation and hears it played with one note altered, or not altered at all, and
// answers same-or-different then taps where. It composes over a written source
// template (KTD2) rather than authoring its own material, so the learner hears
// what they just read and the by-ear item follows the written generator forever.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Music, MusicEvent, NoteEvent, Pitch } from '../../music/types';
import { byEarAtom, writtenAtomOf } from '../atoms';
import { mulberry32 } from '../rng';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Fewer than this and "tap where it differs" has no honest wrong answer. */
const MIN_POSITIONS = 3;

/** How often the played music matches, so "different" is not always right. */
const SAME_RATE = 1 / 3;

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

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

/** Tappable events: single notes only. A chord has several sounding notes, so
 *  altering one asks a different question (KTD9). */
function tappableIndices(events: readonly MusicEvent[]): number[] {
  return events.flatMap((ev, i) => (ev.type === 'note' && semitoneOf(ev.pitch) !== null ? [i] : []));
}

/** A deep-enough copy that the altered voice never aliases the stimulus. */
function cloneMusic(music: Music): Music {
  return { ...music, voices: music.voices.map((v) => ({ ...v, events: v.events.map((e) => ({ ...e })) })) };
}

/** Returns null when the step would not change what is heard, so a silent
 *  no-op mutation can never ship. */
function alterOneNote(music: Music, index: number, up: boolean): Music | null {
  const original = music.voices[0].events[index] as NoteEvent;
  const moved = stepPitch(original.pitch, up);
  if (!moved) return null;
  if (semitoneOf(moved) === semitoneOf(original.pitch)) return null;
  const out = cloneMusic(music);
  (out.voices[0].events[index] as NoteEvent).pitch = moved;
  return out;
}

function positionKey(index: number): string {
  return `pos:${index}`;
}

/** Learner-facing note name: "B", not the internal "B4" (chromatic-scale's rule). */
function noteName(pitch: Pitch): string {
  return pitch.replace(/-?\d+$/, '').replace(/#/g, '♯').replace(/b/g, '♭');
}

/** Both call sites supply "The ... note", so the fallback is a bare ordinal. */
function ordinal(n: number): string {
  const words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  if (words[n]) return words[n];
  const num = n + 1;
  const suffix = num % 100 >= 11 && num % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[num % 10] ?? 'th');
  return `${num}${suffix}`;
}

function buildByEarMatch(
  contentSeed: number,
  opts: GenerateOptions,
  idSeed: number,
  generateSource: (templateId: string, opts: GenerateOptions) => ExerciseInstance,
): ExerciseInstance {
  const sourceId = opts.source;
  if (!sourceId) throw new Error('by_ear_match: needs a `source` template id');

  // Practice hands the DUE atom as the pool, and a due by-ear atom is suffixed.
  const atoms = opts.atoms?.map(writtenAtomOf);
  const source = generateSource(sourceId, { grade: opts.grade, seed: contentSeed, atoms });
  const music = source.stimulus.music as Music | null;
  if (!music || !music.voices?.[0]) throw new Error(`by_ear_match: source "${sourceId}" emits no music`);

  const events = music.voices[0].events;
  const positions = tappableIndices(events);
  if (positions.length < MIN_POSITIONS) {
    throw new Error(`by_ear_match: source "${sourceId}" has ${positions.length} tappable notes, needs ${MIN_POSITIONS}`);
  }

  const rng = mulberry32(contentSeed);
  const wantSame = rng() < SAME_RATE;
  const target = positions[Math.floor(rng() * positions.length)];
  const up = rng() < 0.5;

  const altered = wantSame ? music : (alterOneNote(music, target, up) ?? alterOneNote(music, target, !up));
  if (!altered) throw new Error('by_ear_match: no audible alteration available at the drawn note');
  const same = altered === music;

  const noteNumber = (i: number) => positions.indexOf(i);
  const wrongPositions = positions.filter((i) => same || i !== target);
  const distractors = same ? wrongPositions.map(positionKey) : ['same', ...wrongPositions.map(positionKey)];

  const writtenPitch = (i: number) => noteName((events[i] as NoteEvent).pitch);
  // On a matching item the mistake is hearing a change that was not there, so
  // the line leads with that rather than with the note they pointed at.
  const by_distractor: Record<string, string> = Object.fromEntries(
    wrongPositions.map((i) => [
      positionKey(i),
      same
        ? `Nothing changed — the ${ordinal(noteNumber(i))} note is written ${writtenPitch(i)} and that is exactly what was played.`
        : `The ${ordinal(noteNumber(i))} note is written ${writtenPitch(i)}, and that is what you heard.`,
    ]),
  );
  if (!same) {
    by_distractor.same = `The ${ordinal(noteNumber(target))} note is written ${writtenPitch(target)}, but you heard ${noteName((altered.voices[0].events[target] as NoteEvent).pitch)}.`;
  }

  return {
    id: makeInstanceId('by_ear_match', opts.grade, idSeed),
    template_id: 'by_ear_match',
    grade: opts.grade,
    strand: source.strand,
    prompt: 'Does what you hear match what is written?',
    stimulus: { music, text: null },
    interaction: {
      type: 'by_ear_match',
      config: { played_music: altered, positions, source_template: sourceId },
    },
    answer: {
      canonical: { verdict: same ? 'same' : 'different', position: same ? null : target },
      accepted_alternatives: [],
    },
    distractors,
    hints: ['Follow the notes with your finger as it plays. Where you lose the thread is usually where it changed.'],
    feedback: {
      correct: 'Correct!',
      incorrect: same
        ? 'What you heard was exactly what is written.'
        : `The ${ordinal(noteNumber(target))} note was played differently from the way it is written.`,
      by_distractor,
    },
    srs_tags: source.srs_tags.map(byEarAtom),
    kb_version: KB_VERSION,
  };
}

export function makeByEarMatch(
  generateSource: (templateId: string, opts: GenerateOptions) => ExerciseInstance,
): Generator {
  return (opts: GenerateOptions) =>
    generateValidated(opts.seed, (candidateSeed) => buildByEarMatch(candidateSeed, opts, opts.seed, generateSource));
}
