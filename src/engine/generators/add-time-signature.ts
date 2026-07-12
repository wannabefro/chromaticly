// Grade 1 add_time_signature generator (curriculum/exercise-templates.json,
// template_id "add_time_signature"). Renders a single bar of G1 note values
// that sums exactly to one G1 time signature's beat count and asks which
// time signature the bar is in — the same "note tree" arithmetic as
// rhythm_sum, applied to bar identification rather than a bare interval.
//
// The stimulus's `time_sig` is deliberately null (abcjs emits "M:none" and
// omits the signature glyph — see musicToAbc) so the answer isn't printed on
// the stave itself; the learner has to add up the bar to find it.
//
// Distractor strategy: the other two G1 time signatures (2/4, 3/4, 4/4).
// Each names a different total beat count for the SAME rendered bar, so
// picking one is a genuine miscount (e.g. reading a 4/4 bar as 3/4 means
// missing a whole beat) — diagnostic, not an arbitrary wrong label.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, MusicEvent } from '../../music/types';
import { addTimeSignatureAtom } from '../atoms';
import { mulberry32, pick, weighted } from '../rng';
import { diatonicPitchesInRange, G1_CLEFS, G1_NOTE_VALUES, G1_TIME_SIGNATURES } from '../scope';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type G1Duration = 'semiquaver' | 'quaver' | 'crotchet' | 'minim' | 'semibreve';

// Units = sixteenths of a crotchet's simplest subdivision (a semiquaver = 1
// unit), so every G1 duration maps to a distinct positive integer and any
// remaining unit count can always be filled by semiquavers.
const UNITS: Record<G1Duration, number> = {
  semiquaver: 1,
  quaver: 2,
  crotchet: 4,
  minim: 8,
  semibreve: 16,
};

const G1_DURATIONS = G1_NOTE_VALUES as readonly G1Duration[];

const BEATS_PER_BAR: Record<string, number> = { '2/4': 2, '3/4': 3, '4/4': 4 };

function barUnitsFor(timeSig: string): number {
  const beats = BEATS_PER_BAR[timeSig];
  if (beats === undefined) throw new Error(`add_time_signature: unsupported time signature "${timeSig}"`);
  return beats * UNITS.crotchet;
}

/** Fills a bar with random G1 durations that sum exactly to `targetUnits`,
 *  weighted toward longer values so bars don't degenerate into runs of
 *  semiquavers. Always terminates: the smallest unit (1) always divides any
 *  positive remainder, so remaining reaches exactly 0. */
function buildBarDurations(rng: () => number, targetUnits: number): G1Duration[] {
  const durations: G1Duration[] = [];
  let remaining = targetUnits;
  while (remaining > 0) {
    const candidates = G1_DURATIONS.filter((d) => UNITS[d] <= remaining);
    const value = weighted(rng, candidates.map((d) => ({ value: d, weight: UNITS[d] })));
    durations.push(value);
    remaining -= UNITS[value];
  }
  return durations;
}

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...G1_CLEFS]);
  const timeSig = pick(rng, [...G1_TIME_SIGNATURES]);
  const pitch = pick(rng, diatonicPitchesInRange(clef));
  const durations = buildBarDurations(rng, barUnitsFor(timeSig));

  const events: MusicEvent[] = durations.map((dur) => ({ type: 'note', pitch, dur: dur as Duration }));
  events.push({ type: 'barline', style: 'single' });

  const music: Music = { clef, key_sig: null, time_sig: null, voices: [{ events }] };

  const distractors = G1_TIME_SIGNATURES.filter((t) => t !== timeSig);

  return {
    id: makeInstanceId('add_time_signature', grade, idSeed),
    template_id: 'add_time_signature',
    grade,
    strand: 'rhythm',
    prompt: 'Add up the note values in this bar. Which time signature is it in?',
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: timeSig, accepted_alternatives: [] },
    distractors,
    hints: ['Use the note tree to add up the bar, then match the total to a time signature.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — recount the beats in the bar and match the total to a time signature.',
    },
    srs_tags: [addTimeSignatureAtom()],
    kb_version: KB_VERSION,
  };
}

export const addTimeSignature: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed));
