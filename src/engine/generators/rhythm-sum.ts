// Grade 1 rhythm_sum generator (curriculum/exercise-templates.json,
// template_id "rhythm_sum"). Answer is represented as {dur, dots} (the
// validator's rhythmSumHook accepts either that object shape or a "dotted
// <name>" string — this generator is consistently the object form).
//
// Construction strategy: rather than sampling operands and rejecting sums
// that miss a legal G1 value (a low hit-rate search), a decomposition table
// is precomputed once at module load — pure, no randomness — mapping every
// legal G1 target value to every 2- or 3-operand addition that sums to it
// exactly. Grade 1 rhythm sums are addition of note values only (no
// subtraction), so build() picks among decomposable targets and their add
// combinations — a single seed reliably produces a legal item without leaning
// on generateValidated's reject-retry loop.

import { KB, KB_VERSION } from '../../content/knowledge-base';
import type { Duration } from '../../music/types';
import { rhythmSumAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type Dots = 0 | 1;

interface ValueEntry {
  dur: Duration;
  dots: Dots;
  units: number; // sixteenths of a crotchet — kept integer for exact-match arithmetic
}

function unitsFor(dur: Duration, dots: Dots): number {
  const beats = KB.noteValues[dur].beats_in_crotchets;
  return Math.round(beats * 16 * (dots === 1 ? 1.5 : 1));
}

// The note values ABRSM Grade 1 uses in rhythm sums: no semiquavers, and the
// only dotted value is the dotted minim (dotted crotchet/quaver and a dotted
// semibreve are all out of Grade 1 scope). Both the sum operands and the MCQ
// distractors are drawn from this set, so no item can surface an out-of-scope
// value.
const RHYTHM_SUM_VALUES: ReadonlyArray<{ dur: Duration; dots: Dots }> = [
  { dur: 'semibreve', dots: 0 },
  { dur: 'minim', dots: 1 },
  { dur: 'minim', dots: 0 },
  { dur: 'crotchet', dots: 0 },
  { dur: 'quaver', dots: 0 },
];

const VALUE_TABLE: ValueEntry[] = RHYTHM_SUM_VALUES.map(({ dur, dots }) => ({
  dur,
  dots,
  units: unitsFor(dur, dots),
}));

interface Decomposition {
  operands: ValueEntry[];
}

function targetKey(entry: ValueEntry): string {
  return `${entry.dur}:${entry.dots}`;
}

function findDecompositions(target: ValueEntry): Decomposition[] {
  const decomps: Decomposition[] = [];
  for (const a of VALUE_TABLE) {
    for (const b of VALUE_TABLE) {
      if (a.units + b.units === target.units) decomps.push({ operands: [a, b] });
      for (const c of VALUE_TABLE) {
        if (a.units + b.units + c.units === target.units) {
          decomps.push({ operands: [a, b, c] });
        }
      }
    }
  }
  return decomps;
}

const DECOMPOSITIONS_BY_TARGET = new Map<string, Decomposition[]>(
  VALUE_TABLE.map((target) => [targetKey(target), findDecompositions(target)]),
);

// Addition-only leaves the smallest values (e.g. a lone semiquaver) with no
// two-or-three-note sum, so only targets that decompose are eligible.
const DECOMPOSABLE_TARGETS: ValueEntry[] = VALUE_TABLE.filter(
  (target) => (DECOMPOSITIONS_BY_TARGET.get(targetKey(target))?.length ?? 0) > 0,
);

function toAnswerValue(entry: ValueEntry): { dur: Duration; dots: Dots } {
  return { dur: entry.dur, dots: entry.dots };
}

function formatValue(entry: ValueEntry): string {
  return entry.dots === 1 ? `dotted ${entry.dur}` : entry.dur;
}

function formatPrompt(operands: ValueEntry[]): string {
  return `${operands.map(formatValue).join(' + ')} = ?`;
}

function sameValue(a: ValueEntry, b: ValueEntry): boolean {
  return a.dur === b.dur && a.dots === b.dots;
}

// Distractor rule: the un-dotted version of a dotted answer (the classic
// "forgot the dot" error), then fill to two slots with the nearest values by
// duration — all drawn from RHYTHM_SUM_VALUES, so every option stays in Grade 1
// scope and near-miss diagnostic rather than obviously wrong.
function buildDistractors(target: ValueEntry): ValueEntry[] {
  const distractors: ValueEntry[] = [];

  if (target.dots === 1) {
    const undotted = VALUE_TABLE.find((v) => v.dur === target.dur && v.dots === 0);
    if (undotted) distractors.push(undotted);
  }

  const byNearness = VALUE_TABLE.filter(
    (v) => !sameValue(v, target) && !distractors.some((d) => sameValue(d, v)),
  ).sort((a, b) => Math.abs(a.units - target.units) - Math.abs(b.units - target.units));

  while (distractors.length < 2 && byNearness.length > 0) {
    distractors.push(byNearness.shift()!);
  }

  return distractors;
}

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const target = pick(rng, DECOMPOSABLE_TARGETS);
  const decomps = DECOMPOSITIONS_BY_TARGET.get(targetKey(target))!;
  const decomposition = pick(rng, decomps);
  const distractorEntries = buildDistractors(target);

  // The instruction lives in `prompt`; the sum itself is the stimulus so the UI
  // renders it once (as the large notation-card line), never twice.
  const sumPrompt = formatPrompt(decomposition.operands);

  return {
    id: makeInstanceId('rhythm_sum', grade, idSeed),
    template_id: 'rhythm_sum',
    grade,
    strand: 'rhythm',
    prompt: 'Answer this musical sum with one note:',
    stimulus: { music: null, text: sumPrompt },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: toAnswerValue(target), accepted_alternatives: [] },
    distractors: distractorEntries.map(toAnswerValue),
    hints: ['Use the note tree: break each value down into the smallest shared unit, then add.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — check the note tree and re-add the values carefully, including any dots.',
    },
    srs_tags: [rhythmSumAtom()],
    kb_version: KB_VERSION,
  };
}

export const rhythmSum: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed));
