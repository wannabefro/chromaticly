// Tier-A generator registry (U6-U8). Maps each template_id to its generator.

import type { ExerciseInstance } from '../schema';
import { addTimeSignature } from './add-time-signature';
import { anacrusisRecognition } from './anacrusis-recognition';
import { barValidity } from './bar-validity';
import { chordRecognition } from './chord-recognition';
import { clefEquivalence } from './clef-equivalence';
import { cadenceRecognition } from './cadence-recognition';
import { dupletRecognition } from './duplet-recognition';
import { tripletRecognition } from './triplet-recognition';
import { majorScaleSteps } from './major-scale-steps';
import { tieDotValue } from './tie-dot-value';
import { enharmonicRecognition } from './enharmonic-recognition';
import { chromaticScale } from './chromatic-scale';
import { degreeNameId } from './degree-name-id';
import { findTheBar } from './find-the-bar';
import { instrumentKnowledge } from './instrument-knowledge';
import { intervalNaming, intervalNamingStaveInput } from './interval-naming';
import { keySignatureId } from './key-signature-id';
import { metreClassification } from './metre-classification';
import { metreRewrite } from './metre-rewrite';
import { modeSwap } from './mode-swap';
import { noteNaming } from './note-naming';
import { noteValueCompare } from './note-value-compare';
import { octaveTransposition } from './octave-transposition';
import { ornamentRecognition } from './ornament-recognition';
import { restCompletion } from './rest-completion';
import { rhythmSum } from './rhythm-sum';
import { scaleDegreeId } from './scale-degree-id';
import { satbVoiceRecognition } from './satb-voice-recognition';
import { scaleConstruction } from './scale-construction';
import { termMeaning, termMeaningFlashcard } from './term-meaning';
import { tupletRecognition } from './tuplet-recognition';
import { transposingInstrument } from './transposing-instrument';
import type { GenerateOptions, Generator } from './types';

export const GENERATORS: Record<string, Generator> = {
  note_naming: noteNaming,
  interval_naming: intervalNaming,
  interval_naming_stave_input: intervalNamingStaveInput,
  rhythm_sum: rhythmSum,
  key_signature_id: keySignatureId,
  mode_swap: modeSwap,
  scale_construction: scaleConstruction,
  term_meaning: termMeaning,
  term_meaning_flashcard: termMeaningFlashcard,
  bar_validity: barValidity,
  add_time_signature: addTimeSignature,
  metre_classification: metreClassification,
  anacrusis_recognition: anacrusisRecognition,
  cadence_recognition: cadenceRecognition,
  scale_degree_id: scaleDegreeId,
  duplet_recognition: dupletRecognition,
  triplet_recognition: tripletRecognition,
  major_scale_steps: majorScaleSteps,
  tie_dot_value: tieDotValue,
  note_value_compare: noteValueCompare,
  music_in_context: findTheBar,
  octave_transposition: octaveTransposition,
  chromatic_scale: chromaticScale,
  degree_name_id: degreeNameId,
  chord_recognition: chordRecognition,
  ornament_recognition: ornamentRecognition,
  instrument_knowledge: instrumentKnowledge,
  enharmonic_recognition: enharmonicRecognition,
  rest_completion: restCompletion,
  clef_equivalence: clefEquivalence,
  transposing_instrument: transposingInstrument,
  tuplet_recognition: tupletRecognition,
  metre_rewrite: metreRewrite,
  satb_voice_recognition: satbVoiceRecognition,
};

export function generate(templateId: string, opts: GenerateOptions): ExerciseInstance {
  const generator = GENERATORS[templateId];
  if (!generator) throw new Error(`No generator registered for template_id "${templateId}"`);
  return generator(opts);
}
