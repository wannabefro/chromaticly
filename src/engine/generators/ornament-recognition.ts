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

import type { Clef, Duration, NoteEvent, OrnamentKind } from '../../music/types';
import { KB_VERSION } from '../../content/knowledge-base';
import { ORNAMENT_KINDS, ORNAMENT_WRITTEN_TO_SIGN, ornamentAtom, parseAtom } from '../atoms';
import { int, mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange } from '../scope';
import type { ExerciseInstance } from '../schema';
import { naturalPitchStepsAbove } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Only treble/bass are used, mirroring chord-recognition's CHORD_CLEFS. */
const ORNAMENT_CLEFS: readonly Clef[] = ['treble', 'bass'];

const GRACE_KINDS: readonly OrnamentKind[] = ['acciaccatura', 'appoggiatura'];

export type OrnamentDirection = 'sign_to_name' | 'written_to_sign';

/** The fixed written-out realization of each ornament as ordinary notes (G5-5,
 *  chromaticly-cke) — the syllabus expansion, pinned so generator, validator, and
 *  the ornament-recognition test all agree (the plan's "canonical realization
 *  rules"). Neighbours are diatonic natural-letter steps (the stimulus carries no
 *  key signature, exactly like the Grade-4 sign->name stimulus). Decoration
 *  ornaments alternate the principal with a neighbour; grace kinds are the grace
 *  note resolving into the principal, rendered distinctly (a crushed semiquaver
 *  for the acciaccatura vs an on-beat half-value crotchet for the appoggiatura). */
export function realizeOrnament(kind: OrnamentKind, principal: string): NoteEvent[] {
  const upper = naturalPitchStepsAbove(principal, 1);
  const lower = naturalPitchStepsAbove(principal, -1);
  const note = (pitch: string, dur: Duration): NoteEvent => ({ type: 'note', pitch, dur });
  switch (kind) {
    case 'turn':
      // principal -> upper -> principal -> lower -> principal
      return [principal, upper, principal, lower, principal].map((p) => note(p, 'quaver'));
    case 'upper_mordent':
      return [principal, upper, principal].map((p) => note(p, 'quaver'));
    case 'lower_mordent':
      return [principal, lower, principal].map((p) => note(p, 'quaver'));
    case 'trill':
      // a short measured alternation with the upper neighbour, beginning on the principal
      return [principal, upper, principal, upper, principal, upper].map((p) => note(p, 'quaver'));
    case 'acciaccatura':
      // the crushed grace (very short) resolving into the principal
      return [note(upper, 'semiquaver'), note(principal, 'minim')];
    case 'appoggiatura':
      // the on-beat grace takes half the principal's value, then resolves
      return [note(upper, 'crotchet'), note(principal, 'crotchet')];
  }
}

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

/** The `ornament:<kind>[:written_to_sign]` atoms in `atoms`, deduplicated in atom
 *  order, with their shared direction — mirrors chord-recognition.ts's
 *  numeralsFromAtoms. All atoms in one lesson share a direction (the 3-part
 *  suffix gates the Grade-5 written->sign reverse; bare 2-part is sign->name);
 *  a mixed lesson is a defect and fails loud. */
function parseOrnamentAtoms(atoms: string[]): { kinds: OrnamentKind[]; direction: OrnamentDirection } {
  const kinds: OrnamentKind[] = [];
  const directions = new Set<OrnamentDirection>();
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'ornament') continue;
    const [ornamentKind, suffix] = parts;
    if (!(ORNAMENT_KINDS as readonly string[]).includes(ornamentKind)) {
      throw new Error(`ornament_recognition: atom "${atom}" names an unknown ornament kind`);
    }
    if (suffix !== undefined && suffix !== ORNAMENT_WRITTEN_TO_SIGN) {
      throw new Error(`ornament_recognition: atom "${atom}" has an unknown direction suffix`);
    }
    directions.add(suffix === ORNAMENT_WRITTEN_TO_SIGN ? 'written_to_sign' : 'sign_to_name');
    if (!kinds.includes(ornamentKind as OrnamentKind)) kinds.push(ornamentKind as OrnamentKind);
  }
  if (kinds.length === 0) {
    throw new Error('ornament_recognition: needs at least one ornament:* atom');
  }
  if (directions.size > 1) {
    throw new Error('ornament_recognition: a lesson mixes sign->name and written->sign ornament atoms');
  }
  return { kinds, direction: [...directions][0] };
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
  const { kinds, direction } = parseOrnamentAtoms(atoms);
  const kind = pick(rng, kinds);

  if (direction === 'written_to_sign') {
    return buildWrittenToSign(rng, clef, grade, idSeed, kind);
  }

  // Draw order below is preserved exactly (principal THEN distractors) so the
  // Grade-4 sign->name output stays byte-identical — the written->sign branch
  // above forks before any further rng draw.
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

/** G5-5 written->sign: the stimulus is the ornament realized as ordinary notes
 *  (no `ornament` field, no decoration), and the answer options are the SIGNS.
 *  Canonical stays the ornament NAME (as in sign->name, so gradeMcq is
 *  unchanged); `config.option_sign` maps each option name to the ornament kind
 *  the UI draws as a sign. */
function buildWrittenToSign(
  rng: () => number,
  clef: Clef,
  grade: number,
  idSeed: number,
  kind: OrnamentKind,
): ExerciseInstance {
  // Room for BOTH neighbours (upper and lower), so avoid the range extremes.
  const candidates = diatonicPitchesInComfortableRange(clef, grade);
  const principal = pick(rng, candidates.slice(1, -1));
  const events = realizeOrnament(kind, principal);

  const otherNames = (ORNAMENT_KINDS as readonly OrnamentKind[]).filter((k) => k !== kind).map((k) => ORNAMENT_NAMES[k]);
  const distractors = sampleDistinct(rng, otherNames, 2);

  const optionSign: Record<string, OrnamentKind> = { [ORNAMENT_NAMES[kind]]: kind };
  for (const name of distractors) {
    const dKind = (ORNAMENT_KINDS as readonly OrnamentKind[]).find((k) => ORNAMENT_NAMES[k] === name)!;
    optionSign[name] = dKind;
  }

  return {
    id: makeInstanceId('ornament_recognition', grade, idSeed),
    template_id: 'ornament_recognition',
    grade,
    strand: 'terms_signs',
    prompt: 'This ornament is written out in full. Which sign means the same?',
    stimulus: {
      music: { clef, key_sig: null, time_sig: null, voices: [{ events }] },
      text: null,
    },
    interaction: {
      type: 'mcq',
      config: { ornament: kind, direction: ORNAMENT_WRITTEN_TO_SIGN, option_sign: optionSign },
    },
    answer: { canonical: ORNAMENT_NAMES[kind], accepted_alternatives: [] },
    distractors,
    hints: [
      'Look at the pattern: a quick flick up and back is a mordent; up-and-down around the note is a turn; a longer wobble is a trill; a single small note leaning in is a grace note.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — trace the written notes: which sign is the shorthand for that exact pattern?',
    },
    srs_tags: [ornamentAtom(kind)],
    kb_version: KB_VERSION,
  };
}

export const ornamentRecognition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
