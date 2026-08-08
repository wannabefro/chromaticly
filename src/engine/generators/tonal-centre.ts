// tonal_centre generator (chromaticly-io4.3). minor-keys-2 spends most of its
// body on how to tell a minor piece from its relative major — where the music
// settles, the raised 7th as a clue — and scored only the key names. This asks
// the recognition: a short passage under a shared signature, name its key.

import { KB_VERSION } from '../../content/knowledge-base';
import { parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { spellInKeySig } from './key-spelling';
import { relativeMajorOf } from './minor-keys';
import { naturalPitchAtOrdinal, pitchOrdinal, type Letter } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

export interface TonalCentre {
  tonic: string;
  mode: 'major' | 'minor';
}

export function tonalCentreAtom({ tonic, mode }: TonalCentre): string {
  return `tonal_centre:${tonic}_${mode}`;
}

export function parseTonalCentreAtom(atom: string): TonalCentre | null {
  const { kind, parts } = parseAtom(atom);
  if (kind !== 'tonal_centre' || parts.length !== 1) return null;
  const [tonic, mode] = parts[0].split('_');
  return mode === 'major' || mode === 'minor' ? { tonic, mode } : null;
}

/** The grade's relative pairs, as {minor, major} tonics. */
export function tonalCentrePairs(grade: number): { minor: string; major: string }[] {
  return scopeForGrade(grade).keysMinor.map((minor) => ({ minor, major: relativeMajorOf(minor) }));
}

// The plain treble stave. A ledger line would make this a reading question.
const LOWEST = pitchOrdinal('E', 4);
const HIGHEST = pitchOrdinal('G', 5);

/** The octave keeping the tonic, the note below and the 3rd above on the stave. */
function tonicOctave(letter: Letter): number {
  for (const octave of [4, 5]) {
    const ord = pitchOrdinal(letter, octave);
    if (ord - 1 >= LOWEST && ord + 2 <= HIGHEST) return octave;
  }
  throw new Error(`tonal_centre: no stave octave for ${letter}`);
}

function raise(pitch: string): string {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`tonal_centre: unexpected pitch "${pitch}"`);
  const [, letter, accidental, octave] = m;
  if (accidental === '#') throw new Error(`tonal_centre: ${pitch} would need a double sharp`);
  return `${letter}${accidental === 'b' ? '' : '#'}${octave}`;
}

/** Varied, or a replayed lesson teaches one memorised shape per key. */
const RISES = [1, 2, 4] as const;

/** tonic, a step up, 7th below, tonic. In minor that 7th is raised. */
export function tonalCentrePassage(centre: TonalCentre, rise: number): string[] {
  const keySig = `${centre.tonic}_${centre.mode}`;
  const letter = centre.tonic[0] as Letter;
  const octave = tonicOctave(letter);
  const ord = pitchOrdinal(letter, octave);
  const tonic = spellInKeySig(naturalPitchAtOrdinal(ord), keySig);
  const upper = spellInKeySig(naturalPitchAtOrdinal(ord + rise), keySig);
  const seventh = spellInKeySig(naturalPitchAtOrdinal(ord - 1), keySig);
  return [tonic, upper, centre.mode === 'minor' ? raise(seventh) : seventh, tonic];
}

/** The rises that stay on the stave. Never empty — the 3rd always fits. */
export function risesInStave(centre: TonalCentre): number[] {
  const ord = pitchOrdinal(centre.tonic[0] as Letter, tonicOctave(centre.tonic[0] as Letter));
  return RISES.filter((rise) => ord + rise <= HIGHEST);
}

function keyName({ tonic, mode }: TonalCentre): string {
  return `${tonic} ${mode}`;
}

/** From grade 3 up a tonic names two pairs, so the mode picks it (chromaticly-xc2). */
function pairFor(centre: TonalCentre, grade: number): { minor: string; major: string } {
  const pair = tonalCentrePairs(grade).find((p) => (centre.mode === 'minor' ? p.minor : p.major) === centre.tonic);
  if (!pair) throw new Error(`tonal_centre: ${keyName(centre)} is outside grade ${grade}`);
  return pair;
}

function relativeOf(centre: TonalCentre, grade: number): TonalCentre {
  const pair = pairFor(centre, grade);
  return centre.mode === 'minor' ? { tonic: pair.major, mode: 'major' } : { tonic: pair.minor, mode: 'minor' };
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const wanted = atoms.map(parseTonalCentreAtom).filter((c): c is TonalCentre => c !== null);
  if (wanted.length === 0) throw new Error('tonal_centre: needs a tonal_centre:* atom');

  // Round-robin. The set rotates templates every 8 items, so a plain modulo
  // reaches only half the pool.
  const centre = wanted[(idSeed + Math.floor(idSeed / 8)) % wanted.length];
  const relative = relativeOf(centre, grade);
  const passage = tonalCentrePassage(centre, pick(rng, risesInStave(centre)));

  // With two options the pair alone answers it, and the signature goes unread.
  const own = pairFor(centre, grade);
  const elsewhere = tonalCentrePairs(grade)
    .filter((p) => p.minor !== own.minor)
    .map((p) => (centre.mode === 'minor' ? { tonic: p.minor, mode: 'minor' as const } : { tonic: p.major, mode: 'major' as const }));
  const otherPair = pick(rng, elsewhere);

  const canonical = keyName(centre);
  const relativeName = keyName(relative);
  const otherName = keyName(otherPair);
  const settle = `The passage starts and ends on ${centre.tonic}`;

  return {
    id: makeInstanceId('tonal_centre', grade, idSeed),
    template_id: 'tonal_centre',
    grade,
    strand: 'scales_keys',
    prompt: 'Which key is this passage in?',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: `${centre.tonic}_${centre.mode}`,
        time_sig: '4/4',
        voices: [{ events: passage.map((pitch) => ({ type: 'note' as const, pitch, dur: 'crotchet' as const })) }],
      },
      text: null,
    },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors: [relativeName, otherName],
    hints: ['This key signature fits two keys. The note the music starts and ends on tells you which of them.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `${settle}, so it is in ${canonical}.`,
      by_distractor: {
        [relativeName]: `${relativeName} shares this key signature, so the signature cannot decide it. ${settle}, which makes it ${canonical}.`,
        [otherName]: `${otherName} has a different key signature from the one printed here. Count the sharps or flats on the stave first.`,
      },
    },
    srs_tags: [tonalCentreAtom(centre)],
    kb_version: KB_VERSION,
  };
}

export const tonalCentre: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
