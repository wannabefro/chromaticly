// Grade 4 chromatic_scale generator (fyu.4) — spot-the-wrong-note MCQ over a
// full 13-note ascending chromatic scale, mirroring scale_construction's shape
// (scale-construction.ts) but with no key signature: a chromatic scale names
// no key, so `key_sig` stays null and checkScope's key-signature check never
// fires for this template.
//
// ALL-SHARP SPELLING (the exact house rule, satisfies "no letter name more
// than twice in succession"): walking the 7 natural letters from the tonic,
// a WHOLE-TONE gap to the next natural letter gets the lower letter's sharp
// inserted (C -> C# -> D); a SEMITONE gap (E-F, B-C) gets nothing inserted.
// This is letter-general — no per-tonic branching — so every allowed tonic
// (natural letters only, MVP) produces the same 13-note shape.

import type { Music } from '../../music/types';
import { KB_VERSION } from '../../content/knowledge-base';
import { parseAtom } from '../atoms';
import { int, mulberry32, pick } from '../rng';
import type { ExerciseInstance } from '../schema';
import { validScaleStartPitches } from './scale-construction';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** MVP tonic set (natural letters only) — exported so the lessons.ts loader
 *  gate and the validator hook share this list rather than each hardcoding
 *  their own copy. */
export const CHROMATIC_TONICS: readonly string[] = ['C', 'G', 'D', 'F', 'A', 'E'];

const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

// Semitone gap from each natural letter to the NEXT natural letter — 2
// (whole tone, insert this letter's sharp) or 1 (semitone, insert nothing).
const GAP_TO_NEXT: Record<(typeof LETTER_ORDER)[number], number> = {
  C: 2,
  D: 2,
  E: 1,
  F: 2,
  G: 2,
  A: 2,
  B: 1,
};

const ORDINAL_LABELS = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
  '13th',
] as const;

/** Interior degrees (0-indexed): everything but the tonic (0) and the octave (12). */
const INTERIOR_DEGREES: number[] = Array.from({ length: 11 }, (_, i) => i + 1);

export function chromaticPositionLabel(degree: number): string {
  return `${ORDINAL_LABELS[degree]} note`;
}

/** The 13-note ascending all-sharp chromatic scale starting at `startPitch`
 *  ("<Letter><Octave>", natural letter only). Exported so the validator hook
 *  recomputes the same scale independently rather than trusting the
 *  generator (KTD5), and so the unit test can assert the exact note list. */
export function chromaticScaleAscending(startPitch: string): string[] {
  const m = /^([A-G])(-?\d+)$/.exec(startPitch);
  if (!m) throw new Error(`chromatic_scale: invalid start pitch "${startPitch}"`);
  const [, startLetter, startOctaveStr] = m;

  let idx = LETTER_ORDER.indexOf(startLetter as (typeof LETTER_ORDER)[number]);
  let octave = Number(startOctaveStr);
  const notes: string[] = [];

  for (let i = 0; i < 7; i++) {
    const letter = LETTER_ORDER[idx];
    notes.push(`${letter}${octave}`);
    if (GAP_TO_NEXT[letter] === 2) notes.push(`${letter}#${octave}`);
    if (letter === 'B') octave += 1;
    idx = (idx + 1) % LETTER_ORDER.length;
  }
  notes.push(`${startLetter}${octave}`);

  return notes;
}

/** Flip a note's accidental: natural -> sharp, sharp -> natural (the only two
 *  spellings this generator's true scale ever carries) — a one-semitone shift
 *  that keeps the same letter, so the corruption is always unambiguous. */
function flipAccidental(pitch: string): string {
  const m = /^([A-G])(#)?(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`chromatic_scale: invalid pitch "${pitch}"`);
  const [, letter, sharp, octave] = m;
  return sharp ? `${letter}${octave}` : `${letter}#${octave}`;
}

/** The lesson's `scale:*_chromatic` atoms as bare tonics, e.g.
 *  scale:C_chromatic -> "C". Throws on any atom naming a tonic outside the
 *  MVP set — mirrors key_signature_id's `mode !== 'major'` throw. */
function chromaticTonicsFromAtoms(atoms: string[]): string[] {
  const tonics: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'scale') continue;
    const [tonic, mode] = parts[0].split('_');
    if (mode !== 'chromatic') continue;
    if (!CHROMATIC_TONICS.includes(tonic)) {
      throw new Error(`chromatic_scale: tonic "${tonic}" is not an allowed chromatic tonic (C, G, D, F, A, E only)`);
    }
    if (!tonics.includes(tonic)) tonics.push(tonic);
  }
  if (tonics.length === 0) {
    throw new Error('chromatic_scale: needs at least one scale:*_chromatic atom');
  }
  return tonics;
}

function sampleDistinct(rng: () => number, items: number[], n: number): number[] {
  const pool = [...items];
  const result: number[] = [];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = int(rng, 0, pool.length - 1);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function scaleMusic(pitches: string[]): Music {
  return {
    clef: 'treble',
    key_sig: null,
    time_sig: null,
    voices: [{ events: pitches.map((pitch) => ({ type: 'note', pitch, dur: 'crotchet' })) }],
  };
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const tonic = pick(rng, chromaticTonicsFromAtoms(atoms));

  const starts = validScaleStartPitches(tonic, 'treble', grade);
  if (starts.length === 0) {
    throw new Error(`chromatic_scale: no valid start pitch for ${tonic} chromatic on treble clef at grade ${grade}`);
  }
  const startPitch = pick(rng, starts);
  const trueScale = chromaticScaleAscending(startPitch);

  const corruptDegree = pick(rng, INTERIOR_DEGREES);
  const corrupted = [...trueScale];
  corrupted[corruptDegree] = flipAccidental(trueScale[corruptDegree]);

  const canonical = chromaticPositionLabel(corruptDegree);
  const remainingDegrees = INTERIOR_DEGREES.filter((d) => d !== corruptDegree);
  const distractors = sampleDistinct(rng, remainingDegrees, 2).map(chromaticPositionLabel);

  return {
    id: makeInstanceId('chromatic_scale', grade, idSeed),
    template_id: 'chromatic_scale',
    grade,
    strand: 'scales_keys',
    prompt: 'One note of this chromatic scale is wrong — which one?',
    stimulus: { music: scaleMusic(corrupted), text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors,
    hints: ['Every note of a chromatic scale is a semitone above the last — compare each note to its neighbour.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `The ${canonical} should be ${trueScale[corruptDegree]} — a chromatic scale moves in semitones the whole way up.`,
    },
    srs_tags: [`scale:${tonic}_chromatic`],
    kb_version: KB_VERSION,
  };
}

export const chromaticScale: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
