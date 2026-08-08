// add_barlines generator (chromaticly-51o). curriculum/exercise-templates.json
// has specced this since the first grade-1 pass and nothing implemented it, so
// the exam's own "add the bar-lines to this rhythm" question was never asked.
//
// The stimulus is four bars with every internal bar-line stripped. The answer is
// the SET of positions they belong at, counted in notes from the start, so the
// order the learner taps in cannot matter. Beaming is left to the emitter, which
// beams from the metre — the exam books rely on that being a usable clue.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, MusicEvent } from '../../music/types';
import { parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange, renderableTimeSignatures, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { barUnitsFor, buildBarDurations, buildCompoundBarDurations, type BarDuration } from './bar-math';
import { isCompoundTimeSignature } from '../metre';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

export const BARS = 4;

export function addBarlinesAtom(timeSig: string): string {
  return `add_barlines:${timeSig}`;
}

function timeSignaturesFromAtoms(atoms: string[], grade: number): string[] {
  const renderable = renderableTimeSignatures(grade);
  const sigs: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'add_barlines' || parts.length !== 1) continue;
    if (renderable.includes(parts[0]) && !sigs.includes(parts[0])) sigs.push(parts[0]);
  }
  return sigs;
}

/** One bar's note values. Compound metres use the beat patterns, so no note
 *  crosses a dotted beat. */
function barValues(rng: () => number, timeSig: string, pool: readonly Duration[]): BarDuration[] {
  if (isCompoundTimeSignature(timeSig)) return buildCompoundBarDurations(rng, timeSig);
  return buildBarDurations(rng, barUnitsFor(timeSig), pool as never).map((dur) => ({ dur }));
}

/** Where the bar-lines belong, in notes from the start. The printed double
 *  bar is not in the answer. */
export function barlinePositions(barNoteCounts: number[]): number[] {
  const positions: number[] = [];
  let running = 0;
  for (const count of barNoteCounts.slice(0, -1)) {
    running += count;
    positions.push(running);
  }
  return positions;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const sigs = timeSignaturesFromAtoms(atoms, grade);
  if (sigs.length === 0) throw new Error('add_barlines: needs a renderable "add_barlines:<time signature>" atom');

  const timeSig = pick(rng, sigs);
  const scope = scopeForGrade(grade);
  const clef = pick(rng, [...scope.clefs]);
  const pitch = pick(rng, diatonicPitchesInComfortableRange(clef, grade));
  const pool = scope.noteValues.filter((d) => d !== 'breve' && d !== 'semibreve');

  const bars = Array.from({ length: BARS }, () => barValues(rng, timeSig, pool));
  const events: MusicEvent[] = bars.flatMap((values) =>
    values.map((v) => (v.dots ? { type: 'note' as const, pitch, dur: v.dur, dots: v.dots } : { type: 'note' as const, pitch, dur: v.dur })),
  );
  events.push({ type: 'barline', style: 'double' });

  const positions = barlinePositions(bars.map((b) => b.length));
  const music: Music = { clef: clef as Music['clef'], key_sig: null, time_sig: timeSig, voices: [{ events }] };
  const noteCount = bars.reduce((a, b) => a + b.length, 0);

  return {
    id: makeInstanceId('add_barlines', grade, idSeed),
    template_id: 'add_barlines',
    grade,
    strand: 'rhythm',
    prompt: `Add the bar-lines to this rhythm in ${timeSig}.`,
    stimulus: { music, text: null },
    interaction: { type: 'tap_placement', config: { notes: noteCount, bars: BARS, time_sig: timeSig } },
    answer: { canonical: positions, accepted_alternatives: [] },
    distractors: [],
    hints: ['Look at how the notes are grouped — beams show you where the beats are.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `Each bar of ${timeSig} holds the same total. Count the beats from the start, and put a bar-line every time you reach that total.`,
    },
    srs_tags: [addBarlinesAtom(timeSig)],
    kb_version: KB_VERSION,
  };
}

export const addBarlines: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
