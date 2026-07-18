// Grade 1 key_signature_id generator (curriculum/exercise-templates.json,
// template_id "key_signature_id"). MVP mode: name-the-key. Renders the key
// signature (a single tonic note is enough context to place accidentals on
// the correct lines/spaces for the sampled clef); distractors are the other
// G1 major keys — a defensible, diagnostic pool given G1's four-key scope.
//
// Notation-answer MCQ (U4/AD5): answer.canonical stays the semantic key id
// ("G major") so grading is a plain string deep-equal — it never compares a
// Music object. Each option's rendered stave lives separately, in
// interaction.config.option_music (keyed by that same semantic string), which
// grading.ts's assembleOptions reads to attach a render-only `music` field to
// the option without touching `value`/grading.

import type { Music, Clef } from '../../music/types';
import { KB_VERSION } from '../../content/knowledge-base';
import { keySigAtom, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, scopeForGrade } from '../scope';
import { spellInKey, tonicLetter } from './key-spelling';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** The lesson's `key_sig:*` atoms as bare major-key tonics, e.g.
 *  key_sig:C_major → "C". The atom is the scope: G1 is major-only, and a
 *  name-the-key MCQ needs at least one distractor, so fewer than two keys is a
 *  data bug rather than a silent grade-wide fallback. */
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
  // Match the tonic's natural LETTER (the enumeration is naturals-only), then
  // spell it in the key so a flat/sharp tonic (Bb, Eb) renders under its key
  // signature rather than as a stray natural — and never fails to match.
  const candidates = diatonicPitchesInRange(clef, grade).filter((p) => p.startsWith(tonicLetter(key)));
  if (candidates.length === 0) throw new Error(`no in-range tonic ${key} for clef ${clef}`);
  return spellInKey(candidates[0], key);
}

/** The rendered stave for one key-signature option: the same one-tonic-note
 *  shape as the stimulus, on the sampled clef, so the only visual difference
 *  between options is the key signature itself. */
function keyOptionMusic(clef: Clef, key: string, grade: number): Music {
  return {
    clef,
    key_sig: `${key}_major`,
    time_sig: null,
    voices: [{ events: [{ type: 'note', pitch: tonicPitchInRange(clef, key, grade), dur: 'semibreve' }] }],
  };
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const keys = keysFromAtoms(atoms);
  const clef = pick(rng, [...scope.clefs]);
  const key = pick(rng, keys);
  const tonicPitch = tonicPitchInRange(clef, key, grade);
  const distractorKeys = keys.filter((k) => k !== key);

  const optionMusic: Record<string, Music> = {};
  for (const k of [key, ...distractorKeys]) {
    optionMusic[`${k} major`] = keyOptionMusic(clef, k, grade);
  }

  return {
    id: makeInstanceId('key_signature_id', grade, idSeed),
    template_id: 'key_signature_id',
    grade,
    strand: 'scales_keys',
    prompt: 'Name this key.',
    stimulus: {
      music: {
        clef,
        key_sig: `${key}_major`,
        time_sig: null,
        voices: [{ events: [{ type: 'note', pitch: tonicPitch, dur: 'semibreve' }] }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: { option_music: optionMusic } },
    answer: { canonical: `${key} major`, accepted_alternatives: [] },
    distractors: distractorKeys.map((k) => `${k} major`),
    hints: ['Count the sharps or flats on the stave and match them to a key you know.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — recount the sharps or flats and their order on the stave.',
    },
    srs_tags: [keySigAtom(`${key}_major`)],
    kb_version: KB_VERSION,
  };
}

export const keySignatureId: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
