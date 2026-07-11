// Grade 1 note_naming generator (curriculum/exercise-templates.json,
// template_id "note_naming"). Answer is the note's letter name, plus the
// accidental word when the sampled item applies one (spec example: "E flat",
// accepting "Eb"/"E♭"). Distractors encode two named misconceptions per the
// template's distractor_rules: mis-stepping the line/space by one, and clef
// confusion (reading the same staff position on the wrong clef).

import type { Clef } from '../../music/types';
import { KB_VERSION } from '../../content/knowledge-base';
import { noteReadAtom } from '../atoms';
import { mulberry32, pick, weighted } from '../rng';
import { diatonicPitchesInRange, G1_CLEFS } from '../scope';
import type { ExerciseInstance } from '../schema';
import { naturalPitchAtOrdinal, pitchOrdinal, type Letter } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type Accidental = 'sharp' | 'flat' | null;

const LETTER_ORDER: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Bottom-line pitch of each G1 clef — the reference point for mapping one
// clef's staff position onto the other (the clef-confusion distractor).
const CLEF_BOTTOM_LINE: Record<Clef, { letter: Letter; octave: number }> = {
  treble: { letter: 'E', octave: 4 },
  bass: { letter: 'G', octave: 2 },
};

function otherClef(clef: Clef): Clef {
  return clef === 'treble' ? 'bass' : 'treble';
}

function parseLetterOctave(pitch: string): { letter: Letter; octave: number } {
  const match = /^([A-G])(?:#|b)?(-?\d+)$/.exec(pitch);
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
  return accidental ? `${letter} ${accidental}` : letter;
}

function acceptedAlternatives(letter: Letter, accidental: Accidental): string[] {
  if (accidental === 'sharp') return [`${letter}#`, `${letter}♯`];
  if (accidental === 'flat') return [`${letter}b`, `${letter}♭`];
  return [];
}

function applyAccidental(basePitch: string, accidental: Accidental): string {
  if (!accidental) return basePitch;
  const { letter, octave } = parseLetterOctave(basePitch);
  const symbol = accidental === 'sharp' ? '#' : 'b';
  return `${letter}${symbol}${octave}`;
}

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...G1_CLEFS]);
  const basePitch = pick(rng, diatonicPitchesInRange(clef));
  const accidental = weighted<Accidental>(rng, [
    { value: null, weight: 70 },
    { value: 'sharp', weight: 15 },
    { value: 'flat', weight: 15 },
  ]);

  const { letter } = parseLetterOctave(basePitch);
  const pitch = applyAccidental(basePitch, accidental);

  const direction = pick(rng, [1, -1] as const);
  const adjacent = adjacentLetter(letter, direction);
  const clefConfusion = clefConfusionLetter(clef, basePitch);

  const canonical = formatNoteName(letter, accidental);
  const distractors = [formatNoteName(adjacent, null), formatNoteName(clefConfusion, accidental)];

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
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed));
