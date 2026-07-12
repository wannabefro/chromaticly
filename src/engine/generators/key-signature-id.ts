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
import { keySigAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, G1_CLEFS, G1_KEYS_MAJOR } from '../scope';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

function tonicPitchInRange(clef: Clef, key: string): string {
  const candidates = diatonicPitchesInRange(clef).filter((p) => p.startsWith(key));
  if (candidates.length === 0) throw new Error(`no in-range tonic ${key} for clef ${clef}`);
  return candidates[0];
}

/** The rendered stave for one key-signature option: the same one-tonic-note
 *  shape as the stimulus, on the sampled clef, so the only visual difference
 *  between options is the key signature itself. */
function keyOptionMusic(clef: Clef, key: string): Music {
  return {
    clef,
    key_sig: `${key}_major`,
    time_sig: null,
    voices: [{ events: [{ type: 'note', pitch: tonicPitchInRange(clef, key), dur: 'semibreve' }] }],
  };
}

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...G1_CLEFS]);
  const key = pick(rng, [...G1_KEYS_MAJOR]);
  const tonicPitch = tonicPitchInRange(clef, key);
  const distractorKeys = G1_KEYS_MAJOR.filter((k) => k !== key);

  const optionMusic: Record<string, Music> = {};
  for (const k of [key, ...distractorKeys]) {
    optionMusic[`${k} major`] = keyOptionMusic(clef, k);
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
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed));
