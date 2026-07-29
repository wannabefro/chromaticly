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
import type { Duration, Music } from '../../music/types';
import { RHYTHM_SUM_DOUBLE_DOT_ATOM, rhythmSumAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type Dots = 0 | 1 | 2;

interface ValueEntry {
  dur: Duration;
  dots: Dots;
  units: number; // sixteenths of a crotchet — kept integer for exact-match arithmetic
}

const DOT_MULTIPLIER: Record<Dots, number> = { 0: 1, 1: 1.5, 2: 1.75 };

function unitsFor(dur: Duration, dots: Dots): number {
  const beats = KB.noteValues[dur].beats_in_crotchets;
  return Math.round(beats * 16 * DOT_MULTIPLIER[dots]);
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

// Grade 4 (GRADE_4_SCOPE.rhythmDevices adds 'double_dot'): the double-dotted
// minim, opened alongside the existing dotted minim. Kept in a separate table
// from RHYTHM_SUM_VALUES/VALUE_TABLE (below) rather than appended to it, so
// grades 1-3 keep computing DECOMPOSITIONS_BY_TARGET/DECOMPOSABLE_TARGETS over
// the exact original 5-value table — byte-identical output (the seed-stability
// snapshot proves it) — while grade 4 gets its own wider decomposition table.
const DOUBLE_DOT_VALUES: ReadonlyArray<{ dur: Duration; dots: Dots }> = [{ dur: 'minim', dots: 2 }];

const GRADE4_VALUE_TABLE: ValueEntry[] = [
  ...VALUE_TABLE,
  ...DOUBLE_DOT_VALUES.map(({ dur, dots }) => ({ dur, dots, units: unitsFor(dur, dots) })),
];

interface Decomposition {
  operands: ValueEntry[];
}

function targetKey(entry: ValueEntry): string {
  return `${entry.dur}:${entry.dots}`;
}

function findDecompositions(target: ValueEntry, table: readonly ValueEntry[]): Decomposition[] {
  const decomps: Decomposition[] = [];
  for (const a of table) {
    for (const b of table) {
      if (a.units + b.units === target.units) decomps.push({ operands: [a, b] });
      for (const c of table) {
        if (a.units + b.units + c.units === target.units) {
          decomps.push({ operands: [a, b, c] });
        }
      }
    }
  }
  return decomps;
}

function decomposableTargetsOver(
  table: readonly ValueEntry[],
): { decompositionsByTarget: Map<string, Decomposition[]>; decomposableTargets: ValueEntry[] } {
  const decompositionsByTarget = new Map<string, Decomposition[]>(
    table.map((target) => [targetKey(target), findDecompositions(target, table)]),
  );
  // Addition-only leaves the smallest values (e.g. a lone semiquaver) with no
  // two-or-three-note sum, so only targets that decompose are eligible.
  const decomposableTargets = table.filter((target) => (decompositionsByTarget.get(targetKey(target))?.length ?? 0) > 0);
  return { decompositionsByTarget, decomposableTargets };
}

const { decompositionsByTarget: DECOMPOSITIONS_BY_TARGET, decomposableTargets: DECOMPOSABLE_TARGETS } =
  decomposableTargetsOver(VALUE_TABLE);

const { decompositionsByTarget: GRADE4_DECOMPOSITIONS_BY_TARGET, decomposableTargets: GRADE4_DECOMPOSABLE_TARGETS } =
  decomposableTargetsOver(GRADE4_VALUE_TABLE);

function toAnswerValue(entry: ValueEntry): { dur: Duration; dots: Dots } {
  return { dur: entry.dur, dots: entry.dots };
}

function formatValue(entry: ValueEntry): string {
  if (entry.dots === 2) return `double-dotted ${entry.dur}`;
  return entry.dots === 1 ? `dotted ${entry.dur}` : entry.dur;
}

function formatPrompt(operands: ValueEntry[]): string {
  return `${operands.map(formatValue).join(' + ')} = ?`;
}

// A single note value as a "pure rhythm" glyph — one note on a clefless single line
// (chromaticly-f9k). Pitch is meaningless here, so every value sits on the same line;
// only the note VALUE (head/stem/flags/dots) reads. Drives both the sum's operand
// glyphs and the note-value answer options.
function glyphMusic(entry: { dur: Duration; dots: Dots }): Music {
  return {
    clef: 'treble',
    key_sig: null,
    time_sig: null,
    rhythmStaff: true,
    voices: [{ events: [{ type: 'note', pitch: 'B4', dur: entry.dur, dots: entry.dots }] }],
  };
}

function valueKey(entry: { dur: Duration; dots: Dots }): string {
  return `${entry.dur}:${entry.dots}`;
}

function sameValue(a: ValueEntry, b: ValueEntry): boolean {
  return a.dur === b.dur && a.dots === b.dots;
}

// Distractor rule: the un-dotted version of a dotted answer (the classic
// "forgot the dot" error), then fill to two slots with the nearest values by
// duration — all drawn from the same grade-scoped value table, so every
// option stays in scope and near-miss diagnostic rather than obviously wrong.
function buildDistractors(target: ValueEntry, valueTable: readonly ValueEntry[]): ValueEntry[] {
  const distractors: ValueEntry[] = [];

  if (target.dots === 1) {
    const undotted = valueTable.find((v) => v.dur === target.dur && v.dots === 0);
    if (undotted) distractors.push(undotted);
  }

  const byNearness = valueTable
    .filter((v) => !sameValue(v, target) && !distractors.some((d) => sameValue(d, v)))
    .sort((a, b) => Math.abs(a.units - target.units) - Math.abs(b.units - target.units));

  while (distractors.length < 2 && byNearness.length > 0) {
    distractors.push(byNearness.shift()!);
  }

  return distractors;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  // Grade 4 (GRADE_4_SCOPE.rhythmDevices: 'double_dot') opens the wider value
  // table; grades 1-3 stay on the original VALUE_TABLE/DECOMPOSABLE_TARGETS —
  // the exact same objects/computation as before this generator gained
  // double-dot support — so their output is byte-identical.
  const valueTable = grade >= 4 ? GRADE4_VALUE_TABLE : VALUE_TABLE;
  const decompositionsByTarget = grade >= 4 ? GRADE4_DECOMPOSITIONS_BY_TARGET : DECOMPOSITIONS_BY_TARGET;
  // The double-dot lesson (rhythm-doubledot-4) scopes to the double-dotted
  // target so its headline skill is ACTUALLY assessed (chromaticly-2fc):
  // uniform target selection left the deterministic 8-item set with zero
  // double-dotted items. A bare `rhythm_sum` atom stays unconstrained, so
  // grade-1 note-values and the pre-lesson grade-4 pin are byte-identical.
  const doubleDotOnly = atoms.includes(RHYTHM_SUM_DOUBLE_DOT_ATOM);
  const allTargets = grade >= 4 ? GRADE4_DECOMPOSABLE_TARGETS : DECOMPOSABLE_TARGETS;
  const decomposableTargets = doubleDotOnly ? allTargets.filter((t) => t.dots === 2) : allTargets;
  const target = pick(rng, decomposableTargets);
  const decomps = decompositionsByTarget.get(targetKey(target))!;
  const decomposition = pick(rng, decomps);
  const distractorEntries = buildDistractors(target, valueTable);

  // The instruction lives in `prompt`; the sum itself is the stimulus. `text` is the
  // spoken-word form ("minim + crotchet = ?") kept for screen-readers and E2E, while
  // the visible worksheet is rendered from `sum_operands` glyphs (chromaticly-f9k).
  const sumPrompt = formatPrompt(decomposition.operands);

  // Each operand and each note-value option rendered as a rhythm glyph, so the sum
  // reads as notes not words (matches note_value_compare). option_music is keyed by
  // "dur:dots" to match the {dur,dots} option values (grading.optionKey).
  const optionMusic: Record<string, Music> = {};
  for (const entry of [target, ...distractorEntries]) optionMusic[valueKey(entry)] = glyphMusic(entry);

  return {
    id: makeInstanceId('rhythm_sum', grade, idSeed),
    template_id: 'rhythm_sum',
    grade,
    strand: 'rhythm',
    prompt: 'Answer this musical sum with one note:',
    stimulus: { music: null, text: sumPrompt },
    interaction: {
      type: 'mcq',
      config: { sum_operands: decomposition.operands.map(glyphMusic), option_music: optionMusic },
    },
    answer: { canonical: toAnswerValue(target), accepted_alternatives: [] },
    distractors: distractorEntries.map(toAnswerValue),
    hints: ['Use the note tree: break each value down into the smallest shared unit, then add.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — check the note tree and re-add the values carefully, including any dots.',
    },
    srs_tags: [doubleDotOnly ? RHYTHM_SUM_DOUBLE_DOT_ATOM : rhythmSumAtom()],
    kb_version: KB_VERSION,
  };
}

export const rhythmSum: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
