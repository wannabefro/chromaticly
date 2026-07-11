// Grade 1 key_signature_id generator (curriculum/exercise-templates.json,
// template_id "key_signature_id"). MVP mode: name-the-key. Renders the key
// signature (a single tonic note is enough context to place accidentals on
// the correct lines/spaces for the sampled clef); distractors are the other
// G1 major keys — a defensible, diagnostic pool given G1's four-key scope.

import type { Clef } from '../../music/types';
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

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...G1_CLEFS]);
  const key = pick(rng, [...G1_KEYS_MAJOR]);
  const tonicPitch = tonicPitchInRange(clef, key);
  const distractorKeys = G1_KEYS_MAJOR.filter((k) => k !== key);

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
    interaction: { type: 'mcq', config: {} },
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
