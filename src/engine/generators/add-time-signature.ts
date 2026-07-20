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
import { isCompoundTimeSignature } from '../metre';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, renderableTimeSignatures, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { barUnitsFor, buildBarDurations, type SimpleDuration } from './bar-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type G1Duration = SimpleDuration;

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const G1_DURATIONS = scope.noteValues as readonly G1Duration[];
  // D13 guard (TEMPORARY): this generator's bar math is still simple-only.
  // Grade 3 opens compound signatures in renderableTimeSignatures (U2), so
  // filter them out here — U5 replaces this guard with the real compound
  // path (D6).
  const timeSignatures = renderableTimeSignatures(grade).filter((t) => !isCompoundTimeSignature(t));
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);
  const timeSig = pick(rng, [...timeSignatures]);
  const pitch = pick(rng, diatonicPitchesInRange(clef, grade));
  const durations = buildBarDurations(rng, barUnitsFor(timeSig), G1_DURATIONS);

  const events: MusicEvent[] = durations.map((dur) => ({ type: 'note', pitch, dur: dur as Duration }));
  events.push({ type: 'barline', style: 'single' });

  const music: Music = { clef, key_sig: null, time_sig: null, voices: [{ events }] };

  const distractors = timeSignatures.filter((t) => t !== timeSig);

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
