// Grade 4 enharmonic_recognition generator (enharmonics-4, KB pitch_knowledge
// "enharmonic equivalents") — text-only recognition: given a note, name the
// note that sounds the same pitch but is spelled differently (F# = Gb). No
// notation (enharmonic equivalence is a spelling fact, not a reading skill), so
// stimulus.music/text stay null and the question lives in `prompt` — the same
// text-only mcq shape as instrument-knowledge.ts's family/clef questions.
//
// The five black-key pairs, both directions. Exports its fixed ENHARMONIC_PARTNER
// table so the validator can recompute against it (never trusting the generator's
// own pick), and the validator additionally re-derives equivalence from pitch
// semitones so the table itself can't hide a wrong pairing.

import { KB_VERSION } from '../../content/knowledge-base';
import { enharmonicAtom, ENHARMONIC_NOTES, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Fixed music theory: the five black-key enharmonic pairs, both spellings. */
export const ENHARMONIC_PARTNER: Record<string, string> = {
  'C#': 'Db',
  Db: 'C#',
  'D#': 'Eb',
  Eb: 'D#',
  'F#': 'Gb',
  Gb: 'F#',
  'G#': 'Ab',
  Ab: 'G#',
  'A#': 'Bb',
  Bb: 'A#',
};

/** ASCII note spelling → display form: "F#" -> "F♯", "Gb" -> "G♭", "F" -> "F". */
export function displayNote(note: string): string {
  return note.replace('#', '♯').replace('b', '♭');
}

/** The enharmonic:<note> atoms in `atoms`, in atom order (mirrors
 *  chord-recognition.ts's numeralsFromAtoms). At least one is required. */
function notesFromAtoms(atoms: string[]): string[] {
  const notes: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'enharmonic' || parts.length !== 1) continue;
    const [note] = parts;
    if (!(ENHARMONIC_NOTES as readonly string[]).includes(note)) {
      throw new Error(`enharmonic_recognition: atom "${atom}" names an unknown note spelling`);
    }
    if (!notes.includes(note)) notes.push(note);
  }
  if (notes.length === 0) {
    throw new Error('enharmonic_recognition: needs at least one enharmonic:<note> atom');
  }
  return notes;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const note = pick(rng, notesFromAtoms(atoms));
  const partner = ENHARMONIC_PARTNER[note];

  // Diagnostic distractors: the naturals of each pair member's letter — the
  // "ignore the accidental" error and the "wrong letter" error. Both are plain
  // letters, always distinct from each other and from the accidental answer.
  const distractors = [displayNote(note[0]), displayNote(partner[0])];

  return {
    id: makeInstanceId('enharmonic_recognition', grade, idSeed),
    template_id: 'enharmonic_recognition',
    grade,
    strand: 'pitch',
    prompt: `Which note is the same pitch as ${displayNote(note)}?`,
    stimulus: { music: null, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: displayNote(partner), accepted_alternatives: [] },
    distractors,
    hints: ['The same key on a keyboard can be spelled two ways — one with a sharp, one with a flat. Keep the pitch, change the letter.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — ${displayNote(note)} and ${displayNote(partner)} are the same pitch spelled two ways.`,
      by_distractor: {
        [displayNote(note[0])]: `${displayNote(note[0])} is ${displayNote(note)} with its accidental dropped, a semitone away.`,
        [displayNote(partner[0])]: `${displayNote(partner[0])} is the right letter, but it needs its accidental to match ${displayNote(note)}.`,
      },
    },
    srs_tags: [enharmonicAtom(note)],
    kb_version: KB_VERSION,
  };
}

export const enharmonicRecognition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
