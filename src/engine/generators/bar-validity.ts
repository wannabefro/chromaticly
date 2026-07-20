// Grade 1 bar_validity generator (curriculum/exercise-templates.json,
// template_id "bar_validity"). 4-6 bars in one G1 time signature, one
// note held constant (only rhythm is under test) — corrupt 40-60% of the
// bars by swapping a single event's duration for a different G1 value,
// which always changes that bar's total (the five G1 durations map to five
// distinct unit counts, so no swap can coincidentally reproduce the target).
//
// Bar-identity model (F10): Music is a flat event stream, and abcjs may wrap
// lines, so the UI cannot infer bar boundaries from rendered geometry. This
// generator instead emits explicit BarlineEvents in the stream AND records
// each bar's event range (in `voices[0].events`, barlines excluded) as
// `interaction.config.bars`. TrueFalse renders one tick/cross control per
// entry in that array, in order — the same order as `answer.per_item` — so a
// control maps to a bar by array index, never by pixel position.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, MusicEvent } from '../../music/types';
import { barValidityAtom } from '../atoms';
import { isCompoundTimeSignature } from '../metre';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, renderableTimeSignatures, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { barUnitsFor, buildBarDurations, corruptBarDurations, type SimpleDuration } from './bar-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type G1Duration = SimpleDuration;

/** How many of `barCount` bars to corrupt, clamped so the fraction always
 *  lands in [40%, 60%] regardless of rounding at small bar counts. */
function corruptCountFor(rng: () => number, barCount: number): number {
  const ratio = 0.4 + rng() * 0.2;
  const min = Math.ceil(barCount * 0.4);
  const max = Math.floor(barCount * 0.6);
  const target = Math.round(barCount * ratio);
  return Math.min(max, Math.max(min, target));
}

/** Fisher-Yates shuffle of [0, count) using the shared rng, then takes the
 *  first `n` indices — a deterministic, seed-reproducible sample. */
function sampleIndices(rng: () => number, count: number, n: number): Set<number> {
  const indices = Array.from({ length: count }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return new Set(indices.slice(0, n));
}

interface BarRange {
  start: number;
  end: number;
}

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const G1_DURATIONS = scope.noteValues as readonly G1Duration[];
  // D13 guard: bar_validity's bar math is simple-only. Grade 3 opens compound
  // signatures in renderableTimeSignatures (U2), so filter them out here —
  // compound support for this template is a deferred slice.
  const timeSignatures = renderableTimeSignatures(grade).filter((t) => !isCompoundTimeSignature(t));
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);
  const timeSig = pick(rng, [...timeSignatures]);
  const pitch = pick(rng, diatonicPitchesInRange(clef, grade));
  const barCount = 4 + Math.floor(rng() * 3); // 4..6 inclusive
  const targetUnits = barUnitsFor(timeSig);

  const corruptSet = sampleIndices(rng, barCount, corruptCountFor(rng, barCount));

  const events: MusicEvent[] = [];
  const bars: BarRange[] = [];
  const perItem: boolean[] = [];

  for (let bar = 0; bar < barCount; bar++) {
    let durations = buildBarDurations(rng, targetUnits, G1_DURATIONS);
    const corrupted = corruptSet.has(bar);
    if (corrupted) durations = corruptBarDurations(rng, durations, G1_DURATIONS);

    const start = events.length;
    for (const dur of durations as Duration[]) {
      events.push({ type: 'note', pitch, dur });
    }
    bars.push({ start, end: events.length });
    events.push({ type: 'barline', style: bar === barCount - 1 ? 'double' : 'single' });

    perItem.push(!corrupted);
  }

  const music: Music = { clef, key_sig: null, time_sig: timeSig, voices: [{ events }] };

  return {
    id: makeInstanceId('bar_validity', grade, idSeed),
    template_id: 'bar_validity',
    grade,
    strand: 'rhythm',
    prompt: `Does each bar add up to ${timeSig}? Tick the bars that are correct.`,
    stimulus: { music, text: null },
    interaction: { type: 'true_false', config: { bars } },
    answer: { canonical: perItem, accepted_alternatives: [], per_item: perItem },
    distractors: [],
    hints: ['Add up the note values in each bar and compare the total to the time signature.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — recount the beats in each bar against the time signature.',
    },
    srs_tags: [barValidityAtom()],
    kb_version: KB_VERSION,
  };
}

export const barValidity: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed));

/** Bar-identity lookup (F10): maps a control index (bar-ordered) to that
 *  bar's event range in `stimulus.music.voices[0].events`, read from the
 *  generator-emitted metadata — never inferred from rendered stave geometry. */
export function barRange(instance: ExerciseInstance, barIndex: number): BarRange {
  const bars = instance.interaction.config?.bars as BarRange[] | undefined;
  if (!Array.isArray(bars) || barIndex < 0 || barIndex >= bars.length) {
    throw new Error(`bar_validity: no bar metadata for index ${barIndex}`);
  }
  return bars[barIndex];
}
