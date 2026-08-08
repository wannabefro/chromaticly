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
import {
  CHORD_NUMERALS,
  CHORD_NUMERALS_G5,
  CHORD_NUMERALS_MINOR,
  CHORD_POSITIONS,
  chordAtom,
  chordMinorAtom,
  chordMinorPositionAtom,
  chordPositionAtom,
  parseAtom,
} from '../atoms';
import { mulberry32, pick } from '../rng';
import { comfortablePitchRange, diatonicPitchesInComfortableRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import type { Clef, Music } from '../../music/types';
import { spellInKey, spellInKeySig, tonicLetter } from './key-spelling';
import { shiftAccidental } from './minor-keys';
import { naturalPitchStepsAbove, parseNaturalPitch, scientificPitchOrdinal } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Only treble/bass are used for chord recognition (per the spec's "treble;
 *  you may also use bass") — alto reading is a separate, unrelated skill. */
const CHORD_CLEFS: readonly Clef[] = ['treble', 'bass'];

/** Diatonic (letter-name) steps above the tonic for each triad's root: I is the
 *  tonic itself, II the supertonic (1 step up), IV the subdominant (3), V the
 *  dominant (4). Fixed music theory — exported so validator.ts's
 *  chordRecognitionHook can independently recompute the numeral from a stimulus
 *  chord's root letter, never trusting the generator's own pick. II is used only
 *  by the Grade-5 inversions path (chromaticly-ehp); Grade 4 never generates a
 *  degree-1 root, so its recompute set is effectively unchanged. */
export const CHORD_DEGREE_STEPS: Record<string, number> = { I: 0, II: 1, IV: 3, V: 4 };

/** The quality each Grade-5 numeral takes in each mode. */
export const TRIAD_QUALITY: Record<'major' | 'minor', Record<string, 'major' | 'minor' | 'diminished'>> = {
  major: { I: 'major', II: 'minor', IV: 'major', V: 'major' },
  minor: { I: 'minor', II: 'diminished', IV: 'minor', V: 'major' },
};

/** Reposition a root-position triad [root, third, fifth] (ascending, root
 *  lowest) into the given inversion, raising wrapped members an octave so the
 *  voicing stays ascending with the correct chord member in the bass:
 *    a = root position     → [root, third, fifth]
 *    b = 1st inversion     → [third, fifth, root↑8]   (3rd in bass)
 *    c = 2nd inversion     → [fifth, root↑8, third↑8] (5th in bass)
 *  Octave-raise preserves any key-signature accidental (naturalPitchStepsAbove
 *  would strip it), so it only bumps the trailing octave digit. */
export function raiseOctave(pitch: string): string {
  return pitch.replace(/(-?\d+)$/, (m) => String(Number(m) + 1));
}

function applyInversion(triad: [string, string, string], position: string): [string, string, string] {
  const [root, third, fifth] = triad;
  switch (position) {
    case 'a':
      return [root, third, fifth];
    case 'b':
      return [third, fifth, raiseOctave(root)];
    case 'c':
      return [fifth, raiseOctave(root), raiseOctave(third)];
    default:
      throw new Error(`chord_recognition: unknown inversion position "${position}"`);
  }
}

/** The mode belongs to the pair, not the pool (chromaticly-9kx). */
export interface InversionPair {
  numeral: string;
  position: string;
  mode: 'major' | 'minor';
}

/** The (numeral, position) pairs named by `chord:<numeral>:<pos>` atoms, in atom
 *  order, deduplicated. Presence of any such 3-part atom is what selects the
 *  Grade-5 inversions path over the Grade-4 root-position path. */
function inversionPairsFromAtoms(atoms: string[]): InversionPair[] {
  const pairs: InversionPair[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'chord' || parts.length < 2) continue;
    const [numeral, position] = parts;
    if (!(CHORD_NUMERALS_G5 as readonly string[]).includes(numeral)) {
      throw new Error(`chord_recognition: atom "${atom}" names an unknown chord numeral`);
    }
    if (!(CHORD_POSITIONS as readonly string[]).includes(position)) {
      throw new Error(`chord_recognition: atom "${atom}" names an unknown chord position`);
    }
    if (!pairs.some((p) => p.numeral === numeral && p.position === position)) {
      pairs.push({ numeral, position, mode: 'major' });
    }
  }
  return pairs;
}

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
 *  convention other generators use for non-reading-subject notation). Exported
 *  for reuse by satb-voice-recognition.ts (G5-1), which calls it once per
 *  staff to place its own root-position triad, alongside raiseOctave above. */
export function buildTriad(
  clef: Clef,
  grade: number,
  key: string,
  numeral: string,
  minSpan = 4,
): [string, string, string] {
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
  // minSpan is the diatonic room the voicing needs above the root: 4 (the 5th)
  // for a root-position triad; 9 for a 2nd-inversion voicing (third raised an
  // octave = root+9). Grade 4 always passes the default 4, so its root choice —
  // and output — is unchanged.
  const fittingRoots = rootCandidates.filter((p) => highOrdinal - scientificPitchOrdinal(p) >= minSpan);
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

/** The `chord_minor:<numeral>` atoms in `atoms`, deduplicated in atom order.
 *  Their presence is what gates the minor-key path, exactly as the 3-part
 *  position atom gates inversions. */
function minorNumeralsFromAtoms(atoms: string[]): string[] {
  const numerals: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'chord_minor' || parts.length !== 1) continue;
    if (!(CHORD_NUMERALS_MINOR as readonly string[]).includes(parts[0])) continue;
    if (!numerals.includes(parts[0])) numerals.push(parts[0]);
  }
  return numerals;
}

/** The `chord_minor:<numeral>:<pos>` pairs — the minor inversions path. */
function minorInversionPairsFromAtoms(atoms: string[]): InversionPair[] {
  const pairs: InversionPair[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'chord_minor' || parts.length !== 2) continue;
    const [numeral, position] = parts;
    if (!(CHORD_NUMERALS_G5 as readonly string[]).includes(numeral)) {
      throw new Error(`chord_recognition: atom "${atom}" names an unknown chord numeral`);
    }
    if (!(CHORD_POSITIONS as readonly string[]).includes(position)) {
      throw new Error(`chord_recognition: atom "${atom}" names an unknown chord position`);
    }
    if (!pairs.some((p) => p.numeral === numeral && p.position === position)) {
      pairs.push({ numeral, position, mode: 'minor' });
    }
  }
  return pairs;
}

/** Root-position triad on the 1st, 4th or 5th degree of a MINOR key, spelled
 *  under that key's signature — which spells the NATURAL form.
 *
 *  i and iv take the signature unchanged and come out minor. V does not: its
 *  third IS the 7th degree, and the harmonic form raises it, which is the whole
 *  reason V is major in a minor key and can act as a dominant. Raising it here
 *  rather than in the key signature is also how it is written on the page — the
 *  accidental appears against the note (chromaticly-7xv, G4 item 4, which says
 *  "the harmonic form of the scale will be used in minor keys"). */
export function buildMinorTriad(
  clef: Clef,
  grade: number,
  tonic: string,
  numeral: string,
  minSpan = 4,
): [string, string, string] {
  const keySig = `${tonic}_minor`;
  const range = comfortablePitchRange(clef, grade);
  const tonicOccurrences = diatonicPitchesInComfortableRange(clef, grade).filter((p) => p.startsWith(tonic[0]));
  if (tonicOccurrences.length === 0) {
    throw new Error(`chord_recognition: no in-range occurrence of tonic ${tonic} for clef ${clef}`);
  }

  const rootLetter = parseNaturalPitch(
    naturalPitchStepsAbove(tonicOccurrences[0], CHORD_DEGREE_STEPS[numeral]),
  ).letter;
  const fittingRoots = diatonicPitchesInComfortableRange(clef, grade)
    .filter((p) => parseNaturalPitch(p).letter === rootLetter)
    .filter((p) => scientificPitchOrdinal(range.high) - scientificPitchOrdinal(p) >= minSpan);
  if (fittingRoots.length === 0) {
    throw new Error(
      `chord_recognition: no root occurrence of ${rootLetter} leaves room for a triad within range for clef ${clef}`,
    );
  }

  const rootNatural = fittingRoots[0];
  const root = spellInKeySig(rootNatural, keySig);
  const third = spellInKeySig(naturalPitchStepsAbove(rootNatural, 2), keySig);
  const fifth = spellInKeySig(naturalPitchStepsAbove(rootNatural, 4), keySig);

  return numeral === 'V' ? [root, shiftAccidental(third, 1), fifth] : [root, third, fifth];
}

function buildMinorKey(
  contentSeed: number,
  grade: number,
  idSeed: number,
  numerals: string[],
): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...CHORD_CLEFS]);
  const tonic = pick(rng, [...scope.keysMinor]);
  const numeral = pick(rng, numerals);

  const triads: Record<string, [string, string, string]> = {};
  for (const n of CHORD_NUMERALS_MINOR) {
    triads[n] = buildMinorTriad(clef, grade, tonic, n);
  }

  const distractors = CHORD_NUMERALS_MINOR.filter((n) => n !== numeral);

  return {
    id: makeInstanceId('chord_recognition', grade, idSeed),
    template_id: 'chord_recognition',
    grade,
    strand: 'chords',
    prompt: `Name this chord (Roman numeral). The key is ${tonic} minor.`,
    stimulus: {
      music: {
        clef,
        key_sig: `${tonic}_minor`,
        time_sig: null,
        voices: [{ events: [{ type: 'chord', pitches: triads[numeral], dur: 'semibreve' }] }],
      },
      text: null,
    },
    // Same component as the major path, so the two read as one skill rather than
    // two, and so the tapped-chip replay has its chord to play.
    interaction: { type: 'roman_numeral_boxes', config: { numerals: [...CHORD_NUMERALS_MINOR], triads } },
    answer: { canonical: numeral, accepted_alternatives: [] },
    distractors: [...distractors],
    hints: [
      'Find the lowest note, then count how far it is above the keynote: the keynote itself is I, three letters up is IV, four is V.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect:
        'Not quite — find the lowest note and count it up from the keynote. I sits on the keynote, IV on the 4th degree, V on the 5th.',
      by_distractor: Object.fromEntries(
        distractors.map((n) => [
          n,
          `${n} is built on the ${n === 'I' ? '1st' : n === 'IV' ? '4th' : '5th'} degree of ${tonic} minor. This chord's lowest note is not there.`,
        ]),
      ),
    },
    srs_tags: [chordMinorAtom(numeral)],
    kb_version: KB_VERSION,
  };
}

/** Grade-5 inversions path (chromaticly-ehp / plan U2): name a triad AND its
 *  position (a/b/c). Selected by 3-part `chord:<numeral>:<pos>` atoms; the
 *  answer is the structured { numeral, position } pair, graded on both axes. */
const NUMERAL_DEGREE: Record<string, string> = { I: '1st', II: '2nd', IV: '4th', V: '5th' };
const POSITION_BASS: Record<string, string> = { a: 'the root', b: 'the 3rd', c: 'the 5th' };

/** The two-axis pick is diagnosed on whichever axis is wrong. */
function whyWrongPair(
  wrong: { numeral: string; position: string },
  right: { numeral: string; position: string },
): string {
  if (wrong.numeral === right.numeral) {
    return `The chord is right. ${wrong.numeral}${wrong.position} puts ${POSITION_BASS[wrong.position]} in the bass; here the bass note is ${POSITION_BASS[right.position]}.`;
  }
  if (wrong.position === right.position) {
    return `The position is right. ${wrong.numeral} is built on the ${NUMERAL_DEGREE[wrong.numeral]} degree; this root is the ${NUMERAL_DEGREE[right.numeral]}.`;
  }
  return `${wrong.numeral}${wrong.position} is the ${NUMERAL_DEGREE[wrong.numeral]}-degree chord with ${POSITION_BASS[wrong.position]} in the bass. This one is neither.`;
}

function buildInversion(
  contentSeed: number,
  grade: number,
  idSeed: number,
  pairs: InversionPair[],
): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...CHORD_CLEFS]);
  // Round-robin, as tonal_centre does: a drawn pair leaves the pool part-asked.
  const { numeral, position, mode } = pairs[(idSeed + Math.floor(idSeed / 8)) % pairs.length];
  const key = pick(rng, mode === 'minor' ? [...scope.keysMinor] : [...scope.keysMajor]);

  // Root-position triads for every G5 numeral, built with room for the widest
  // (2nd-inversion) voicing so any of them could be inverted and still fit.
  const triads: Record<string, [string, string, string]> = {};
  for (const n of CHORD_NUMERALS_G5) {
    triads[n] = mode === 'minor' ? buildMinorTriad(clef, grade, key, n, 9) : buildTriad(clef, grade, key, n, 9);
  }

  const stimulusPitches = applyInversion(triads[numeral], position);

  // Distractors are the other (numeral, position) combinations — carried for
  // schema completeness; the two-axis component renders its own numeral/position
  // grids and grades on the combined { numeral, position } pick (deepEqual).
  const distractors = CHORD_NUMERALS_G5.flatMap((n) =>
    CHORD_POSITIONS.map((p) => ({ numeral: n, position: p })),
  ).filter((c) => !(c.numeral === numeral && c.position === position));

  return {
    id: makeInstanceId('chord_recognition', grade, idSeed),
    template_id: 'chord_recognition',
    grade,
    strand: 'chords',
    prompt: 'Name this chord and its position.',
    stimulus: {
      music: {
        clef,
        key_sig: `${key}_${mode}`,
        time_sig: null,
        voices: [{ events: [{ type: 'chord', pitches: stimulusPitches, dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: {
      type: 'roman_numeral_boxes',
      config: { numerals: [...CHORD_NUMERALS_G5], positions: [...CHORD_POSITIONS], triads },
    },
    answer: { canonical: { numeral, position }, accepted_alternatives: [] },
    distractors,
    hints: [
      'The lowest note (the bass) names the position: root in the bass = a, the 3rd in the bass = b (1st inversion), the 5th in the bass = c (2nd inversion).',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect:
        'Not quite — find the root by stacking the notes in 3rds, then check which member is in the bass: root = a, 3rd = b, 5th = c.',
      by_distractor: Object.fromEntries(
        distractors.map((d) => [`${d.numeral}${d.position}`, whyWrongPair(d, { numeral, position })]),
      ),
    },
    srs_tags: [mode === 'minor' ? chordMinorPositionAtom(numeral, position) : chordPositionAtom(numeral, position)],
    kb_version: KB_VERSION,
  };
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  // One pool, both families. Branching made a mixed pool always minor.
  const inversionPairs = [...minorInversionPairsFromAtoms(atoms), ...inversionPairsFromAtoms(atoms)];
  if (inversionPairs.length > 0) {
    return buildInversion(contentSeed, grade, idSeed, inversionPairs);
  }
  const minorNumerals = minorNumeralsFromAtoms(atoms);
  if (minorNumerals.length > 0) {
    return buildMinorKey(contentSeed, grade, idSeed, minorNumerals);
  }

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
      by_distractor: Object.fromEntries(
        distractors.map((n) => [n, `${n} is built on the ${NUMERAL_DEGREE[n]} degree of ${key} major: ${triads[n].join(', ')}.`]),
      ),
    },
    srs_tags: [chordAtom(numeral)],
    kb_version: KB_VERSION,
  };
}

export const chordRecognition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));

// Second shape (chromaticly-lgi): the chord is named and its stave chosen.

function buildFromNameInversion(
  rng: () => number,
  grade: number,
  idSeed: number,
  pairs: { numeral: string; position: string }[],
): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const clef = pick(rng, [...CHORD_CLEFS]);
  const key = pick(rng, [...scope.keysMajor]);
  const { numeral, position } = pick(rng, pairs);
  const triad = buildTriad(clef, grade, key, numeral, 9);

  // The same chord in its other two positions: the question is the inversion.
  const others = CHORD_POSITIONS.filter((p) => p !== position);
  const staveFor = (p: string): Music => ({
    clef,
    key_sig: `${key}_major`,
    time_sig: null,
    voices: [{ events: [{ type: 'chord', pitches: applyInversion(triad, p), dur: 'semibreve' }] }],
  });
  const optionMusic: Record<string, Music> = { [position]: staveFor(position) };
  for (const p of others) optionMusic[p] = staveFor(p);

  return {
    id: makeInstanceId('chord_from_name', grade, idSeed),
    template_id: 'chord_from_name',
    grade,
    strand: 'chords',
    prompt: `Which of these is ${numeral}${position} in ${key} major?`,
    stimulus: { music: null, text: `${numeral}${position}` },
    interaction: { type: 'mcq', config: { option_music: optionMusic } },
    answer: { canonical: position, accepted_alternatives: [] },
    distractors: [...others],
    hints: ['The letter names the bass note: a = the root, b = the 3rd, c = the 5th.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `${numeral}${position} puts ${POSITION_BASS[position]} of the chord in the bass.`,
      by_distractor: Object.fromEntries(
        others.map((p) => [p, `That stave has ${POSITION_BASS[p]} in the bass, which is ${numeral}${p}.`]),
      ),
    },
    srs_tags: [chordPositionAtom(numeral, position)],
    kb_version: KB_VERSION,
  };
}

function buildFromName(rng: () => number, grade: number, idSeed: number, numerals: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const clef = pick(rng, [...CHORD_CLEFS]);
  const key = pick(rng, [...scope.keysMajor]);
  const numeral = pick(rng, numerals);
  const others = CHORD_NUMERALS.filter((n) => n !== numeral);

  const staveFor = (n: string): Music => ({
    clef,
    key_sig: `${key}_major`,
    time_sig: null,
    voices: [{ events: [{ type: 'chord', pitches: buildTriad(clef, grade, key, n), dur: 'semibreve' }] }],
  });
  const optionMusic: Record<string, Music> = { [numeral]: staveFor(numeral) };
  for (const n of others) optionMusic[n] = staveFor(n);

  return {
    id: makeInstanceId('chord_from_name', grade, idSeed),
    template_id: 'chord_from_name',
    grade,
    strand: 'chords',
    prompt: `Which of these is chord ${numeral} in ${key} major?`,
    stimulus: { music: null, text: `${numeral} in ${key} major` },
    interaction: { type: 'mcq', config: { option_music: optionMusic } },
    answer: { canonical: numeral, accepted_alternatives: [] },
    distractors: [...others],
    hints: [`Count up to the ${NUMERAL_DEGREE[numeral]} degree of ${key} major, then stack the 3rd and 5th above it.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `${numeral} is built on the ${NUMERAL_DEGREE[numeral]} degree of ${key} major.`,
      by_distractor: Object.fromEntries(
        others.map((n) => [n, `That chord starts on the ${NUMERAL_DEGREE[n]} degree, so it is ${n}.`]),
      ),
    },
    srs_tags: [chordAtom(numeral)],
    kb_version: KB_VERSION,
  };
}

export const chordFromName: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => {
    const rng = mulberry32(candidateSeed);
    const pairs = inversionPairsFromAtoms(opts.atoms);
    if (pairs.length > 0) return buildFromNameInversion(rng, opts.grade, opts.seed, pairs);
    return buildFromName(rng, opts.grade, opts.seed, numeralsFromAtoms(opts.atoms));
  });
