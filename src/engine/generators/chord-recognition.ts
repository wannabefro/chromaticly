// Grade 4 chord_recognition generator (fyu.10, first harmony content) —
// recognition-only: name the Roman numeral of a root-position primary triad
// (I/IV/V) in a stated MAJOR key. I/IV/V are all MAJOR triads in a major key
// (fixed music theory, not KB-sourced), so the learner reads the key
// signature to place the shown chord's root among the 1st/4th/5th scale
// degrees — no construction, no minor-key harmony this slice.
//
// Mirrors interval-naming.ts's inlined ChordEvent stimulus and
// degree-name-id.ts's atom-scoped selection (a `chord:<numeral>` atom pins
// which numeral the lesson draws, same discipline as `degree_name:<name>`).

import { KB_VERSION } from '../../content/knowledge-base';
import { CHORD_NUMERALS, chordAtom, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { comfortablePitchRange, diatonicPitchesInComfortableRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import type { Clef } from '../../music/types';
import { spellInKey, tonicLetter } from './key-spelling';
import { naturalPitchStepsAbove, parseNaturalPitch, scientificPitchOrdinal } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Only treble/bass are used for chord recognition (per the spec's "treble;
 *  you may also use bass") — alto reading is a separate, unrelated skill. */
const CHORD_CLEFS: readonly Clef[] = ['treble', 'bass'];

/** Diatonic (letter-name) steps above the tonic for each primary triad's
 *  root: I is the tonic itself, IV the subdominant (3 steps up), V the
 *  dominant (4 steps up). Fixed music theory — exported so validator.ts's
 *  chordRecognitionHook can independently recompute the numeral from a
 *  stimulus chord's root letter, never trusting the generator's own pick. */
export const CHORD_DEGREE_STEPS: Record<string, number> = { I: 0, IV: 3, V: 4 };

/** The `chord:<numeral>` atoms in `atoms`, deduplicated in atom order — mirrors
 *  degree-name-id.ts's namesFromAtoms. */
function numeralsFromAtoms(atoms: string[]): string[] {
  const numerals: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'chord') continue;
    const [numeral] = parts;
    if (!(CHORD_NUMERALS as readonly string[]).includes(numeral)) {
      throw new Error(`chord_recognition: atom "${atom}" names an unknown chord numeral`);
    }
    if (!numerals.includes(numeral)) numerals.push(numeral);
  }
  if (numerals.length === 0) {
    throw new Error('chord_recognition: needs at least one chord:* atom');
  }
  return numerals;
}

/** Root-position major triad (root, third, fifth), spelled in `key`, for the
 *  given numeral — an in-range occurrence of the root's natural letter is
 *  chosen so the third (root+2 diatonic steps) and fifth (root+4) both stay
 *  within comfortablePitchRange (readability, mirroring the incidental-pitch
 *  convention other generators use for non-reading-subject notation). */
function buildTriad(clef: Clef, grade: number, key: string, numeral: string): [string, string, string] {
  const range = comfortablePitchRange(clef, grade);
  const tonicOccurrences = diatonicPitchesInComfortableRange(clef, grade).filter((p) => p.startsWith(tonicLetter(key)));
  if (tonicOccurrences.length === 0) {
    throw new Error(`chord_recognition: no in-range occurrence of tonic ${key} for clef ${clef}`);
  }

  const degreeSteps = CHORD_DEGREE_STEPS[numeral];
  const rootLetter = parseNaturalPitch(naturalPitchStepsAbove(tonicOccurrences[0], degreeSteps)).letter;

  const rootCandidates = diatonicPitchesInComfortableRange(clef, grade).filter(
    (p) => parseNaturalPitch(p).letter === rootLetter,
  );
  const highOrdinal = scientificPitchOrdinal(range.high);
  const fittingRoots = rootCandidates.filter((p) => highOrdinal - scientificPitchOrdinal(p) >= 4);
  if (fittingRoots.length === 0) {
    throw new Error(
      `chord_recognition: no root occurrence of ${rootLetter} leaves room for a triad within range for clef ${clef}`,
    );
  }
  const rootNatural = fittingRoots[0];
  const thirdNatural = naturalPitchStepsAbove(rootNatural, 2);
  const fifthNatural = naturalPitchStepsAbove(rootNatural, 4);

  return [spellInKey(rootNatural, key), spellInKey(thirdNatural, key), spellInKey(fifthNatural, key)];
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...CHORD_CLEFS]);
  const key = pick(rng, [...scope.keysMajor]);
  const numeral = pick(rng, numeralsFromAtoms(atoms));

  const triads: Record<string, [string, string, string]> = {};
  for (const n of CHORD_NUMERALS) {
    triads[n] = buildTriad(clef, grade, key, n);
  }

  const distractors = CHORD_NUMERALS.filter((n) => n !== numeral);

  return {
    id: makeInstanceId('chord_recognition', grade, idSeed),
    template_id: 'chord_recognition',
    grade,
    strand: 'chords',
    prompt: 'Name this chord (Roman numeral).',
    stimulus: {
      music: {
        clef,
        key_sig: `${key}_major`,
        time_sig: null,
        voices: [{ events: [{ type: 'chord', pitches: triads[numeral], dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: {
      type: 'roman_numeral_boxes',
      config: { numerals: [...CHORD_NUMERALS], triads },
    },
    answer: { canonical: numeral, accepted_alternatives: [] },
    distractors,
    hints: [
      'I is built on the 1st degree (tonic), IV on the 4th (subdominant), V on the 5th (dominant) — check which scale degree the chord\'s lowest note sits on.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect:
        'Not quite — check which scale degree the chord\'s lowest note (the root) sits on: I = 1st degree, IV = 4th degree, V = 5th degree.',
    },
    srs_tags: [chordAtom(numeral)],
    kb_version: KB_VERSION,
  };
}

export const chordRecognition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
