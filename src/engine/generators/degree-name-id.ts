// Grade 4 degree_name_id generator (fyu.4) — text-only MCQ naming/identifying
// the 7 technical scale-degree names. Two directions, seed-picked: name -> the
// ordinal degree it sits on, and ordinal -> the technical name for that
// degree. Stimulus carries no notation (a bare degree-name fact has nothing
// to notate, same rationale as mode_swap's text-only stimulus).

import { KB_VERSION } from '../../content/knowledge-base';
import { degreeNameAtom, parseAtom } from '../atoms';
import { int, mulberry32, pick } from '../rng';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

export const DEGREE_ORDER = [
  'tonic',
  'supertonic',
  'mediant',
  'subdominant',
  'dominant',
  'submediant',
  'leading_note',
] as const;

export type DegreeName = (typeof DEGREE_ORDER)[number];

export const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'] as const;

export const DISPLAY_NAMES: Record<DegreeName, string> = {
  tonic: 'tonic',
  supertonic: 'supertonic',
  mediant: 'mediant',
  subdominant: 'subdominant',
  dominant: 'dominant',
  submediant: 'submediant',
  leading_note: 'leading note',
};

export function ordinalOf(name: DegreeName): string {
  return ORDINALS[DEGREE_ORDER.indexOf(name)];
}

export function nameFromDisplay(display: string): DegreeName | undefined {
  return DEGREE_ORDER.find((n) => DISPLAY_NAMES[n] === display);
}

export function nameFromOrdinal(ordinal: string): DegreeName | undefined {
  const i = ORDINALS.indexOf(ordinal as (typeof ORDINALS)[number]);
  return i === -1 ? undefined : DEGREE_ORDER[i];
}

type Direction = 'name_to_ordinal' | 'ordinal_to_name';

/** The lesson's `degree_name:*` atoms as degree names, e.g.
 *  degree_name:dominant -> "dominant". */
function namesFromAtoms(atoms: string[]): DegreeName[] {
  const names: DegreeName[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'degree_name') continue;
    const [name] = parts;
    if (!(DEGREE_ORDER as readonly string[]).includes(name)) {
      throw new Error(`degree_name_id: atom "${atom}" names an unknown degree`);
    }
    const degreeName = name as DegreeName;
    if (!names.includes(degreeName)) names.push(degreeName);
  }
  if (names.length === 0) {
    throw new Error('degree_name_id: needs at least one degree_name:* atom');
  }
  return names;
}

function sampleDistinct<T>(rng: () => number, items: T[], n: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = int(rng, 0, pool.length - 1);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const name = pick(rng, namesFromAtoms(atoms));
  const direction = pick<Direction>(rng, ['name_to_ordinal', 'ordinal_to_name']);

  const ordinal = ordinalOf(name);
  const displayName = DISPLAY_NAMES[name];

  let prompt: string;
  let stimulusText: string;
  let canonical: string;
  let distractors: string[];
  let feedbackIncorrect: string;
  let whyWrong: Record<string, string>;

  if (direction === 'name_to_ordinal') {
    prompt = `Which degree of a scale is the ${displayName}?`;
    stimulusText = `Degree of the ${displayName}`;
    canonical = ordinal;
    const otherOrdinals = ORDINALS.filter((o) => o !== ordinal);
    distractors = sampleDistinct(rng, otherOrdinals, 2);
    feedbackIncorrect = `The ${displayName} is the ${ordinal} degree of the scale.`;
    // Name and ordinal are a bijection, so each wrong ordinal has its own name.
    whyWrong = Object.fromEntries(
      distractors.map((o) => [o, `The ${o} degree is the ${DISPLAY_NAMES[nameFromOrdinal(o)!]}.`]),
    );
  } else {
    prompt = `What is the technical name for the ${ordinal} degree of a scale?`;
    stimulusText = `Name of the ${ordinal} degree`;
    canonical = displayName;
    const otherNames = DEGREE_ORDER.filter((n) => n !== name).map((n) => DISPLAY_NAMES[n]);
    distractors = sampleDistinct(rng, otherNames, 2);
    feedbackIncorrect = `The ${ordinal} degree of the scale is called the ${displayName}.`;
    whyWrong = Object.fromEntries(
      distractors.map((d) => [d, `The ${d} is the ${ordinalOf(nameFromDisplay(d)!)} degree.`]),
    );
  }

  return {
    id: makeInstanceId('degree_name_id', grade, idSeed),
    template_id: 'degree_name_id',
    grade,
    strand: 'scales_keys',
    prompt,
    stimulus: { music: null, text: stimulusText },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors,
    hints: ['The 7 scale degrees each have a technical name, from tonic (1st) to leading note (7th).'],
    feedback: {
      correct: 'Correct!',
      incorrect: feedbackIncorrect,
      by_distractor: whyWrong,
    },
    srs_tags: [degreeNameAtom(name)],
    kb_version: KB_VERSION,
  };
}

export const degreeNameId: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
