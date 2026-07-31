// Grade 3 metre_classification generator (D7/D8) — the slice's one new
// template. Renders a single bar WITH its time signature printed (D8: the
// glyph is what's being classified, and the rendered grouping — beams of two
// vs three — is the evidence that JUSTIFIES the classification; unlike
// add_time_signature's hidden-signature "guess it" exercise, this one shows
// the answer's premise on the stave and asks the learner to name it).
//
// One MCQ covers both KB facets at once ("simple vs compound",
// "duple/triple/quadruple") via a combined six-way label
// ({Simple,Compound} x {duple,triple,quadruple}) — exactly how ABRSM asks it
// (D7). classifyMetre (src/engine/metre.ts) is the single source of truth for
// the label; this generator never hand-derives simple/compound itself.
//
// Distractors are deterministic-diagnostic, not random wrong labels (D7):
// d1 flips the division and keeps the beat count (the division-blind
// error — "Simple duple" for a 6/8 bar), d2 keeps the division and swaps the
// beat count (the miscounted-beats error — "Compound triple"/"Compound
// quadruple" for a 6/8 bar), rng-picked between the two candidates. Always
// exactly 3 options; every option is one of the six legal labels.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, MusicEvent } from '../../music/types';
import { metreAtom, parseAtom } from '../atoms';
import {
  classifyMetre,
  isCompoundTimeSignature,
  isIrregularTimeSignature,
  type Beats,
  type Division,
  type MetreClass,
} from '../metre';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import {
  barUnitsFor,
  buildBarDurations,
  buildCompoundBarDurations,
  buildIrregularBarDurations,
  type SimpleDuration,
} from './bar-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

const ALL_BEATS: readonly Beats[] = ['duple', 'triple', 'quadruple'];

const DIVISION_WORDS: Record<Division, string> = {
  simple: 'Simple',
  compound: 'Compound',
  irregular: 'Irregular',
};

function label(cls: MetreClass): string {
  return `${DIVISION_WORDS[cls.division]} ${cls.beats}`;
}

function flipDivision(division: Division): Division {
  return division === 'simple' ? 'compound' : 'simple';
}

// Irregular metres (Grade 5, chromaticly-e3z.6) need their own distractors:
// "flip the division" has no meaning when the division IS irregular. The two
// mistakes a learner actually makes are counting the bar as the nearest regular
// metre — a 5/4 bar read as 4/4, a 7/8 bar read as 6/8 — and confusing the two
// irregulars with each other.
const NEAREST_REGULAR: Record<Beats & ('quintuple' | 'septuple'), MetreClass> = {
  quintuple: { division: 'simple', beats: 'quadruple' },
  septuple: { division: 'compound', beats: 'duple' },
};

function irregularDistractors(cls: MetreClass): [string, string] {
  const beats = cls.beats as 'quintuple' | 'septuple';
  const other: Beats = beats === 'quintuple' ? 'septuple' : 'quintuple';
  return [label(NEAREST_REGULAR[beats]), label({ division: 'irregular', beats: other })];
}

/** The atom-named signatures (metre:<sig>) — the answer pool (mirrors
 *  mode_swap's minorTonicsFromAtoms: at least one atom is required, since
 *  unlike add_time_signature this template has no legacy bare-atom draw to
 *  fall back to). */
function metreSignaturesFromAtoms(atoms: string[]): string[] {
  const sigs: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'metre' || parts.length !== 1) continue;
    const [sig] = parts;
    if (!sigs.includes(sig)) sigs.push(sig);
  }
  if (sigs.length === 0) {
    throw new Error('metre_classification: needs at least one metre:<sig> atom');
  }
  return sigs;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const sig = pick(rng, metreSignaturesFromAtoms(atoms));
  const cls = classifyMetre(sig);
  const compound = isCompoundTimeSignature(sig);

  const clef = pick(rng, [...scope.clefs]);
  // Incidental notation pitch: rhythm/metre is the subject here, not pitch,
  // so this stays in the comfortable band rather than the (wider, grade-3+)
  // reading range — see comfortablePitchRange in scope.ts.
  const pitch = pick(rng, diatonicPitchesInComfortableRange(clef, grade));

  const simplePool = scope.noteValues as readonly SimpleDuration[];
  const events: MusicEvent[] = compound
    ? buildCompoundBarDurations(rng, sig).map((d): MusicEvent =>
        d.dots === 1
          ? { type: 'note', pitch, dur: d.dur as Duration, dots: d.dots }
          : { type: 'note', pitch, dur: d.dur as Duration },
      )
    : (isIrregularTimeSignature(sig)
        ? buildIrregularBarDurations(rng, sig, simplePool)
        : buildBarDurations(rng, barUnitsFor(sig), simplePool)
      ).map((dur): MusicEvent => ({ type: 'note', pitch, dur: dur as Duration }));
  events.push({ type: 'barline', style: 'single' });

  // D8: time_sig is PRINTED (no time_sig_hidden) — the opposite of
  // add_time_signature's hidden-signature exercise.
  const music: Music = { clef, key_sig: null, time_sig: sig, voices: [{ events }] };

  const canonical = label(cls);
  const irregular = isIrregularTimeSignature(sig);
  const [divisionBlindDistractor, miscountedBeatsDistractor] = irregular
    ? irregularDistractors(cls)
    : [
        label({ division: flipDivision(cls.division), beats: cls.beats }),
        label({ division: cls.division, beats: pick(rng, ALL_BEATS.filter((b) => b !== cls.beats)) }),
      ];

  return {
    id: makeInstanceId('metre_classification', grade, idSeed),
    template_id: 'metre_classification',
    grade,
    strand: 'rhythm',
    prompt: 'Which describes this time signature?',
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors: [divisionBlindDistractor, miscountedBeatsDistractor],
    hints: [
      irregular
        ? 'Count the beats in the bar. Five or seven divide into no equal groups, which is what makes a metre irregular — the beaming shows how they are grouped instead.'
        : 'Check the beaming first: notes grouped in threes are compound, in twos or fours are simple. Then count the groups for duple/triple/quadruple.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: irregular
        ? 'Count the beats in the bar. Five and seven cannot be split into equal beats, so the metre is irregular rather than simple or compound.'
        : 'Check two things: does each beat split into two (simple) or three (compound), and how many beats are in the bar?',
      ...(irregular
        ? {
            by_distractor: {
              [divisionBlindDistractor]: `That is the nearest regular metre, and it is one beat out. Count again: this bar has ${cls.beats === 'quintuple' ? 'five' : 'seven'} beats, which no equal division reaches.`,
              [miscountedBeatsDistractor]: `That is the other irregular metre. Both are irregular, but count the beats — this bar has ${cls.beats === 'quintuple' ? 'five, not seven' : 'seven, not five'}.`,
            },
          }
        : {}),
    },
    srs_tags: [metreAtom(sig)],
    kb_version: KB_VERSION,
  };
}

export const metreClassification: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
