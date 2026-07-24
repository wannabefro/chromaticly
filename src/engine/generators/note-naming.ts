// Grade 1 note_naming generator (curriculum/exercise-templates.json,
// template_id "note_naming"). The item is drawn from the lesson's declared
// `note_read:{clef}:{pitch}` atoms (GenerateOptions.atoms) — so the clef,
// pitch, and accidental-or-none all come from the curriculum, never the
// grade-wide scope. This is what keeps a "treble stave" lesson on treble
// naturals and a "sharps and flats" lesson on exactly its five accidentals,
// and makes musically-invalid spellings (Cb/Fb/B#/E#) unreachable by
// construction. Answer is the note's letter name plus the accidental word when
// present ("F sharp", accepting "F#"/"F♯"). Distractors encode two named
// misconceptions: mis-stepping the line/space by one, and clef confusion
// (reading the same staff position on the wrong clef).

import type { Clef } from '../../music/types';
import { KB_VERSION } from '../../content/knowledge-base';
import { noteReadAtom, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import type { ExerciseInstance } from '../schema';
import { naturalPitchAtOrdinal, pitchOrdinal, type Letter } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type Accidental = 'sharp' | 'flat' | 'double_sharp' | 'double_flat' | null;

const LETTER_ORDER: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// The four letter+accidental combinations that spell a natural — never taught
// at Grade 1. Used to keep the clef-confusion distractor from labelling one.
const NEVER_G1 = new Set(['Cflat', 'Fflat', 'Bsharp', 'Esharp']);

/** A `note_read:{clef}:{pitch}` atom split into a renderable candidate. */
interface NoteCandidate {
  clef: Clef;
  pitch: string; // scientific, may carry an accidental, e.g. "F#5" or "C4"
  letter: Letter;
  accidental: Accidental;
}

function parseNotePitch(pitch: string): { letter: Letter; accidental: Accidental; octave: number } {
  const m = /^([A-G])(##|#|bb|b)?(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`note_naming: unexpected pitch "${pitch}"`);
  const ACC: Record<string, Accidental> = { '#': 'sharp', b: 'flat', '##': 'double_sharp', bb: 'double_flat' };
  return { letter: m[1] as Letter, accidental: m[2] ? ACC[m[2]] : null, octave: Number(m[3]) };
}

/** The lesson's `note_read:*` atoms as renderable candidates. Throws if the
 *  lesson declares none — a note_naming lesson with no note atoms is a data
 *  bug, not a reason to fall back to the grade-wide scope. */
function noteCandidates(atoms: string[]): NoteCandidate[] {
  const candidates: NoteCandidate[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'note_read') continue;
    const [clef, pitch] = parts;
    const { letter, accidental } = parseNotePitch(pitch);
    candidates.push({ clef: clef as Clef, pitch, letter, accidental });
  }
  if (candidates.length === 0) {
    throw new Error('note_naming: lesson declares no note_read:* atoms');
  }
  return candidates;
}

/** Drop the accidental when it would spell a never-Grade-1 note (Cb/Fb/B#/E#),
 *  so the clef-confusion distractor never shows an impossible label (R6). */
function safeDistractorAccidental(letter: Letter, accidental: Accidental): Accidental {
  return accidental && NEVER_G1.has(`${letter}${accidental}`) ? null : accidental;
}

// Bottom-line pitch of each G1 clef — the reference point for mapping one
// clef's staff position onto the other (the clef-confusion distractor).
const CLEF_BOTTOM_LINE: Record<Clef, { letter: Letter; octave: number }> = {
  treble: { letter: 'E', octave: 4 },
  bass: { letter: 'G', octave: 2 },
  // Alto (viola) clef: middle line is C4, so the bottom line is F3.
  alto: { letter: 'F', octave: 3 },
};

// The clef-confusion distractor reads the same staff position on a DIFFERENT
// clef. An explicit map, not a `treble ? bass : treble` ternary: with three
// clefs that ternary would silently map alto->treble (a wrong-but-not-a-compile-
// error bug). treble<->bass stay paired; alto's confusion partner is treble
// (violists commonly also read treble).
const CLEF_CONFUSION_PARTNER: Record<Clef, Clef> = {
  treble: 'bass',
  bass: 'treble',
  alto: 'treble',
};

function otherClef(clef: Clef): Clef {
  return CLEF_CONFUSION_PARTNER[clef];
}

function parseLetterOctave(pitch: string): { letter: Letter; octave: number } {
  const match = /^([A-G])(?:##|#|bb|b)?(-?\d+)$/.exec(pitch);
  if (!match) throw new Error(`unexpected pitch shape: ${pitch}`);
  return { letter: match[1] as Letter, octave: Number(match[2]) };
}

/** What this staff position (line/space) would be named if read on the other clef. */
function clefConfusionLetter(clef: Clef, naturalPitch: string): Letter {
  const { letter, octave } = parseLetterOctave(naturalPitch);
  const ord = pitchOrdinal(letter, octave);
  const bottomHere = CLEF_BOTTOM_LINE[clef];
  const bottomOther = CLEF_BOTTOM_LINE[otherClef(clef)];
  const position = ord - pitchOrdinal(bottomHere.letter, bottomHere.octave);
  const otherOrd = pitchOrdinal(bottomOther.letter, bottomOther.octave) + position;
  return parseLetterOctave(naturalPitchAtOrdinal(otherOrd)).letter;
}

function adjacentLetter(letter: Letter, direction: 1 | -1): Letter {
  const idx = LETTER_ORDER.indexOf(letter);
  return LETTER_ORDER[(idx + direction + 7) % 7];
}

function formatNoteName(letter: Letter, accidental: Accidental): string {
  // 'double_sharp' -> "double sharp" so the canonical reads "F double sharp".
  return accidental ? `${letter} ${accidental.replace('_', ' ')}` : letter;
}

function acceptedAlternatives(letter: Letter, accidental: Accidental): string[] {
  if (accidental === 'sharp') return [`${letter}#`, `${letter}♯`];
  if (accidental === 'flat') return [`${letter}b`, `${letter}♭`];
  if (accidental === 'double_sharp') return [`${letter}##`, `${letter}x`, `${letter}𝄪`];
  if (accidental === 'double_flat') return [`${letter}bb`, `${letter}𝄫`];
  return [];
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const { clef, pitch, letter, accidental } = pick(rng, noteCandidates(atoms));

  const direction = pick(rng, [1, -1] as const);
  const adjacent = adjacentLetter(letter, direction);
  const clefConfusion = clefConfusionLetter(clef, pitch);

  const canonical = formatNoteName(letter, accidental);
  const distractors = [
    formatNoteName(adjacent, null),
    formatNoteName(clefConfusion, safeDistractorAccidental(clefConfusion, accidental)),
  ];

  return {
    id: makeInstanceId('note_naming', grade, idSeed),
    template_id: 'note_naming',
    grade,
    strand: 'pitch',
    prompt: 'Write the name of this note.',
    stimulus: {
      music: {
        clef,
        key_sig: null,
        time_sig: null,
        voices: [{ events: [{ type: 'note', pitch, dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: acceptedAlternatives(letter, accidental) },
    distractors,
    hints: ['Count the lines and spaces up or down from a clef landmark you already know.'],
    feedback: {
      correct: 'Correct!',
      incorrect:
        'Not quite — check the clef sign carefully. An easy mix-up is naming the note as it would be read on the other clef, or miscounting the line or space by one.',
    },
    srs_tags: [noteReadAtom(clef, pitch)],
    kb_version: KB_VERSION,
  };
}

export const noteNaming: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
