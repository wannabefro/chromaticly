// Grade 2 mode_swap generator (D2/D3/D4) — relative-major/minor relationship
// MCQ. Registers a Tier-A generator under the id "mode_swap": the construction
// spec (exercise-construction-spec.md:116) also uses "mode_swap" for a Tier-B
// seed-phrase transformation, but that transformation applies to seed
// phrases, not template ids, so the two "mode_swap" names coexist without
// collision — this file owns only the Tier-A generator (D2).
//
// Question forms (D3): "Which key is the relative minor of C major?" and
// "Which key is the relative major of A minor?", picked from the seeded rng
// over the three grade-2 pairs (C/Am, G/Em, F/Dm). Stimulus is text-only
// (music: null) — a bare relative-key relationship has nothing to notate, so
// the notation never-violate rules 1/2 don't apply. Relative pairs come from
// minor-keys.ts's relativeMajorOf (KB-derived, D5) — never re-derived here.
//
// Single-atom-safe (D4): the ANSWER pair is picked from the lesson's
// `key_sig:*_minor` atoms — one atom pins that pair, unlike key_signature_id's
// >=2-atom throw (key-signature-id.ts:37-39). That's what keeps the Practice
// due path safe for a single weak atom. DISTRACTORS come from the grade
// SCOPE's other same-mode keys, never the atoms, so a single-atom scope still
// yields a full 2-distractor pool.

import { KB_VERSION } from '../../content/knowledge-base';
import { keySigAtom, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { relativeMajorOf } from './minor-keys';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type Direction = 'minor_of_major' | 'major_of_minor';

/** The lesson's `key_sig:*_minor` atoms as bare minor tonics, e.g.
 *  key_sig:A_minor -> "A". This is the ANSWER pool only (D4) — a single atom
 *  is enough to pin one pair; distractors are drawn from scope, not here. */
function minorTonicsFromAtoms(atoms: string[]): string[] {
  const tonics: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'key_sig') continue;
    const [tonic, mode] = parts[0].split('_');
    if (mode !== 'minor') continue;
    if (!tonics.includes(tonic)) tonics.push(tonic);
  }
  if (tonics.length === 0) {
    throw new Error('mode_swap: needs at least one key_sig:*_minor atom');
  }
  return tonics;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const minorTonic = pick(rng, minorTonicsFromAtoms(atoms));
  const majorTonic = relativeMajorOf(minorTonic);
  const direction = pick<Direction>(rng, ['minor_of_major', 'major_of_minor']);

  // The other in-scope same-mode keys — the diagnostic distractor pool (D4):
  // for a C-major question this includes "E minor" (the counted-the-wrong-
  // direction confusion) and "D minor" (adjacent-pair confusion).
  const otherMinorTonics = scope.keysMinor.filter((t) => t !== minorTonic);

  const prompt =
    direction === 'minor_of_major'
      ? `Which key is the relative minor of ${majorTonic} major?`
      : `Which key is the relative major of ${minorTonic} minor?`;
  const stimulusText =
    direction === 'minor_of_major'
      ? `Relative minor of ${majorTonic} major`
      : `Relative major of ${minorTonic} minor`;

  const canonical = direction === 'minor_of_major' ? `${minorTonic} minor` : `${majorTonic} major`;
  const distractors =
    direction === 'minor_of_major'
      ? otherMinorTonics.map((t) => `${t} minor`)
      : otherMinorTonics.map((t) => `${relativeMajorOf(t)} major`);

  const feedbackIncorrect =
    direction === 'minor_of_major'
      ? 'Count a minor 3rd *down* from the major tonic — the relative minor shares its key signature.'
      : 'Count a minor 3rd *up* from the minor tonic — the relative major shares its key signature.';

  return {
    id: makeInstanceId('mode_swap', grade, idSeed),
    template_id: 'mode_swap',
    grade,
    strand: 'scales_keys',
    prompt,
    stimulus: { music: null, text: stimulusText },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors,
    hints: ['A key and its relative minor/major share the same key signature.'],
    feedback: {
      correct: 'Correct!',
      incorrect: feedbackIncorrect,
    },
    srs_tags: [keySigAtom(`${minorTonic}_minor`)],
    kb_version: KB_VERSION,
  };
}

export const modeSwap: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
