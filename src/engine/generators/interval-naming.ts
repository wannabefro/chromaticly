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
import { intervalAnyAtom, intervalAtom, intervalCompoundAtom, intervalKeyAtom, intervalTypeAtom, parseAtom } from '../atoms';
import {
  COMPOUND_NUMBERS,
  compoundAltLabel,
  intervalLabel,
  intervalQuality,
  simpleEquivalent,
  type IntervalQuality,
} from '../interval-quality';
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
  targets: number[] = [],
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

  const feasible = targets.filter((n) => n - 1 <= maxSteps);
  if (targets.length > 0 && feasible.length === 0) {
    throw new Error(`interval_naming: no atom-scoped interval fits above ${lowerPitch}`);
  }
  const steps = feasible.length > 0 ? pick(rng, feasible) - 1 : int(rng, 1, maxSteps);
  return { lowerPitch, steps, intervalNumber: steps + 1 };
}

/** The atom-named key signatures (interval_key:<key>) in `atoms`, in atom order.
 *  Empty at grade 1, which has no such atom and keeps its untouched draw. */
function intervalKeyTargets(atoms: string[], scope: GradeScope): string[] {
  const inScope = new Set([
    ...scope.keysMajor.map((k) => `${k}_major`),
    ...scope.keysMinor.map((k) => `${k}_minor`),
  ]);
  const keys: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'interval_key' || parts.length !== 1) continue;
    if (inScope.has(parts[0]) && !keys.includes(parts[0])) keys.push(parts[0]);
  }
  return keys;
}

// Grade 2 (chromaticly-0i9): same number-only rule as grade 1, but anchored to
// a NAMED key so the minor tonics reach the learner and credit lands on the key
// rather than on grade 1's bare interval:<n>.
function buildAboveTonicInKey(
  rng: () => number,
  clef: Clef,
  grade: number,
  idSeed: number,
  keys: string[],
): ExerciseInstance {
  const keySig = pick(rng, keys);
  const tonic = keySig.split('_')[0];
  const range = comfortablePitchRange(clef, grade);
  const occurrences = diatonicPitchesInComfortableRange(clef, grade).filter((p) =>
    p.startsWith(tonicLetter(tonic)),
  );
  if (occurrences.length === 0) {
    throw new Error(`interval_naming: no in-range occurrence of tonic ${tonic} for clef ${clef}`);
  }
  const lowerPitch = occurrences[0];
  const maxSteps = Math.min(7, scientificPitchOrdinal(range.high) - scientificPitchOrdinal(lowerPitch));
  if (maxSteps < 1) {
    throw new Error(`interval_naming: no room above the tonic ${lowerPitch} for an interval within range`);
  }

  const steps = int(rng, 1, maxSteps);
  const number = steps + 1;
  const lowerDisplay = spellInKeySig(lowerPitch, keySig);
  const upper = spellInKeySig(naturalPitchStepsAbove(lowerPitch, steps), keySig);
  const distractors = [number - 1, number + 1].filter((n) => n >= 1 && n <= 8 && n !== number);
  const keyName = `${tonic} ${keySig.endsWith('_minor') ? 'minor' : 'major'}`;

  return {
    id: makeInstanceId('interval_naming', grade, idSeed),
    template_id: 'interval_naming',
    grade,
    strand: 'intervals',
    prompt: `This is ${keyName}. Name the interval above the tonic (number only).`,
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
    answer: { canonical: number, accepted_alternatives: [] },
    distractors,
    hints: [`The lower note is the tonic of ${keyName}. Count the letter names up to the higher note, both ends included.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `Recount from the tonic of ${keyName} to the upper note, counting both ends: it is ${article(number)} ${number}.`,
      by_distractor: Object.fromEntries(
        distractors.map((n) => [
          String(n),
          n < number
            ? `That is the number of steps between the notes. An interval counts both notes themselves, so this one is ${article(number)} ${number}.`
            : `That is one too many. Count the letter names from the tonic to the upper note and you get ${number}, not ${n}.`,
        ]),
      ),
    },
    srs_tags: [intervalKeyAtom(keySig)],
    kb_version: KB_VERSION,
  };
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

  const keyTargets = intervalKeyTargets(atoms, scope);
  if (keyTargets.length > 0) return buildAboveTonicInKey(rng, clef, grade, idSeed, keyTargets);

  const key = pick(rng, [...scope.keysMajor]);
  const { lowerPitch, steps, intervalNumber } = sampleInterval(rng, clef, key, grade, numberTargets(atoms, 'interval'));
  const upperPitch = spellInKey(naturalPitchStepsAbove(lowerPitch, steps), key);

  const distractors = [intervalNumber - 1, intervalNumber + 1].filter(
    (n) => n >= 1 && n <= 8 && n !== intervalNumber,
  );

  // The two off-by-one distractors are opposite counting errors, not one vague
  // "recount" (rule 5). One below means the learner counted the STEPS between
  // the notes; one above means they counted a letter that is not there. Built
  // from the FILTERED list: at an octave the +1 neighbour is out of range and
  // never offered, so writing copy for it would leave a key nothing can pick.
  const byDistractor = Object.fromEntries(
    distractors.map((n) => [
      String(n),
      n < intervalNumber
        ? `That is the number of steps between the notes. An interval counts both notes themselves, so this one is ${article(intervalNumber)} ${intervalNumber}, not ${article(n)} ${n}.`
        : `That is one too many. Count the letter names from the lower note to the upper note and you get ${intervalNumber}, not ${n}.`,
    ]),
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
      by_distractor: byDistractor,
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
  return numberTargets(atoms, 'interval_type');
}

/** Due-path scoping for any `<kind>:<n>` atom: a due `interval:6` must draw
 *  a 6th. */
function numberTargets(atoms: string[], kind: string): number[] {
  const numbers: number[] = [];
  for (const atom of atoms) {
    const parsed = parseAtom(atom);
    if (parsed.kind !== kind || parsed.parts.length !== 1) continue;
    const n = Number(parsed.parts[0]);
    if (Number.isInteger(n) && n >= 2 && n <= 8 && !numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

/** The `count` nearest distinct numbers to `n` within 2..8, ordered by
 *  ascending |m-n|, ties preferring the lower number (D6/ORC2) — e.g.
 *  nearestNumbers(8, 2) === [7, 6], NOT a ±1 clamp (which would drop to a
 *  single in-range neighbour for the octave). */
function nearestNumbers(n: number, count: number, pool: readonly number[] = [2, 3, 4, 5, 6, 7, 8]): number[] {
  const candidates = pool.filter((m) => m !== n);
  candidates.sort((a, b) => {
    const diff = Math.abs(a - n) - Math.abs(b - n);
    return diff !== 0 ? diff : a - b;
  });
  return candidates.slice(0, count);
}

/** D6 (widened at fyu.8 for grade-4 aug/dim): exactly 2 well-formed labels,
 *  both computed (not hardcoded) from the same lower pitch — via `spell`, so
 *  a distractor never carries an impossible label for its number. Perfect
 *  numbers (no in-vocabulary quality flip) get the two nearest-number
 *  distractors; major/minor numbers get one quality-flip plus the
 *  nearest-number distractor; augmented/diminished (grade-4 between-any-notes
 *  only) get the "un-altered" perfect flip plus the nearest-number
 *  distractor — the same shape as the major/minor case. `spell` carries the
 *  key-signature spelling for the grade-3 tonic-anchored path, or is the
 *  identity function for grade-4's key_sig-less natural-pitch path. */
function buildQualityDistractors(
  lowerPitch: string,
  lowerDisplay: string,
  spell: (naturalPitch: string) => string,
  number: number,
  quality: IntervalQuality,
): string[] {
  const neighbourLabel = (m: number): string => {
    const upper = spell(naturalPitchStepsAbove(lowerPitch, m - 1));
    return intervalLabel(intervalQuality(lowerDisplay, upper, m), m);
  };

  if (quality === 'perfect') {
    return nearestNumbers(number, 2).map(neighbourLabel);
  }

  if (quality === 'major' || quality === 'minor') {
    const flipped: IntervalQuality = quality === 'major' ? 'minor' : 'major';
    const [nearest] = nearestNumbers(number, 1);
    return [intervalLabel(flipped, number), neighbourLabel(nearest)];
  }

  const [nearest] = nearestNumbers(number, 1);
  return [intervalLabel('perfect', number), neighbourLabel(nearest)];
}

/** Which mistake each number+type distractor represents (rule 5). Derived from
 *  the label rather than threaded out of `buildQualityDistractors`, which keeps
 *  its single job of producing well-formed labels: a label is
 *  "<quality> <ordinal>", so a distractor sharing the answer's ordinal is a
 *  quality error and any other is a counting error.
 *
 *  The counting copy never claims the quality was right, because a neighbouring
 *  number usually carries a different quality too — it corrects the number only,
 *  which is the mistake that is certain. */
function qualityDistractorReasons(canonical: string, distractors: string[]): Record<string, string> {
  const ordinalOf = (label: string): string => label.slice(label.indexOf(' ') + 1);
  const answerOrdinal = ordinalOf(canonical);
  const reasons: Record<string, string> = {};
  for (const label of distractors) {
    reasons[label] =
      ordinalOf(label) === answerOrdinal
        ? `The number is right — it is a ${answerOrdinal}. The size is not: this one is a ${canonical}.`
        : `That is a ${ordinalOf(label)}. Count the letter names from the lower note to the upper note, both ends included, and this interval is a ${answerOrdinal}.`;
  }
  return reasons;
}

function buildNumberAndType(
  rng: () => number,
  scope: GradeScope,
  clef: Clef,
  grade: number,
  idSeed: number,
  atoms: string[],
): ExerciseInstance {
  // Grade 4 (fyu.8): the interval domain opens beyond the tonic. Its own draw
  // sequence, branched BEFORE any tonic-anchored draw below, so grades 1-3
  // (aboveTonicOnly: true) take the untouched byte-identical path.
  if (!scope.intervalRule.aboveTonicOnly) {
    const compound = intervalCompoundTargets(atoms);
    if (compound.length > 0) return buildCompound(rng, scope, clef, grade, idSeed, compound);
    return buildBetweenAnyNotes(rng, scope, clef, grade, idSeed, atoms);
  }

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
  const distractors = buildQualityDistractors(
    lowerPitch,
    lowerDisplay,
    (p) => spellInKeySig(p, keySig),
    number,
    quality,
  );

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
      by_distractor: qualityDistractorReasons(canonical, distractors),
    },
    srs_tags: [intervalTypeAtom(number)],
    kb_version: KB_VERSION,
  };
}

// --- Grade-4 between-any-notes branch (fyu.8) ------------------------------
// Inside a key since chromaticly-mf6. F-A is a major 3rd in C major and a
// MINOR 3rd in D major.

/** Every (lower, upper) natural-pitch pair in `pitches` (ascending, i<j)
 *  spanning exactly `steps` diatonic letter-steps — the pool `pick` draws the
 *  stimulus chord from, so every reachable quality for that NUMBER (including
 *  the lone augmented 4th / diminished 5th / minor-2nd exceptions) stays in
 *  play rather than only ever landing on the majority perfect/major pairs. */
function naturalPitchPairsSpanning(pitches: string[], steps: number): [string, string][] {
  const ordinals = pitches.map(scientificPitchOrdinal);
  const pairs: [string, string][] = [];
  for (let i = 0; i < pitches.length; i++) {
    for (let j = i + 1; j < pitches.length; j++) {
      if (ordinals[j] - ordinals[i] === steps) pairs.push([pitches[i], pitches[j]]);
    }
  }
  return pairs;
}

/** Draw a key from the grade's set and spell a natural pair inside it. */
function drawKeyedPair(
  rng: () => number,
  scope: GradeScope,
  pairs: [string, string][],
): { keySig: string; naturalLower: string; lower: string; upper: string } {
  const keySig = pick(rng, [
    ...scope.keysMajor.map((k) => `${k}_major`),
    ...scope.keysMinor.map((k) => `${k}_minor`),
  ]);
  const [naturalLower, naturalUpper] = pick(rng, pairs);
  return {
    keySig,
    naturalLower,
    lower: spellInKeySig(naturalLower, keySig),
    upper: spellInKeySig(naturalUpper, keySig),
  };
}

/** The atom-named compound numbers (interval_compound:<n>) in `atoms`, in atom
 *  order. Empty when the lesson/due-path names none. */
function intervalCompoundTargets(atoms: string[]): number[] {
  const numbers: number[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'interval_compound' || parts.length !== 1) continue;
    const n = Number(parts[0]);
    if (COMPOUND_NUMBERS.includes(n) && !numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

// --- Grade-5 compound branch (chromaticly-e3z.8) ---------------------------
// "All simple and compound intervals from any note." The same keyed domain as
// the grade-4 branch (chromaticly-mf6), one octave wider.
//
// The distractors are not the grade-4 shape. The mistake this exercise exists
// to catch is answering with the SIMPLE form — calling a 10th a 3rd because the
// octave went uncounted — so that label is always one of the two options, and
// design rule 5 requires the feedback to name it as that mistake rather than
// report a generic wrong answer.
function buildCompound(
  rng: () => number,
  scope: GradeScope,
  clef: Clef,
  grade: number,
  idSeed: number,
  targets: number[],
): ExerciseInstance {
  const pitches = diatonicPitchesInComfortableRange(clef, grade);
  const number = pick(rng, targets);
  const steps = number - 1;
  if (steps > scope.intervalRule.maxOctaves * 7) {
    throw new Error(`interval_naming: number ${number} exceeds maxOctaves for the compound domain`);
  }

  const pairs = naturalPitchPairsSpanning(pitches, steps);
  if (pairs.length === 0) {
    throw new Error(`interval_naming: no natural pitch pair spans a ${number} within range for clef ${clef}`);
  }
  const { keySig, naturalLower, lower, upper } = drawKeyedPair(rng, scope, pairs);

  const quality = intervalQuality(lower, upper, number);
  const canonical = intervalLabel(quality, number);
  const simpleLabel = intervalLabel(quality, simpleEquivalent(number));
  const [neighbour] = nearestNumbers(number, 1, COMPOUND_NUMBERS);
  const neighbourUpper = spellInKeySig(naturalPitchStepsAbove(naturalLower, neighbour - 1), keySig);
  const neighbourLabel = intervalLabel(intervalQuality(lower, neighbourUpper, neighbour), neighbour);

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
        voices: [{ events: [{ type: 'chord', pitches: [lower, upper], dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    // Both names the syllabus accepts, per KB compound_rule. The number form
    // leads because that is what a Grade 5 paper prints.
    answer: { canonical, accepted_alternatives: [compoundAltLabel(quality, number)] },
    distractors: [simpleLabel, neighbourLabel],
    hints: [
      'This interval is wider than an octave. Count the letter names from the lower note to the upper note with both ends included — the number will be more than 8.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect:
        'Not quite — count every letter name from the lower note up to the upper note, including both. An interval wider than an octave keeps its quality but gains 7 to its number.',
      by_distractor: {
        [simpleLabel]: `That is the simple form. The upper note is an octave higher than that, so add 7 to the number: a ${simpleLabel} plus an octave is a ${canonical}.`,
        [neighbourLabel]: `That is a ${neighbourLabel}. Recount the letter names from the lower note to the upper note, including both ends.`,
      },
    },
    srs_tags: [intervalCompoundAtom(number)],
    kb_version: KB_VERSION,
  };
}

function buildBetweenAnyNotes(
  rng: () => number,
  scope: GradeScope,
  clef: Clef,
  grade: number,
  idSeed: number,
  atoms: string[],
): ExerciseInstance {
  // Same comfortable (grade-2) range as the tonic-anchored branch — this
  // exercise tests interval quality, not ledger reading. Already
  // naturals-only (diatonicPitchesInComfortableRange), matching the locked
  // natural-pitch-only domain.
  const pitches = diatonicPitchesInComfortableRange(clef, grade);

  const targets = [...new Set([...intervalTypeTargets(atoms), ...numberTargets(atoms, 'interval_any')])];
  const numberPool = targets.length > 0 ? targets : [2, 3, 4, 5, 6, 7, 8];

  const number = pick(rng, numberPool);
  const steps = number - 1;
  if (steps > scope.intervalRule.maxOctaves * 7) {
    throw new Error(`interval_naming: number ${number} exceeds maxOctaves for the between-any-notes domain`);
  }

  const pairs = naturalPitchPairsSpanning(pitches, steps);
  if (pairs.length === 0) {
    throw new Error(`interval_naming: no natural pitch pair spans a ${number} within range for clef ${clef}`);
  }
  const { keySig, naturalLower, lower, upper } = drawKeyedPair(rng, scope, pairs);

  const quality = intervalQuality(lower, upper, number);
  const canonical = intervalLabel(quality, number);
  const distractors = buildQualityDistractors(naturalLower, lower, (p) => spellInKeySig(p, keySig), number, quality);

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
        voices: [{ events: [{ type: 'chord', pitches: [lower, upper], dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors,
    hints: [
      'Read the key signature first — it may sharpen or flatten one of these notes. Then count the letter names for the number and the semitones for the size.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect:
        'Not quite — recount the letter names for the number, then compare the semitones between the two notes to check major, minor, perfect, augmented, or diminished.',
      by_distractor: qualityDistractorReasons(canonical, distractors),
    },
    srs_tags: [intervalAnyAtom(number)],
    kb_version: KB_VERSION,
  };
}

export const intervalNaming: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));

// --- Grade-5 reduction shape (chromaticly-lgi) -----------------------------
// Naming a compound interval and reducing one to within an octave are separate
// Grade 5 skills, so compound-intervals-5 pairs this with interval_naming.
function buildCompoundReduce(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);
  const targets = intervalCompoundTargets(atoms);
  if (targets.length === 0) {
    throw new Error('interval_compound_reduce: the lesson names no interval_compound atom');
  }

  const number = pick(rng, targets);
  const pairs = naturalPitchPairsSpanning(diatonicPitchesInComfortableRange(clef, grade), number - 1);
  if (pairs.length === 0) {
    throw new Error(`interval_compound_reduce: no natural pair spans a ${number} for clef ${clef}`);
  }
  const { keySig, naturalLower, lower, upper } = drawKeyedPair(rng, scope, pairs);

  const quality = intervalQuality(lower, upper, number);
  const simple = simpleEquivalent(number);
  const canonical = intervalLabel(quality, simple);
  const compoundLabel = intervalLabel(quality, number);
  // The off-by-one: subtracting 8 rather than 7, because a 9th above a note is
  // 8 letter names higher but only 7 steps of reduction.
  const neighbour = simple > 2 ? simple - 1 : simple + 1;
  const neighbourUpper = spellInKeySig(naturalPitchStepsAbove(naturalLower, neighbour - 1), keySig);
  const neighbourLabel = intervalLabel(intervalQuality(lower, neighbourUpper, neighbour), neighbour);

  return {
    id: makeInstanceId('interval_compound_reduce', grade, idSeed),
    template_id: 'interval_compound_reduce',
    grade,
    strand: 'intervals',
    prompt: 'Reduce this interval to within an octave. What is it then?',
    stimulus: {
      music: {
        clef,
        key_sig: keySig,
        time_sig: null,
        voices: [{ events: [{ type: 'chord', pitches: [lower, upper], dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors: [compoundLabel, neighbourLabel],
    hints: [
      'Take an octave off the number — subtract 7, not 8, because both notes are counted. The quality does not change.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: `Subtract 7 from the number and keep the quality: a ${compoundLabel} reduces to a ${canonical}.`,
      by_distractor: {
        [compoundLabel]: `That is the interval as written. Reducing it means taking an octave off, which gives a ${canonical}.`,
        [neighbourLabel]: `That is a ${neighbourLabel}. Take 7 off the number, not 8 — both notes are counted, so a ${compoundLabel} reduces to a ${canonical}.`,
      },
    },
    srs_tags: [intervalCompoundAtom(number)],
    kb_version: KB_VERSION,
  };
}

export const intervalCompoundReduce: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildCompoundReduce(candidateSeed, opts.grade, opts.seed, opts.atoms));

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

/** The atom-named interval numbers (interval_any:<n>) in `atoms`, in atom
 *  order. Empty when the lesson names none. */
function intervalAnyTargets(atoms: string[]): number[] {
  const numbers: number[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'interval_any' || parts.length !== 1) continue;
    const n = Number(parts[0]);
    if (Number.isInteger(n) && n >= 2 && n <= 8 && !numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

/** A key signature already sharpens or flattens the note, so a learner who taps
 *  the slot and no accidental has written the right note. Accept both spellings.
 *
 *  The shape matters: `gradeStaveInput` reads `.pitch` and `.dur` off each
 *  target, so a bare pitch string matches nothing and the alternative is inert. */
function keySpelledAlternatives(pitch: string, dur: string): { pitch: string; dur: string }[] {
  const natural = pitch.replace(/[#b]/g, '');
  return natural === pitch ? [] : [{ pitch: natural, dur }];
}

interface StaveInputParts {
  clef: Clef;
  keySig: string | null;
  lowerDisplay: string;
  targetPitch: string;
  targetDur: string;
  intervalNumber: number;
  keyName: string | null;
  tag: string;
}

function staveInputInstance(grade: number, idSeed: number, parts: StaveInputParts): ExerciseInstance {
  const { clef, keySig, lowerDisplay, targetPitch, targetDur, intervalNumber, keyName, tag } = parts;
  const ask = `Write the note ${article(intervalNumber)} ${ordinal(intervalNumber)} higher than the given note, as a ${targetDur}.`;

  return {
    id: makeInstanceId('interval_naming_stave_input', grade, idSeed),
    template_id: 'interval_naming_stave_input',
    grade,
    strand: 'intervals',
    prompt: keyName ? `This is ${keyName}. ${ask}` : ask,
    stimulus: {
      music: {
        clef,
        key_sig: keySig,
        time_sig: null,
        voices: [{ events: [{ type: 'note', pitch: lowerDisplay, dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'stave_input', config: {} },
    answer: { canonical: { pitch: targetPitch, dur: targetDur }, accepted_alternatives: keySpelledAlternatives(targetPitch, targetDur) },
    distractors: [],
    hints: [
      'Count the letter names from the given note up to the target note, counting both ends — then match the requested duration.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — recount the interval inclusively from the given note, and check you used the requested duration.',
    },
    srs_tags: [tag],
    kb_version: KB_VERSION,
  };
}

/** Tonic-anchored write-the-note, for the lessons whose atoms name a key
 *  (interval_key) or a number (interval_type). `keySigs` and `numbers` are the
 *  atom-scoped pools; either may be the grade's full pool when the atoms are
 *  silent on it. */
function buildAnchoredStaveInput(
  rng: () => number,
  scope: GradeScope,
  clef: Clef,
  grade: number,
  idSeed: number,
  keySigs: string[],
  numbers: number[] | null,
  tagOf: (keySig: string, intervalNumber: number) => string,
): ExerciseInstance {
  const keySig = pick(rng, keySigs);
  const tonic = keySig.split('_')[0];
  const range = comfortablePitchRange(clef, grade);
  const occurrences = diatonicPitchesInComfortableRange(clef, grade).filter((p) => p.startsWith(tonicLetter(tonic)));
  if (occurrences.length === 0) {
    throw new Error(`interval_naming_stave_input: no in-range occurrence of tonic ${tonic} for clef ${clef}`);
  }
  const lowerPitch = occurrences[0];
  const maxSteps = Math.min(7, scientificPitchOrdinal(range.high) - scientificPitchOrdinal(lowerPitch));
  const feasible = (numbers ?? Array.from({ length: 7 }, (_, i) => i + 2)).filter((n) => n - 1 >= 1 && n - 1 <= maxSteps);
  if (feasible.length === 0) {
    throw new Error(`interval_naming_stave_input: no atom-scoped number fits above ${tonic} on the ${clef} stave`);
  }
  const intervalNumber = pick(rng, feasible);
  const targetDur = pick(rng, [...scope.noteValues]);

  return staveInputInstance(grade, idSeed, {
    clef,
    keySig,
    lowerDisplay: spellInKeySig(lowerPitch, keySig),
    targetPitch: spellInKeySig(naturalPitchStepsAbove(lowerPitch, intervalNumber - 1), keySig),
    targetDur,
    intervalNumber,
    keyName: `${tonic} ${keySig.endsWith('_minor') ? 'minor' : 'major'}`,
    tag: tagOf(keySig, intervalNumber),
  });
}

/** Grade-4 write-the-note: no key signature and no tonic anchor, matching the
 *  interval_any domain the mcq shape reads from. */
function buildAnyNotesStaveInput(
  rng: () => number,
  scope: GradeScope,
  clef: Clef,
  grade: number,
  idSeed: number,
  numbers: number[],
): ExerciseInstance {
  const intervalNumber = pick(rng, numbers);
  const pairs = naturalPitchPairsSpanning(diatonicPitchesInComfortableRange(clef, grade), intervalNumber - 1);
  if (pairs.length === 0) {
    throw new Error(`interval_naming_stave_input: no natural pair spans a ${intervalNumber} on the ${clef} stave`);
  }
  const [lower, upper] = pick(rng, pairs);
  const targetDur = pick(rng, [...scope.noteValues]);

  return staveInputInstance(grade, idSeed, {
    clef,
    keySig: null,
    lowerDisplay: lower,
    targetPitch: upper,
    targetDur,
    intervalNumber,
    keyName: null,
    tag: intervalAnyAtom(intervalNumber),
  });
}

function buildStaveInput(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);

  // Each branch reads the lesson's own atom family, so credit lands on the atom
  // the lesson declares. The bare draw below is grade 1's, left byte-identical.
  const keyTargets = intervalKeyTargets(atoms, scope);
  if (keyTargets.length > 0) {
    return buildAnchoredStaveInput(rng, scope, clef, grade, idSeed, keyTargets, null, (keySig) => intervalKeyAtom(keySig));
  }
  const anyTargets = intervalAnyTargets(atoms);
  if (anyTargets.length > 0) {
    return buildAnyNotesStaveInput(rng, scope, clef, grade, idSeed, anyTargets);
  }
  const typeTargets = intervalTypeTargets(atoms);
  if (typeTargets.length > 0) {
    const keySigs = [...scope.keysMajor.map((k) => `${k}_major`), ...scope.keysMinor.map((k) => `${k}_minor`)];
    return buildAnchoredStaveInput(rng, scope, clef, grade, idSeed, keySigs, typeTargets, (_k, n) => intervalTypeAtom(n));
  }

  const key = pick(rng, [...scope.keysMajor]);
  const { lowerPitch, steps, intervalNumber } = sampleInterval(rng, clef, key, grade);
  const targetDur = pick(rng, [...scope.noteValues]);

  return staveInputInstance(grade, idSeed, {
    clef,
    keySig: `${key}_major`,
    lowerDisplay: spellInKey(lowerPitch, key),
    targetPitch: spellInKey(naturalPitchStepsAbove(lowerPitch, steps), key),
    targetDur,
    intervalNumber,
    keyName: null,
    tag: intervalAtom(intervalNumber),
  });
}

export const intervalNamingStaveInput: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildStaveInput(candidateSeed, opts.grade, opts.seed, opts.atoms));
