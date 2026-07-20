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
import { classifyMetre, isCompoundTimeSignature, type Beats, type Division, type MetreClass } from '../metre';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { barUnitsFor, buildBarDurations, buildCompoundBarDurations, type SimpleDuration } from './bar-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

const ALL_BEATS: readonly Beats[] = ['duple', 'triple', 'quadruple'];

function label(cls: MetreClass): string {
  const division = cls.division === 'simple' ? 'Simple' : 'Compound';
  return `${division} ${cls.beats}`;
}

function flipDivision(division: Division): Division {
  return division === 'simple' ? 'compound' : 'simple';
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
  const pitch = pick(rng, diatonicPitchesInRange(clef, grade));

  const events: MusicEvent[] = compound
    ? buildCompoundBarDurations(rng, sig).map((d): MusicEvent =>
        d.dots === 1
          ? { type: 'note', pitch, dur: d.dur as Duration, dots: d.dots }
          : { type: 'note', pitch, dur: d.dur as Duration },
      )
    : buildBarDurations(rng, barUnitsFor(sig), scope.noteValues as readonly SimpleDuration[]).map(
        (dur): MusicEvent => ({ type: 'note', pitch, dur: dur as Duration }),
      );
  events.push({ type: 'barline', style: 'single' });

  // D8: time_sig is PRINTED (no time_sig_hidden) — the opposite of
  // add_time_signature's hidden-signature exercise.
  const music: Music = { clef, key_sig: null, time_sig: sig, voices: [{ events }] };

  const canonical = label(cls);
  const divisionBlindDistractor = label({ division: flipDivision(cls.division), beats: cls.beats });
  const otherBeats = ALL_BEATS.filter((b) => b !== cls.beats);
  const miscountedBeatsDistractor = label({ division: cls.division, beats: pick(rng, otherBeats) });

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
      'Check the beaming first: notes grouped in threes are compound, in twos or fours are simple. Then count the groups for duple/triple/quadruple.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect:
        'Check two things: does each beat split into two (simple) or three (compound), and how many beats are in the bar?',
    },
    srs_tags: [metreAtom(sig)],
    kb_version: KB_VERSION,
  };
}

export const metreClassification: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
