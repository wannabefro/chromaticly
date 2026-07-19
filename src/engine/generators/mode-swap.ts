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

import { KB, KB_VERSION } from '../../content/knowledge-base';
import { keySigAtom, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { relativeMajorOf } from './minor-keys';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type Direction = 'minor_of_major' | 'major_of_minor';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURAL_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL_SYMBOL: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

function parseTonic(tonic: string): { letter: string; accidentalSemitones: number } {
  const m = /^([A-G])(#|b)?$/.exec(tonic);
  if (!m) throw new Error(`mode_swap: invalid tonic ${tonic}`);
  const [, letter, symbol] = m;
  return { letter, accidentalSemitones: symbol === '#' ? 1 : symbol === 'b' ? -1 : 0 };
}

/** The bare tonic (no octave) a minor 3rd above/below `tonic` — the D4
 *  wrong-direction distractor candidate: "relative minor of X major" counted
 *  UP instead of down (e.g. D -> F), "relative major of Y minor" counted DOWN
 *  instead of up. Letter walk + semitone-matching accidental, same idea as
 *  minor-keys.ts's shiftAccidental but tonic-only (no octave) and direction-
 *  general. Returns null when the result needs a double accidental to land on
 *  the right semitone — such a tonic can never be `in scope` anyway, so the
 *  caller's scope-membership check would reject it regardless. */
function minorThirdTonic(tonic: string, direction: 'up' | 'down'): string | null {
  const { letter, accidentalSemitones } = parseTonic(tonic);
  const letterIdx = LETTERS.indexOf(letter as (typeof LETTERS)[number]);
  const step = direction === 'up' ? 2 : -2;
  const targetLetter = LETTERS[(((letterIdx + step) % 7) + 7) % 7];
  const sourceSemitone = (NATURAL_SEMITONE[letter] + accidentalSemitones + 12) % 12;
  const shift = direction === 'up' ? 3 : -3;
  const desiredSemitone = ((sourceSemitone + shift) % 12 + 12) % 12;
  const delta = (((desiredSemitone - NATURAL_SEMITONE[targetLetter] + 6) % 12) + 12) % 12 - 6;
  const symbol = ACCIDENTAL_SYMBOL[delta];
  return symbol === undefined ? null : `${targetLetter}${symbol}`;
}

/** Fill the D4 2-slot distractor cap from a same-mode `pool` of bare tonics.
 *  A no-op below `pool.length <= 2` — grade 2's pool is always exactly 2, so
 *  this branch is never entered there and no new rng draw happens on that
 *  path (keeps the grade-2 draw sequence, and its snapshots, byte-identical).
 *  Above that (grade >= 3 only): the wrong-direction tonic first, if it's
 *  actually in the pool, then the signature-adjacent (nearest fifths-count)
 *  remainder, rng-picking only to break a tie. */
function selectDistractorTonics(
  rng: () => number,
  pool: string[],
  canonicalFifths: number,
  fifthsOf: (tonic: string) => number,
  wrongDirectionTonic: string | null,
): string[] {
  if (pool.length <= 2) return pool;

  const remaining = [...pool];
  const selected: string[] = [];

  if (wrongDirectionTonic !== null) {
    const idx = remaining.indexOf(wrongDirectionTonic);
    if (idx !== -1) selected.push(remaining.splice(idx, 1)[0]);
  }

  while (selected.length < 2) {
    const distances = remaining.map((t) => Math.abs(fifthsOf(t) - canonicalFifths));
    const bestDistance = Math.min(...distances);
    const tied = remaining.filter((t) => Math.abs(fifthsOf(t) - canonicalFifths) === bestDistance);
    const chosen = tied.length === 1 ? tied[0] : pick(rng, tied);
    selected.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);
  }

  return selected;
}

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

  // The other in-scope same-mode keys — the diagnostic distractor POOL (D4):
  // at grade 2 this is always exactly 2 ("E minor", the counted-wrong-
  // direction confusion, and "D minor", the adjacent-pair confusion, for a
  // C-major question) so both go straight to the answer options. Grade 3
  // widens the pool past 2, so it gets capped below to a selected 2.
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

  // D4: cap the pool at exactly 2 (3-option MCQ everywhere). Gated on
  // pool.length > 2, which only grade 3+ ever reaches (grade 2's pool is
  // always exactly 2) — so selectDistractorTonics draws no rng on the
  // grade-2 path, keeping its draw sequence byte-identical.
  const pool = direction === 'minor_of_major' ? otherMinorTonics : otherMinorTonics.map(relativeMajorOf);
  const fifthsTable = direction === 'minor_of_major' ? KB.keySignatures.minors : KB.keySignatures.majors;
  const fifthsOf = (tonic: string): number => {
    const fifths = (fifthsTable as Record<string, number>)[tonic];
    if (fifths === undefined) throw new Error(`mode_swap: unknown tonic ${tonic} for fifths lookup`);
    return fifths;
  };
  const canonicalTonic = direction === 'minor_of_major' ? minorTonic : majorTonic;
  const wrongDirectionTonic =
    direction === 'minor_of_major' ? minorThirdTonic(majorTonic, 'up') : minorThirdTonic(minorTonic, 'down');
  const selectedTonics = selectDistractorTonics(rng, pool, fifthsOf(canonicalTonic), fifthsOf, wrongDirectionTonic);

  const distractors =
    direction === 'minor_of_major'
      ? selectedTonics.map((t) => `${t} minor`)
      : selectedTonics.map((t) => `${t} major`);

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
