// Grade 1 rhythm_sum generator (curriculum/exercise-templates.json,
// template_id "rhythm_sum"). Answer is represented as {dur, dots} (the
// validator's rhythmSumHook accepts either that object shape or a "dotted
// <name>" string — this generator is consistently the object form).
//
// Construction strategy: rather than sampling operands and rejecting sums
// that miss a legal G1 value (a low hit-rate search), a decomposition table
// is precomputed once at module load — pure, no randomness — mapping every
// legal G1 target value to every 2- or 3-operand add/subtract combination
// that sums to it exactly. build() then only has to pick among candidates
// that are already guaranteed valid, so a single seed reliably produces a
// legal item without leaning on generateValidated's reject-retry loop.

import { KB, KB_VERSION } from '../../content/knowledge-base';
import type { Duration } from '../../music/types';
import { rhythmSumAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { G1_NOTE_VALUES } from '../scope';
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

const VALUE_TABLE: ValueEntry[] = G1_NOTE_VALUES.flatMap((dur) => [
  { dur, dots: 0 as Dots, units: unitsFor(dur, 0) },
  { dur, dots: 1 as Dots, units: unitsFor(dur, 1) },
]);

// Ascending duration — used for "one step longer/shorter on the note tree".
const TREE_ORDER: Duration[] = ['semiquaver', 'quaver', 'crotchet', 'minim', 'semibreve'];

interface Decomposition {
  operands: ValueEntry[];
  op: 'add' | 'subtract';
}

function targetKey(entry: ValueEntry): string {
  return `${entry.dur}:${entry.dots}`;
}

function findDecompositions(target: ValueEntry): Decomposition[] {
  const decomps: Decomposition[] = [];
  for (const a of VALUE_TABLE) {
    for (const b of VALUE_TABLE) {
      if (a.units + b.units === target.units) decomps.push({ operands: [a, b], op: 'add' });
      if (a.units - b.units === target.units && a.units > b.units) {
        decomps.push({ operands: [a, b], op: 'subtract' });
      }
      for (const c of VALUE_TABLE) {
        if (a.units + b.units + c.units === target.units) {
          decomps.push({ operands: [a, b, c], op: 'add' });
        }
        if (a.units + b.units - c.units === target.units && c.units > 0) {
          decomps.push({ operands: [a, b, c], op: 'subtract' });
        }
      }
    }
  }
  return decomps;
}

const DECOMPOSITIONS_BY_TARGET = new Map<string, Decomposition[]>(
  VALUE_TABLE.map((target) => [targetKey(target), findDecompositions(target)]),
);

function toAnswerValue(entry: ValueEntry): { dur: Duration; dots: Dots } {
  return { dur: entry.dur, dots: entry.dots };
}

function formatValue(entry: ValueEntry): string {
  return entry.dots === 1 ? `dotted ${entry.dur}` : entry.dur;
}

function formatPrompt(operands: ValueEntry[], op: 'add' | 'subtract'): string {
  const parts = operands.map((operand, i) => {
    const name = formatValue(operand);
    if (i === 0) return name;
    const sign = op === 'subtract' && i === operands.length - 1 ? '-' : '+';
    return `${sign} ${name}`;
  });
  return `${parts.join(' ')} = ?`;
}

function treeIndex(dur: Duration): number {
  return TREE_ORDER.indexOf(dur);
}

function adjacentTreeEntry(entry: ValueEntry, direction: 1 | -1): ValueEntry | null {
  const idx = treeIndex(entry.dur) + direction;
  if (idx < 0 || idx >= TREE_ORDER.length) return null;
  const dur = TREE_ORDER[idx];
  return { dur, dots: entry.dots, units: unitsFor(dur, entry.dots) };
}

function sameValue(a: ValueEntry, b: ValueEntry): boolean {
  return a.dur === b.dur && a.dots === b.dots;
}

// Distractor rule (template): "one step longer/shorter on the note tree" AND
// "the un-dotted version of the correct dotted answer". At the tree's edges
// (semiquaver/semibreve) or for an undotted target, the second slot falls
// back to the dotted/undotted sibling of the same note value so a closed
// item always has two distinct, diagnostic options.
function buildDistractors(target: ValueEntry, rng: () => number): ValueEntry[] {
  const direction = pick(rng, [1, -1] as const);
  const primary = adjacentTreeEntry(target, direction) ?? adjacentTreeEntry(target, direction === 1 ? -1 : 1);
  const distractors: ValueEntry[] = primary ? [primary] : [];

  if (target.dots === 1) {
    distractors.push({ dur: target.dur, dots: 0, units: unitsFor(target.dur, 0) });
  } else {
    const secondary = adjacentTreeEntry(target, direction === 1 ? -1 : 1);
    if (secondary && !distractors.some((d) => sameValue(d, secondary))) {
      distractors.push(secondary);
    } else {
      distractors.push({ dur: target.dur, dots: 1, units: unitsFor(target.dur, 1) });
    }
  }

  return distractors;
}

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const target = pick(rng, VALUE_TABLE);
  const decomps = DECOMPOSITIONS_BY_TARGET.get(targetKey(target)) ?? [];
  if (decomps.length === 0) {
    throw new Error(`no decomposition found for target ${targetKey(target)}`);
  }
  const decomposition = pick(rng, decomps);
  const distractorEntries = buildDistractors(target, rng);

  const sumPrompt = formatPrompt(decomposition.operands, decomposition.op);

  return {
    id: makeInstanceId('rhythm_sum', grade, idSeed),
    template_id: 'rhythm_sum',
    grade,
    strand: 'rhythm',
    prompt: `Answer this musical sum with one note: ${sumPrompt}`,
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
