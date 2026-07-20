// Grade 1 interval_naming generator (curriculum/exercise-templates.json,
// template_id "interval_naming"). G1 rule (scope.ts scopeForGrade(1).intervalRule): the
// lower note is pinned to the tonic of a sampled major key, the upper note is a
// diatonic pitch above it (number-only naming, above tonic, <= an octave). Each
// pitch is spelled in the key (spellInKey) so the key signature carries its
// accidental — a natural tonic prints plain, a flat/sharp tonic (Bb, Eb) prints
// under its key signature rather than as a stray natural (commandment 1: scope
// is law).

import type { Clef } from '../../music/types';
import { KB_VERSION } from '../../content/knowledge-base';
import { intervalAtom, intervalTypeAtom, parseAtom } from '../atoms';
import { intervalLabel, intervalQuality, type IntervalQuality } from '../interval-quality';
import { int, mulberry32, pick } from '../rng';
import type { GradeScope } from '../scope';
import {
  comfortablePitchRange,
  diatonicPitchesInComfortableRange,
  diatonicPitchesInRange,
  pitchRange,
  scopeForGrade,
} from '../scope';
import type { ExerciseInstance } from '../schema';
import { spellInKey, spellInKeySig, tonicLetter } from './key-spelling';
import { naturalPitchStepsAbove, scientificPitchOrdinal } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Shared sampling core for both the mcq and stave_input variants: pin the
 *  lower note to the sampled key's tonic and draw a diatonic interval above
 *  it that stays within the clef's grade range (scope.intervalRule). Returns the
 *  tonic as a NATURAL-letter pitch (the interval math needs it); callers spell it
 *  in the key for display. */
function sampleInterval(
  rng: () => number,
  clef: Clef,
  key: string,
  grade: number,
): { lowerPitch: string; steps: number; intervalNumber: number } {
  const range = pitchRange(clef, grade);

  // Match the tonic's natural LETTER — the naturals-only enumeration never holds
  // an accidented pitch, so a flat key ('Bb') would never match its full name.
  const tonicOccurrences = diatonicPitchesInRange(clef, grade).filter((p) => p.startsWith(tonicLetter(key)));
  if (tonicOccurrences.length === 0) {
    throw new Error(`no in-range occurrence of tonic ${key} for clef ${clef}`);
  }
  const lowerPitch = tonicOccurrences[0];

  const highOrdinal = scientificPitchOrdinal(range.high);
  const maxSteps = Math.min(7, highOrdinal - scientificPitchOrdinal(lowerPitch));
  if (maxSteps < 1) {
    throw new Error(`no room above the tonic ${lowerPitch} for an interval within range`);
  }

  const steps = int(rng, 1, maxSteps);
  return { lowerPitch, steps, intervalNumber: steps + 1 };
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);

  // Grade-3 (D1/D3/D4): number+type naming branches AFTER the shared clef
  // draw into its own key/number sampling — the else below is the untouched
  // grade-1/2 sequence (byte-identity: no reorder, no extra draw before it).
  if (scope.intervalRule.namingStyle === 'number_and_type') {
    return buildNumberAndType(rng, scope, clef, grade, idSeed, atoms);
  }

  const key = pick(rng, [...scope.keysMajor]);
  const { lowerPitch, steps, intervalNumber } = sampleInterval(rng, clef, key, grade);
  const upperPitch = spellInKey(naturalPitchStepsAbove(lowerPitch, steps), key);

  const distractors = [intervalNumber - 1, intervalNumber + 1].filter(
    (n) => n >= 1 && n <= 8 && n !== intervalNumber,
  );

  return {
    id: makeInstanceId('interval_naming', grade, idSeed),
    template_id: 'interval_naming',
    grade,
    strand: 'intervals',
    prompt: 'Name this interval (number only).',
    stimulus: {
      music: {
        clef,
        key_sig: `${key}_major`,
        time_sig: null,
        voices: [{ events: [{ type: 'chord', pitches: [spellInKey(lowerPitch, key), upperPitch], dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: intervalNumber, accepted_alternatives: [] },
    distractors,
    hints: ['Count the letter names from the lower note up to the higher note, counting both ends.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — recount inclusively from the lower note to the upper note, counting both ends.',
    },
    srs_tags: [intervalAtom(intervalNumber)],
    kb_version: KB_VERSION,
  };
}

// --- Grade-3 number+type branch (D3/D4/D5/D6) -------------------------------
// Above a major tonic every diatonic interval is perfect/major, so "minor"
// would only ever be a distractor — D3 fixes this by ALSO sampling minor-key
// tonics, spelled in the minor key SIGNATURE (natural minor, no form
// sampling). This is a distinct draw sequence from the grade-1/2 `key = pick
// (...keysMajor)` above, confined entirely to this branch.

/** The atom-named interval numbers (interval_type:<n>) present in `atoms`,
 *  deduplicated in atom order — the due-path scoping fix (ORC1/R5): a due
 *  `interval_type:5` review must draw number 5, not a random one. Empty when
 *  `atoms` carries no interval_type atom (bare draw — onboarding/rotation, or
 *  a lesson's full 2..8 atom set covers the whole range anyway). */
function intervalTypeTargets(atoms: string[]): number[] {
  const numbers: number[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'interval_type' || parts.length !== 1) continue;
    const n = Number(parts[0]);
    if (Number.isInteger(n) && n >= 2 && n <= 8 && !numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

/** The `count` nearest distinct numbers to `n` within 2..8, ordered by
 *  ascending |m-n|, ties preferring the lower number (D6/ORC2) — e.g.
 *  nearestNumbers(8, 2) === [7, 6], NOT a ±1 clamp (which would drop to a
 *  single in-range neighbour for the octave). */
function nearestNumbers(n: number, count: number): number[] {
  const candidates = [2, 3, 4, 5, 6, 7, 8].filter((m) => m !== n);
  candidates.sort((a, b) => {
    const diff = Math.abs(a - n) - Math.abs(b - n);
    return diff !== 0 ? diff : a - b;
  });
  return candidates.slice(0, count);
}

/** D6: exactly 2 well-formed grade-3 labels, both computed (not hardcoded)
 *  from the same tonic/key so a distractor never carries an impossible label
 *  for its number. Perfect numbers (no in-vocabulary quality flip) get the
 *  two nearest-number distractors; major/minor numbers get one quality-flip
 *  plus the nearest-number distractor. */
function buildQualityDistractors(
  lowerPitch: string,
  lowerDisplay: string,
  keySig: string,
  number: number,
  quality: IntervalQuality,
): string[] {
  const neighbourLabel = (m: number): string => {
    const upper = spellInKeySig(naturalPitchStepsAbove(lowerPitch, m - 1), keySig);
    return intervalLabel(intervalQuality(lowerDisplay, upper, m), m);
  };

  if (quality === 'perfect') {
    return nearestNumbers(number, 2).map(neighbourLabel);
  }

  const flipped: IntervalQuality = quality === 'major' ? 'minor' : 'major';
  const [nearest] = nearestNumbers(number, 1);
  return [intervalLabel(flipped, number), neighbourLabel(nearest)];
}

function buildNumberAndType(
  rng: () => number,
  scope: GradeScope,
  clef: Clef,
  grade: number,
  idSeed: number,
  atoms: string[],
): ExerciseInstance {
  const keySigPool = [...scope.keysMajor.map((k) => `${k}_major`), ...scope.keysMinor.map((k) => `${k}_minor`)];
  const keySig = pick(rng, keySigPool);
  const tonic = keySig.split('_')[0];

  // Stimulus pitch stays in the comfortable (grade-2) range, not the widened
  // grade-3 reading range — this exercise tests interval quality, not ledger
  // reading (which note_naming's ledger atoms own). See comfortablePitchRange.
  const range = comfortablePitchRange(clef, grade);
  const tonicOccurrences = diatonicPitchesInComfortableRange(clef, grade).filter((p) =>
    p.startsWith(tonicLetter(tonic)),
  );
  if (tonicOccurrences.length === 0) {
    throw new Error(`interval_naming: no in-range occurrence of tonic ${tonic} for clef ${clef}`);
  }
  const lowerPitch = tonicOccurrences[0];
  const maxSteps = Math.min(7, scientificPitchOrdinal(range.high) - scientificPitchOrdinal(lowerPitch));
  if (maxSteps < 1) {
    throw new Error(`interval_naming: no room above the tonic ${lowerPitch} for an interval within range`);
  }

  const targets = intervalTypeTargets(atoms);
  const feasibleNumbers =
    targets.length > 0
      ? targets.filter((n) => n - 1 <= maxSteps)
      : Array.from({ length: maxSteps }, (_, i) => i + 2);
  if (feasibleNumbers.length === 0) {
    throw new Error(`interval_naming: no atom-scoped interval number fits within range above ${tonic}`);
  }
  const number = pick(rng, feasibleNumbers);
  const steps = number - 1;

  const lowerDisplay = spellInKeySig(lowerPitch, keySig);
  const upper = spellInKeySig(naturalPitchStepsAbove(lowerPitch, steps), keySig);
  const quality = intervalQuality(lowerDisplay, upper, number);
  const canonical = intervalLabel(quality, number);
  const distractors = buildQualityDistractors(lowerPitch, lowerDisplay, keySig, number, quality);

  return {
    id: makeInstanceId('interval_naming', grade, idSeed),
    template_id: 'interval_naming',
    grade,
    strand: 'intervals',
    prompt: 'Name this interval (number and type).',
    stimulus: {
      music: {
        clef,
        key_sig: keySig,
        time_sig: null,
        voices: [{ events: [{ type: 'chord', pitches: [lowerDisplay, upper], dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors,
    hints: [
      'Count the letter names for the number, then check the upper note against the key signature — in the signature is major or perfect, a semitone smaller is minor.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect:
        'Not quite — recount the letter names for the number, then compare the upper note to the key signature to check major, minor, or perfect.',
    },
    srs_tags: [intervalTypeAtom(number)],
    kb_version: KB_VERSION,
  };
}

export const intervalNaming: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));

// --- Stave-input variant (U8/RD2): "write the note a [interval] higher than
// the given note" — the sole Grade 1 stave-input item; no general write-any-
// note (RD2). A separate template_id ("interval_naming_stave_input") rather
// than a mode flag on `intervalNaming`, mirroring term-meaning's mcq/flashcard
// split (AD2's reasoning): `intervalNaming` (mcq) stays byte-identical for
// every existing caller, and U9 points the intervals lesson at whichever id it
// wants. `answer.canonical` is the SEMANTIC target { pitch, dur } — a
// scientific pitch spelled in the sampled key + a G1 duration — never a
// rendered Music object (mirrors AD5's semantic-canonical rule; StaveInput's
// grading never deep-equals a Music object either).

/** "an 8th", but "a 5th" — the article follows how the ordinal is SPOKEN (eighth,
 *  eleventh, eighteenth begin with a vowel sound), not how it is spelt. */
function article(n: number): string {
  return [8, 11, 18].includes(n % 100) ? 'an' : 'a';
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function buildStaveInput(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);
  const key = pick(rng, [...scope.keysMajor]);
  const { lowerPitch, steps, intervalNumber } = sampleInterval(rng, clef, key, grade);
  const targetPitch = spellInKey(naturalPitchStepsAbove(lowerPitch, steps), key);
  const targetDur = pick(rng, [...scope.noteValues]);

  return {
    id: makeInstanceId('interval_naming_stave_input', grade, idSeed),
    template_id: 'interval_naming_stave_input',
    grade,
    strand: 'intervals',
    prompt: `Write the note ${article(intervalNumber)} ${ordinal(intervalNumber)} higher than the given note, as a ${targetDur}.`,
    stimulus: {
      music: {
        clef,
        key_sig: `${key}_major`,
        time_sig: null,
        voices: [{ events: [{ type: 'note', pitch: spellInKey(lowerPitch, key), dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'stave_input', config: {} },
    answer: { canonical: { pitch: targetPitch, dur: targetDur }, accepted_alternatives: [] },
    distractors: [],
    hints: [
      'Count the letter names from the given note up to the target note, counting both ends — then match the requested duration.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — recount the interval inclusively from the given note, and check you used the requested duration.',
    },
    srs_tags: [intervalAtom(intervalNumber)],
    kb_version: KB_VERSION,
  };
}

export const intervalNamingStaveInput: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildStaveInput(candidateSeed, opts.grade, opts.seed));
