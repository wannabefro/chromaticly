// key_signature_id generator, two directions. `name` renders the signature and
// offers key names as text. `choose` names the key and offers staves.
// Before chromaticly-e3z.18 the signature was in the stimulus AND every option.
// No key name reached the screen, so the learner matched staves.

import type { Music, Clef } from '../../music/types';
import { KB_VERSION } from '../../content/knowledge-base';
import { keyAccidentals } from '../../music/abc-emitter';
import { keySigAtom, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, scopeForGrade } from '../scope';
import { spellInKey, tonicLetter } from './key-spelling';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Bare major tonics from the atoms. Fewer than two is a data bug. */
function keysFromAtoms(atoms: string[]): string[] {
  const keys: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'key_sig') continue;
    const [tonic, mode] = parts[0].split('_');
    if (mode !== 'major') throw new Error(`key_signature_id: non-major key "${parts[0]}" outside G1`);
    if (!keys.includes(tonic)) keys.push(tonic);
  }
  if (keys.length < 2) {
    throw new Error('key_signature_id: needs at least two key_sig:* atoms for a closed-item MCQ');
  }
  return keys;
}

function tonicPitchInRange(clef: Clef, key: string, grade: number): string {
  // Spelled in the key, so a flat tonic sits under its signature.
  const candidates = diatonicPitchesInRange(clef, grade).filter((p) => p.startsWith(tonicLetter(key)));
  if (candidates.length === 0) throw new Error(`no in-range tonic ${key} for clef ${clef}`);
  return spellInKey(candidates[0], key);
}

/** One tonic semibreve — enough context to place the accidentals for a clef. */
function keyMusic(clef: Clef, key: string, grade: number): Music {
  return {
    clef,
    key_sig: `${key}_major`,
    time_sig: null,
    voices: [{ events: [{ type: 'note', pitch: tonicPitchInRange(clef, key, grade), dur: 'semibreve' }] }],
  };
}

/** "no sharps or flats", "two flats" — the count a learner reads off the stave. */
function accidentalPhrase(key: string): string {
  const map = keyAccidentals(`${key}_major`);
  const letters = Object.keys(map);
  if (letters.length === 0) return 'no sharps or flats';
  const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
  const kind = map[letters[0]] === 'sharp' ? 'sharp' : 'flat';
  return `${words[letters.length]} ${kind}${letters.length === 1 ? '' : 's'}`;
}

function whyWrong(wrongKey: string, key: string): string {
  return `${wrongKey} major has ${accidentalPhrase(wrongKey)}. This signature has ${accidentalPhrase(key)}, which is ${key} major.`;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const keys = keysFromAtoms(atoms);
  const clef = pick(rng, [...scope.clefs]);
  const key = pick(rng, keys);
  const distractorKeys = keys.filter((k) => k !== key);
  const variant = pick(rng, ['name', 'choose'] as const);

  const common = {
    id: makeInstanceId('key_signature_id', grade, idSeed),
    template_id: 'key_signature_id' as const,
    grade,
    strand: 'scales_keys' as const,
    answer: { canonical: `${key} major`, accepted_alternatives: [] },
    distractors: distractorKeys.map((k) => `${k} major`),
    feedback: {
      correct: 'Correct!',
      incorrect: `Count the sharps or flats and their order on the stave: ${accidentalPhrase(key)} is ${key} major.`,
      by_distractor: Object.fromEntries(distractorKeys.map((k) => [`${k} major`, whyWrong(k, key)])),
    },
    srs_tags: [keySigAtom(`${key}_major`)],
    kb_version: KB_VERSION,
  };

  if (variant === 'name') {
    return {
      ...common,
      prompt: 'Name this key.',
      stimulus: { music: keyMusic(clef, key, grade), text: null },
      interaction: { type: 'mcq', config: {} },
      hints: ['Count the sharps or flats on the stave and match them to a key you know.'],
    };
  }

  const optionMusic: Record<string, Music> = {};
  for (const k of [key, ...distractorKeys]) {
    optionMusic[`${k} major`] = keyMusic(clef, k, grade);
  }
  return {
    ...common,
    prompt: `Which of these is the key signature of ${key} major?`,
    stimulus: { music: null, text: `${key} major` },
    interaction: { type: 'mcq', config: { option_music: optionMusic } },
    hints: [`Work out how many sharps or flats ${key} major needs, then count the accidentals on each stave.`],
  };
}

export const keySignatureId: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
