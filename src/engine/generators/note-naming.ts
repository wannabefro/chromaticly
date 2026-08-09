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
import { keyedNoteAtom, noteReadAtom, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { spellInKeySig } from './key-spelling';
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
  /** chromaticly-7xv.6: read under a drawn signature, not as written. */
  keyed: boolean;
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
    if (kind !== 'note_read' && kind !== 'note_read_keyed') continue;
    const [clef, pitch] = parts;
    const { letter, accidental } = parseNotePitch(pitch);
    candidates.push({ clef: clef as Clef, pitch, letter, accidental, keyed: kind === 'note_read_keyed' });
  }
  if (candidates.length === 0) {
    throw new Error('note_naming: lesson declares no note_read:* atoms');
  }
  return candidates;
}

/** The pool a keyed reading draws from. */
function keySigPool(grade: number): string[] {
  const scope = scopeForGrade(grade);
  return [...scope.keysMajor.map((k) => `${k}_major`), ...scope.keysMinor.map((k) => `${k}_minor`)];
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
  // Tenor clef: the C clef moves up a line, putting C4 on the 4th line, so the
  // bottom line is D3 — a 3rd below alto's.
  tenor: { letter: 'D', octave: 3 },
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
  // Tenor's partner is bass, not alto. The mistake a reader actually makes is
  // reading a tenor stave as the bass clef they already know; confusing it with
  // the alto clef needs them to know the alto clef too, which is rarer.
  tenor: 'bass',
};

function otherClef(clef: Clef): Clef {
  return CLEF_CONFUSION_PARTNER[clef];
}

/** "an alto clef", but "a treble clef" — misconception copy names a clef in
 *  running prose, and "a alto clef" reads as broken English on device. */
function clefPhrase(clef: Clef): string {
  return `${clef === 'alto' ? 'an' : 'a'} ${clef} clef`;
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

export function formatNoteName(letter: Letter, accidental: Accidental): string {
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
  const candidate = pick(rng, noteCandidates(atoms));
  const { clef, letter, keyed } = candidate;

  // The extra draw happens only on this branch, so every note_read lesson
  // keeps its rng sequence.
  const keySig = keyed ? pick(rng, keySigPool(grade)) : null;
  const pitch = keySig ? spellInKeySig(candidate.pitch, keySig) : candidate.pitch;
  const accidental = keySig ? parseNotePitch(pitch).accidental : candidate.accidental;

  const direction = pick(rng, [1, -1] as const);
  const adjacent = adjacentLetter(letter, direction);
  const clefConfusion = clefConfusionLetter(clef, candidate.pitch);

  // A miscounted neighbour is read as the signature writes it.
  const inKey = (l: Letter): Accidental =>
    keySig ? parseNotePitch(spellInKeySig(`${l}4`, keySig)).accidental : null;

  const canonical = formatNoteName(letter, accidental);
  const offByOne = formatNoteName(adjacent, inKey(adjacent));
  const wrongClef = keySig
    ? formatNoteName(clefConfusion, inKey(clefConfusion))
    : formatNoteName(clefConfusion, safeDistractorAccidental(clefConfusion, accidental));
  const distractors = [offByOne, wrongClef];

  // The two distractors are the two named misconceptions, so each one can say
  // which mistake it is (never-violate rule 5). The instance-wide `incorrect`
  // below used to hedge across both — "the other clef, OR miscounting by one" —
  // which told a learner who did one of them to check the other as well.
  //
  // The two collide when the off-by-one letter and the wrong-clef letter are the
  // same. `distractors` de-duplicates to a single option, and the map would too;
  // the off-by-one reading is written last so it wins, because it is the mistake
  // a learner reading the RIGHT clef would make.
  const byDistractor: Record<string, string> = {
    [wrongClef]: `That is ${wrongClef} — but only in the ${otherClef(clef)} clef. This stave carries ${clefPhrase(clef)}, so the same line or space is a different note.`,
    [offByOne]: `That is one line or space out. ${offByOne} is the next step ${direction === 1 ? 'up' : 'down'} from ${canonical} — count again from a clef landmark you are sure of.`,
  };

  return {
    id: makeInstanceId('note_naming', grade, idSeed),
    template_id: 'note_naming',
    grade,
    strand: 'pitch',
    prompt: 'Write the name of this note.',
    stimulus: {
      music: {
        clef,
        key_sig: keySig,
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
      by_distractor: byDistractor,
    },
    srs_tags: [keyed ? keyedNoteAtom(clef, candidate.pitch) : noteReadAtom(clef, pitch)],
    kb_version: KB_VERSION,
  };
}

export const noteNaming: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));

// Stave-input variant (chromaticly-lgi): the note is named, the learner places it.

function buildStaveInput(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  // Placing a position would credit the plain atom for an unasked question.
  const plain = noteCandidates(atoms).filter((c) => !c.keyed);
  if (plain.length === 0) throw new Error('note_naming_stave_input: every atom is keyed; nothing to place');
  const { clef, pitch, letter, accidental } = pick(rng, plain);
  if (accidental === 'double_sharp' || accidental === 'double_flat') {
    throw new Error(`note_naming_stave_input: ${pitch} needs a double accidental the stave input cannot place`);
  }
  const natural = pitch.replace(/[#b]/g, '');
  if (!diatonicPitchesInRange(clef, grade).includes(natural)) {
    throw new Error(`note_naming_stave_input: ${natural} is outside the ${clef} slot range at grade ${grade}`);
  }
  const dur = pick(rng, [...scopeForGrade(grade).noteValues]);
  const canonical = formatNoteName(letter, accidental);
  // "Write D" names a pitch class, and a stave holds more than one D. Marking
  // the other octave wrong asks for an octave the prompt never gave.
  const sign = pitch.replace(/^[A-G]/, '').replace(/\d+$/, '');
  const octaves = diatonicPitchesInRange(clef, grade)
    .filter((p) => p !== natural && p.startsWith(natural[0]))
    .map((p) => ({ pitch: p.replace(/^[A-G]/, `$&${sign}`), dur }));

  return {
    id: makeInstanceId('note_naming_stave_input', grade, idSeed),
    template_id: 'note_naming_stave_input',
    grade,
    strand: 'pitch',
    prompt: `Write ${canonical} on the stave, as a ${dur}.`,
    stimulus: { music: null, text: null },
    interaction: { type: 'stave_input', config: { clef } },
    answer: { canonical: { pitch, dur }, accepted_alternatives: octaves },
    distractors: [],
    hints: [
      accidental
        ? 'Step to the letter from a clef landmark you already know. An accidental changes the note, never which line or space it sits on.'
        : 'Step to the letter from a clef landmark you already know. Any octave of it will do.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: accidental
        ? `Not quite — count the lines and spaces to ${letter}, then add the accidental and choose the ${dur}.`
        : `Not quite — count the lines and spaces to ${letter}, then choose the ${dur}. It needs no sharp or flat.`,
    },
    srs_tags: [noteReadAtom(clef, pitch)],
    kb_version: KB_VERSION,
  };
}

export const noteNamingStaveInput: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildStaveInput(candidateSeed, opts.grade, opts.seed, opts.atoms));

// --- Sounds-as shape (chromaticly-lgi) -------------------------------------
// Naming a double accidental and knowing what it sounds like are different
// skills, and only the second one catches "F double sharp is a kind of F".

const PITCH_CLASS: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL_STEP: Record<string, number> = { double_sharp: 2, sharp: 1, flat: -1, double_flat: -2 };

/** The plainest name for the pitch a spelling lands on. A double accidental in
 *  this grade's atom set always reaches a natural; a black key keeps the
 *  direction it travelled, so F sharp is never renamed G flat. */
function soundsAsName(letter: Letter, accidental: Accidental): string {
  const step = accidental ? ACCIDENTAL_STEP[accidental] : 0;
  const pc = (((PITCH_CLASS[letter] + step) % 12) + 12) % 12;
  const natural = (Object.keys(PITCH_CLASS) as Letter[]).find((l) => PITCH_CLASS[l] === pc);
  if (natural) return natural;
  const neighbour = (Object.keys(PITCH_CLASS) as Letter[]).find((l) => PITCH_CLASS[l] === (pc + (step > 0 ? -1 : 1) + 12) % 12);
  if (!neighbour) throw new Error(`note_naming: no spelling for pitch class ${pc}`);
  return `${neighbour} ${step > 0 ? 'sharp' : 'flat'}`;
}

function buildSoundsAs(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const doubles = noteCandidates(atoms).filter(
    (c) => c.accidental === 'double_sharp' || c.accidental === 'double_flat',
  );
  if (doubles.length === 0) {
    throw new Error('note_naming: sounds-as needs a note_read atom with a double accidental');
  }
  const { clef, pitch, letter, accidental } = pick(rng, doubles);

  const raised = accidental === 'double_sharp';
  const canonical = soundsAsName(letter, accidental);
  const once = `${letter} ${raised ? 'sharp' : 'flat'}`;
  const distractors = [once, letter];

  return {
    id: makeInstanceId('note_sounds_as', grade, idSeed),
    template_id: 'note_sounds_as',
    grade,
    strand: 'pitch',
    prompt: 'This note sounds the same as which note?',
    stimulus: {
      music: { clef, key_sig: null, time_sig: null, voices: [{ events: [{ type: 'note', pitch, dur: 'semibreve' }] }] },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors,
    hints: [`A double ${raised ? 'sharp' : 'flat'} moves the note two semitones, not one.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `A double ${raised ? 'sharp' : 'flat'} moves ${letter} two semitones ${raised ? 'up' : 'down'}, which sounds as ${canonical}.`,
      by_distractor: {
        [once]: `That moves ${letter} only one semitone. A double ${raised ? 'sharp' : 'flat'} moves it two, reaching ${canonical}.`,
        [letter]: `That ignores the accidental. The double ${raised ? 'sharp' : 'flat'} moves ${letter} two semitones ${raised ? 'up' : 'down'}, to ${canonical}.`,
      },
    },
    srs_tags: [noteReadAtom(clef, pitch)],
    kb_version: KB_VERSION,
  };
}

export const noteSoundsAs: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildSoundsAs(candidateSeed, opts.grade, opts.seed, opts.atoms));
