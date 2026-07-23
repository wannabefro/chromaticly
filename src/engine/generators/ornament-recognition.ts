// Grade 4 ornament_recognition generator (fyu.11, ornaments-recognize content) —
// recognition-only: name the ornament sign shown on a single stimulus note.
// trill/turn/upper_mordent/lower_mordent render as an ABC `!name!` decoration;
// acciaccatura/appoggiatura render as a grace note a diatonic step above the
// principal pitch (fixed music theory, not KB-sourced). The Music-model
// representation (Ornament, abc-emitter) is locked — this generator only picks
// WHICH ornament and WHERE.
//
// Mirrors chord-recognition.ts's atom-scoped selection (an `ornament:<kind>`
// atom pins which kind the lesson draws) and its own exported fixed-theory
// data (ORNAMENT_NAMES) for the validator to recompute against.

import type { Clef, OrnamentKind } from '../../music/types';
import { KB_VERSION } from '../../content/knowledge-base';
import { ORNAMENT_KINDS, ornamentAtom, parseAtom } from '../atoms';
import { int, mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange } from '../scope';
import type { ExerciseInstance } from '../schema';
import { naturalPitchStepsAbove } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Only treble/bass are used, mirroring chord-recognition's CHORD_CLEFS. */
const ORNAMENT_CLEFS: readonly Clef[] = ['treble', 'bass'];

const GRACE_KINDS: readonly OrnamentKind[] = ['acciaccatura', 'appoggiatura'];

/** Display names for each ornament kind — fixed music theory, exported so
 *  validator.ts's ornamentRecognitionHook can independently recompute the
 *  canonical/distractor set, never trusting the generator's own picks. */
export const ORNAMENT_NAMES: Record<OrnamentKind, string> = {
  trill: 'Trill',
  turn: 'Turn',
  upper_mordent: 'Upper mordent',
  lower_mordent: 'Lower mordent',
  acciaccatura: 'Acciaccatura',
  appoggiatura: 'Appoggiatura',
};

/** The `ornament:<kind>` atoms in `atoms`, deduplicated in atom order —
 *  mirrors chord-recognition.ts's numeralsFromAtoms. */
function kindsFromAtoms(atoms: string[]): OrnamentKind[] {
  const kinds: OrnamentKind[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'ornament') continue;
    const [ornamentKind] = parts;
    if (!(ORNAMENT_KINDS as readonly string[]).includes(ornamentKind)) {
      throw new Error(`ornament_recognition: atom "${atom}" names an unknown ornament kind`);
    }
    if (!kinds.includes(ornamentKind as OrnamentKind)) kinds.push(ornamentKind as OrnamentKind);
  }
  if (kinds.length === 0) {
    throw new Error('ornament_recognition: needs at least one ornament:* atom');
  }
  return kinds;
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
  const clef = pick(rng, [...ORNAMENT_CLEFS]);
  const kind = pick(rng, kindsFromAtoms(atoms));

  // A natural pitch not at the very top of the comfortable range, so a grace
  // note a diatonic step above still fits comfortably on the stave.
  const candidates = diatonicPitchesInComfortableRange(clef, grade);
  const principal = pick(rng, candidates.slice(0, -1));

  const isGrace = (GRACE_KINDS as readonly string[]).includes(kind);
  const gracePitch = isGrace ? naturalPitchStepsAbove(principal, 1) : undefined;

  const otherNames = (ORNAMENT_KINDS as readonly OrnamentKind[]).filter((k) => k !== kind).map((k) => ORNAMENT_NAMES[k]);
  const distractors = sampleDistinct(rng, otherNames, 2);

  return {
    id: makeInstanceId('ornament_recognition', grade, idSeed),
    template_id: 'ornament_recognition',
    grade,
    strand: 'terms_signs',
    prompt: 'Name this ornament.',
    stimulus: {
      music: {
        clef,
        key_sig: null,
        time_sig: null,
        voices: [
          {
            events: [
              {
                type: 'note',
                pitch: principal,
                dur: 'semibreve',
                ornament: gracePitch !== undefined ? { kind, pitch: gracePitch } : { kind },
              },
            ],
          },
        ],
      },
      text: null,
    },
    interaction: {
      type: 'mcq',
      config: { ornament: kind },
    },
    answer: { canonical: ORNAMENT_NAMES[kind], accepted_alternatives: [] },
    distractors,
    hints: [
      'Trill and turn are printed above the note; mordents flick quickly to a neighbour note and back; acciaccatura and appoggiatura are small grace notes played just before it.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — check whether the sign sits above the note or is a small grace note before it, then look at its shape.',
    },
    srs_tags: [ornamentAtom(kind)],
    kb_version: KB_VERSION,
  };
}

export const ornamentRecognition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
