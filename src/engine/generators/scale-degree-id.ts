// scale_degree_id (Grades 1-3, chromaticly-e3z.3). The syllabus names two
// things in the same breath as key signatures, at every one of the first three
// grades, and the course taught neither. Grade 1, verbatim:
//
//   "Scales and key signatures of the major keys of C, G, D and F in both
//    clefs, with their tonic triads (root position), degrees (number only),
//    and intervals above the tonic (by number only)."
//
// Grades 2 and 3 repeat the phrase over their own wider key sets, so this is
// one generator parameterised by grade, not three.
//
// Two variants, one per requirement, selected by which atom the lesson names.
// They share a generator because the syllabus treats them as one topic: a
// tonic triad IS degrees 1, 3 and 5 stacked, and teaching them apart loses
// exactly the connection that makes the triad memorable.
//
// "Degrees (number only)" is deliberately not degree_name_id, which teaches the
// TECHNICAL names (tonic, supertonic, mediant) and is a separate Grade 4
// requirement. Answering "5th" and answering "dominant" are different facts,
// so they get different atoms.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Clef, Music } from '../../music/types';
import { degreeNumberAtom, parseAtom, TONIC_TRIAD_ATOM, TONIC_TRIAD_MINOR_ATOM } from '../atoms';
import { mulberry32, pick } from '../rng';
import { scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { buildMinorTriad, buildTriad } from './chord-recognition';
import { spellInKey, spellInKeySig, tonicLetter } from './key-spelling';
import { diatonicPitchesInComfortableRange, diatonicPitchesInRange } from '../scope';
import { naturalPitchStepsAbove, parseNaturalPitch } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Treble and bass only. The syllabus says "in both clefs" at Grade 1, and the
 *  C clefs do not exist until Grade 4. */
const DEGREE_CLEFS: readonly Clef[] = ['treble', 'bass'];

export const DEGREE_ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'] as const;

/** Degree numbers named by `degree:<n>` atoms, in atom order. */
function degreeNumbersFromAtoms(atoms: string[]): number[] {
  const numbers: number[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'degree' || parts.length !== 1) continue;
    const n = Number(parts[0]);
    if (Number.isInteger(n) && n >= 1 && n <= 7 && !numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

/** The two nearest degrees to `n` within 1..7, ties preferring the lower —
 *  a miscount is almost always by one, so a distractor two away teaches less. */
function nearestDegrees(n: number, count: number): number[] {
  return [1, 2, 3, 4, 5, 6, 7]
    .filter((m) => m !== n)
    .sort((a, b) => Math.abs(a - n) - Math.abs(b - n) || a - b)
    .slice(0, count);
}

function buildDegree(rng: () => number, grade: number, idSeed: number, numbers: number[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const clef = pick(rng, [...DEGREE_CLEFS]);
  const key = pick(rng, [...scope.keysMajor]);
  const degree = pick(rng, numbers);

  // Anchor on an in-range occurrence of the tonic letter, then step up. The
  // 7th needs six steps of headroom, so a tonic too near the top of the range
  // would put the note off the stave.
  const pitches = diatonicPitchesInComfortableRange(clef, grade);
  const tonicOccurrences = pitches.filter((p) => parseNaturalPitch(p).letter === tonicLetter(key));
  const usable = tonicOccurrences.filter((p) => pitches.includes(naturalPitchStepsAbove(p, 6)));
  if (usable.length === 0) {
    throw new Error(`scale_degree_id: no tonic occurrence of ${key} leaves room for a 7th in ${clef}`);
  }
  const tonic = usable[0];
  const natural = naturalPitchStepsAbove(tonic, degree - 1);
  const pitch = spellInKey(natural, key);

  const canonical = DEGREE_ORDINALS[degree - 1];
  const distractorNumbers = nearestDegrees(degree, 2);
  const music: Music = {
    clef,
    key_sig: `${key}_major`,
    time_sig: null,
    voices: [{ events: [{ type: 'note', pitch, dur: 'semibreve' }] }],
  };

  return {
    id: makeInstanceId('scale_degree_id', grade, idSeed),
    template_id: 'scale_degree_id',
    grade,
    strand: 'scales_keys',
    prompt: `Which degree of the ${key} major scale is this note?`,
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors: distractorNumbers.map((n) => DEGREE_ORDINALS[n - 1]),
    hints: [
      `Start from ${key}, the 1st degree, and count up the letter names to this note. The tonic itself counts as 1.`,
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: `Count up from ${key}, the 1st degree, one letter name at a time. This note is the ${canonical}.`,
      by_distractor: Object.fromEntries(
        distractorNumbers.map((n) => {
          const off = Math.abs(n - degree);
          const names = `${off} letter name${off > 1 ? 's' : ''}`;
          return [
            DEGREE_ORDINALS[n - 1],
            n < degree
              ? `The ${DEGREE_ORDINALS[n - 1]} stops ${names} short of this note. The tonic itself is the 1st degree, so counting from ${key} gives the ${canonical}.`
              : `The ${DEGREE_ORDINALS[n - 1]} is ${names} past this note. Count from ${key} inclusive and stop here: it is the ${canonical}.`,
          ];
        }),
      ),
    },
    srs_tags: [degreeNumberAtom(degree)],
    kb_version: KB_VERSION,
  };
}

function buildTonicTriad(rng: () => number, grade: number, idSeed: number, minor = false): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const clef = pick(rng, [...DEGREE_CLEFS]);
  const mode = minor ? 'minor' : 'major';
  const pool = minor ? scope.keysMinor : scope.keysMajor;
  if (pool.length === 0) throw new Error(`scale_degree_id: grade ${grade} has no ${mode} keys`);
  const key = pick(rng, [...pool]);

  // The stimulus is the key NAME, and the options are the staves. That is the
  // way round design/components/core/AnswerOption.prompt.md describes ("for
  // notation answers, e.g. four key signatures, pass a mini NotationCard") —
  // and it is the way round that cannot be answered by matching the stimulus
  // against the options, because there is nothing on the stimulus to match.
  const staveFor = (numeral: string): Music => ({
    clef,
    key_sig: `${key}_${mode}`,
    time_sig: null,
    voices: [
      {
        events: [
          {
            type: 'chord',
            pitches: minor ? buildMinorTriad(clef, grade, key, numeral) : buildTriad(clef, grade, key, numeral),
            dur: 'semibreve',
          },
        ],
      },
    ],
  });

  // The two wrong triads are the ones built on the neighbouring primary degrees
  // a learner reaches by miscounting, not arbitrary chords. Options are keyed by
  // numeral rather than a positional letter: the label is never displayed for a
  // notation option, so the key exists to address feedback.by_distractor and to
  // be readable in a test — a letter would carry no meaning in either.

  return {
    id: makeInstanceId('scale_degree_id', grade, idSeed),
    template_id: 'scale_degree_id',
    grade,
    strand: 'scales_keys',
    prompt: `Which of these is the tonic triad of ${key} ${mode}?`,
    stimulus: { music: null, text: `${key} ${mode}` },
    interaction: {
      type: 'mcq',
      config: { option_music: { I: staveFor('I'), IV: staveFor('IV'), V: staveFor('V') } },
    },
    answer: { canonical: 'I', accepted_alternatives: [] },
    distractors: ['IV', 'V'],
    hints: [
      `The tonic triad is built on the 1st degree. Find ${key} on the stave, then stack the 3rd and the 5th above it.`,
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: `The tonic triad starts on the 1st degree of the scale, so its lowest note is ${key}.`,
      by_distractor: {
        IV: `That triad is built on the 4th degree, not the 1st. The tonic triad's lowest note is ${key}.`,
        V: `That triad is built on the 5th degree, not the 1st. The tonic triad's lowest note is ${key}.`,
      },
    },
    srs_tags: [minor ? TONIC_TRIAD_MINOR_ATOM : TONIC_TRIAD_ATOM],
    kb_version: KB_VERSION,
  };
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const numbers = degreeNumbersFromAtoms(atoms);
  if (numbers.length > 0) return buildDegree(rng, grade, idSeed, numbers);
  const wants = [TONIC_TRIAD_ATOM, TONIC_TRIAD_MINOR_ATOM].filter((a) => atoms.includes(a));
  if (wants.length === 0) throw new Error('scale_degree_id: needs at least one degree:<n> or tonic_triad atom');
  // Only spend an rng draw when there is a choice, so a major-only lesson keeps
  // the draw sequence it had before the minor atom existed.
  const minor = wants.length === 1 ? wants[0] === TONIC_TRIAD_MINOR_ATOM : pick(rng, wants) === TONIC_TRIAD_MINOR_ATOM;
  return buildTonicTriad(rng, grade, idSeed, minor);
}

export const scaleDegreeId: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));

// Second shapes (chromaticly-lgi). Each reverses its own branch.

function buildDegreeStaveInput(rng: () => number, grade: number, idSeed: number, numbers: number[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const clef = pick(rng, [...DEGREE_CLEFS]);
  const key = pick(rng, [...scope.keysMajor]);
  const degree = pick(rng, numbers);

  const pitches = diatonicPitchesInComfortableRange(clef, grade);
  const tonicOccurrences = pitches.filter((p) => parseNaturalPitch(p).letter === tonicLetter(key));
  const usable = tonicOccurrences.filter((p) => pitches.includes(naturalPitchStepsAbove(p, 6)));
  if (usable.length === 0) {
    throw new Error(`scale_degree_stave_input: no tonic occurrence of ${key} leaves room for a 7th in ${clef}`);
  }
  const natural = naturalPitchStepsAbove(usable[0], degree - 1);
  const pitch = spellInKey(natural, key);
  // The stave input places one accidental, and only from the slot's own letter.
  if (!/^[A-G](#|b)?-?\d+$/.test(pitch) || !diatonicPitchesInRange(clef, grade).includes(natural)) {
    throw new Error(`scale_degree_stave_input: ${pitch} is not placeable on the ${clef} stave at grade ${grade}`);
  }
  const dur = pick(rng, [...scope.noteValues]);
  const ordinal = DEGREE_ORDINALS[degree - 1];
  // A degree is a pitch class: every octave of it is right.
  const alternatives = diatonicPitchesInRange(clef, grade)
    .filter((p) => p[0] === natural[0] && p !== natural)
    .map((p) => ({ pitch: spellInKey(p, key), dur }));

  return {
    id: makeInstanceId('scale_degree_stave_input', grade, idSeed),
    template_id: 'scale_degree_stave_input',
    grade,
    strand: 'scales_keys',
    // No signature is printed, so the accidental is known, not read.
    prompt: `Write the ${ordinal} degree of ${key} major as a ${dur}, with any accidental it needs.`,
    stimulus: { music: null, text: null },
    interaction: { type: 'stave_input', config: { clef } },
    answer: { canonical: { pitch, dur }, accepted_alternatives: alternatives },
    distractors: [],
    hints: [`Find ${tonicLetter(key)} on the stave and count up ${degree - 1}, then ask what ${key} major does to that letter.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — the ${ordinal} degree of ${key} major is ${pitch.replace(/(#|b)/, (a) => (a === '#' ? ' sharp' : ' flat'))}.`,
    },
    srs_tags: [degreeNumberAtom(degree)],
    kb_version: KB_VERSION,
  };
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Which degree of `inKey` a root sits on, or null when it is not in that scale. */
function degreeOfRootIn(root: string, inKey: string, mode: 'major' | 'minor' = 'major'): number | null {
  const natural = root.replace(/[#b]/g, '');
  if (spellInKeySig(natural, `${inKey}_${mode}`) !== root) return null;
  const a = LETTERS.indexOf(natural[0]);
  const b = LETTERS.indexOf(tonicLetter(inKey));
  return ((a - b + 7) % 7) + 1;
}

function noteWords(pitch: string): string {
  return pitch.replace(/\d+$/, '').replace(/#/, ' sharp').replace(/b/, ' flat');
}

// chromaticly-6xs.2. G3 item 3 asks for the tonic triad of every key set for
// the grade, and the lesson built only major ones. A minor tonic triad is drawn
// from keysMinor and built on the natural form, so no raised 7th appears — the
// 7th is not in the chord.
function buildTonicTriadKeyId(rng: () => number, grade: number, idSeed: number, minor = false): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const clef = pick(rng, [...DEGREE_CLEFS]);
  const pool = minor ? scope.keysMinor : scope.keysMajor;
  if (pool.length === 0) throw new Error(`tonic_triad_key_id: grade ${grade} has no ${minor ? 'minor' : 'major'} keys`);
  const mode = minor ? 'minor' : 'major';
  const key = pick(rng, [...pool]);
  const others = pool.filter((k) => k !== key);
  const triad = minor ? buildMinorTriad(clef, grade, key, 'I') : buildTriad(clef, grade, key, 'I');
  const root = triad[0];

  // The keys this chord is the IV or the V of — the misread-the-degree mistake.
  const ranked = [...others].sort((a, b) => {
    const rank = (k: string) => {
      const d = degreeOfRootIn(root, k, mode);
      return d === null ? 2 : [4, 5].includes(d) ? 0 : 1;
    };
    return rank(a) - rank(b) || others.indexOf(a) - others.indexOf(b);
  });
  const chosen = ranked.slice(0, 2);
  const distractors = chosen.map((k) => `${k} ${mode}`);
  if (distractors.length < 2) throw new Error(`tonic_triad_key_id: ${key} has too few sibling keys at grade ${grade}`);

  // No key signature is printed — it would name the key the question asks for.
  const music: Music = {
    clef,
    key_sig: null,
    time_sig: null,
    voices: [{ events: [{ type: 'chord', pitches: triad, dur: 'semibreve' }] }],
  };

  return {
    id: makeInstanceId('tonic_triad_key_id', grade, idSeed),
    template_id: 'tonic_triad_key_id',
    grade,
    strand: 'scales_keys',
    prompt: 'This is a tonic triad. Which key is it in?',
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: `${key} ${mode}`, accepted_alternatives: [] },
    distractors,
    hints: ['A tonic triad is built on the keynote, so the lowest note names the key.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `The lowest note is ${noteWords(root)}, and a tonic triad is built on the keynote — so this is ${key} ${mode}.`,
      by_distractor: Object.fromEntries(
        chosen.map((k) => {
          const d = degreeOfRootIn(root, k, mode);
          return [
            `${k} ${mode}`,
            d === null
              ? `${noteWords(root)} is not in the ${k} ${mode} scale, so no ${k} chord starts on it.`
              : `In ${k} ${mode} this chord is built on the ${DEGREE_ORDINALS[d - 1]} degree, not the 1st.`,
          ];
        }),
      ),
    },
    srs_tags: [minor ? TONIC_TRIAD_MINOR_ATOM : TONIC_TRIAD_ATOM],
    kb_version: KB_VERSION,
  };
}

export const scaleDegreeStaveInput: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => {
    const numbers = degreeNumbersFromAtoms(opts.atoms);
    if (numbers.length === 0) throw new Error('scale_degree_stave_input: needs at least one degree:<n> atom');
    return buildDegreeStaveInput(mulberry32(candidateSeed), opts.grade, opts.seed, numbers);
  });

export const tonicTriadKeyId: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => {
    const wants = [TONIC_TRIAD_ATOM, TONIC_TRIAD_MINOR_ATOM].filter((a) => opts.atoms.includes(a));
    if (wants.length === 0) throw new Error('tonic_triad_key_id: needs the tonic_triad or tonic_triad_minor atom');
    const rng = mulberry32(candidateSeed);
    // Only spend an rng draw when there is a choice: a lesson naming one mode
    // must keep the draw sequence it had before the other mode existed.
    const minor = wants.length === 1 ? wants[0] === TONIC_TRIAD_MINOR_ATOM : pick(rng, wants) === TONIC_TRIAD_MINOR_ATOM;
    return buildTonicTriadKeyId(rng, opts.grade, opts.seed, minor);
  });
