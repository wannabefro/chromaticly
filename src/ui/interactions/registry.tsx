// Partial interaction→component registry (U3/AD1): keyed on interaction.type,
// replacing ExerciseLoop's old `isMcq = interaction.type !== 'text_input'`
// boolean and its four dependents (canCheck, check(), the render branch, the
// FeedbackSheet correct-answer branch). Deliberately a *partial* map — the
// schema's interaction.type enum carries values with no runtime support yet
// (multi_select, drag_match, grid_fill, roman_numeral_boxes), and a full Record
// would force dummy entries or type lies. lookupInteraction fails loud on an
// unregistered/unsupported type; it never silently falls back to <Mcq>.
//
// Zero behavior change for mcq/text_input (characterization: registry.test.ts) —
// this unit only relocates the existing dispatch, it does not alter grading.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ExerciseInstance, InteractionType } from '../../engine/schema';
import type { Duration, Music } from '../../music/types';
import { NotationCard } from '../components/NotationCard';
import { assembleOptions, gradeMcq, gradeStaveInput, gradeText, gradeTrueFalse, optionLabel } from '../grading';
import { colors, shape, type as typo } from '../theme';
import { FindTheBar, type FindTheBarResponse } from './FindTheBar';
import { Flashcard, type FlashcardResponse } from './Flashcard';
import { Mcq } from './Mcq';
import { StaveInput, type StaveInputResponse } from './StaveInput';
import { TextInputField } from './TextInputField';
import { TrueFalse, type TrueFalseResponse } from './TrueFalse';
import type { InteractionComponentProps, InteractionSpec } from './types';

/** The correct-answer render shared by mcq/text_input today: the canonical
 *  answer's label, or — when the stimulus carries notation — that notation on
 *  paper with the label as caption (rule 1/2). Lifted verbatim from the old
 *  ExerciseLoop FeedbackSheet branch (`:110-125`).
 *
 *  D8: for a spot-the-error item, the stimulus IS the corrupted music, so a
 *  generator may instead set `interaction.config.answer_music` to the
 *  rendered CORRECT answer (rule 5) — preferred over stimulus music when
 *  present. Additive only: no existing template sets this key. */
function defaultCorrectAnswerView(instance: ExerciseInstance) {
  const answerMusic = instance.interaction.config?.answer_music as Music | undefined;
  const music = answerMusic ?? instance.stimulus.music;
  const answerLabel = optionLabel(instance.answer.canonical);
  return music ? (
    <NotationCard music={music} caption={answerLabel} testID="answer-notation" />
  ) : (
    <Text testID="answer-label" style={styles.answerLabel}>
      {answerLabel}
    </Text>
  );
}

function McqInteraction({ instance, response, graded, strand, onResponseChange }: InteractionComponentProps<number | null>) {
  const options = useMemo(() => assembleOptions(instance), [instance]);
  return <Mcq options={options} selectedIndex={response} graded={graded} strand={strand} onSelectIndex={onResponseChange} />;
}

/** A notation-answer MCQ's FeedbackSheet shows the correct OPTION's rendered
 *  stave (AD5/F9) — not the stimulus music, which may differ from what the
 *  options render (and, unlike an option, always carries play — rule 2/9). */
function mcqCorrectAnswerView(instance: ExerciseInstance) {
  const correctOption = assembleOptions(instance).find((o) => o.correct);
  if (correctOption?.music) {
    return <NotationCard music={correctOption.music} caption={optionLabel(correctOption.value)} testID="answer-notation" />;
  }
  return defaultCorrectAnswerView(instance);
}

const mcqSpec: InteractionSpec<number | null> = {
  Component: McqInteraction,
  emptyResponse: () => null,
  canCheck: (response) => response !== null,
  grade: (instance, response) => gradeMcq(instance, assembleOptions(instance)[response ?? 0].value),
  submits: true,
  correctAnswerView: mcqCorrectAnswerView,
};

const textInputSpec: InteractionSpec<string> = {
  Component: TextInputField,
  emptyResponse: () => '',
  canCheck: (response) => response.trim().length > 0,
  grade: (instance, response) => gradeText(instance, response),
  submits: true,
  correctAnswerView: defaultCorrectAnswerView,
};

/** Bar count comes from the bar-identity metadata (F10), falling back to
 *  answer.per_item's length — never from anything geometry-derived. */
function trueFalseBarCount(instance: ExerciseInstance): number {
  const bars = instance.interaction.config?.bars;
  if (Array.isArray(bars)) return bars.length;
  return Array.isArray(instance.answer.per_item) ? instance.answer.per_item.length : 0;
}

/** The per-bar correct-answer strip shown on the FeedbackSheet for a wrong
 *  attempt: each bar's correct tick/cross verdict, read-only. */
function trueFalseCorrectAnswerView(instance: ExerciseInstance) {
  const perItem = (instance.answer.per_item ?? []) as boolean[];
  return (
    <View style={styles.trueFalseAnswer} testID="true-false-correct-answer">
      {perItem.map((verdict, index) => (
        <Text key={index} style={[styles.trueFalseAnswerBar, { color: verdict ? colors.correct : colors.incorrect }]}>
          {`Bar ${index + 1} ${verdict ? '✓' : '✗'}`}
        </Text>
      ))}
    </View>
  );
}

const trueFalseSpec: InteractionSpec<TrueFalseResponse> = {
  Component: TrueFalse,
  emptyResponse: (instance) => Array.from({ length: trueFalseBarCount(instance) }, () => null),
  canCheck: (response) => response.length > 0 && response.every((v) => v !== null),
  grade: (instance, response) => gradeTrueFalse(instance, response as boolean[]),
  submits: true,
  correctAnswerView: trueFalseCorrectAnswerView,
};

// U7: flashcard is self-graded — grade() always returns null (no correct/
// incorrect verdict) and submits is false (it owns its own submission via the
// 4 grade buttons -> onSelfGrade, not the shared Check button). canCheck is
// never read as a result (the Check button is hidden whenever submits is
// false) but the protocol still requires a value.
const flashcardSpec: InteractionSpec<FlashcardResponse> = {
  Component: Flashcard,
  emptyResponse: () => ({ revealed: false, picked: null }),
  canCheck: () => false,
  grade: () => null,
  submits: false,
  correctAnswerView: defaultCorrectAnswerView,
};

// U8/RD2: interval_naming_stave_input's only write-item — a single {pitch,
// dur} target — so the FeedbackSheet's correct-answer render builds a
// one-note Music from the semantic canonical (never deep-equalled, AD5) using
// the same clef/key signature as the given-note stimulus.
function staveInputCorrectAnswerView(instance: ExerciseInstance) {
  const stimulusMusic = instance.stimulus.music as Music | null;
  const canonical = instance.answer.canonical as { pitch: string; dur: Duration };
  const targetMusic: Music = {
    clef: stimulusMusic?.clef ?? 'treble',
    key_sig: stimulusMusic?.key_sig ?? null,
    time_sig: null,
    voices: [{ events: [{ type: 'note', pitch: canonical.pitch, dur: canonical.dur }] }],
  };
  return <NotationCard music={targetMusic} caption={`${canonical.pitch} · ${canonical.dur}`} testID="answer-notation" />;
}

const staveInputSpec: InteractionSpec<StaveInputResponse> = {
  Component: StaveInput,
  emptyResponse: () => null,
  canCheck: (response) => response !== null,
  grade: (instance, response) => gradeStaveInput(instance, response),
  submits: true,
  correctAnswerView: staveInputCorrectAnswerView,
};

// Stored as InteractionSpec<any> — each entry's Response type differs (a selected
// index, raw text, later a boolean[] or a self-grade enum), and Response appears
// nested inside Component's props object, which TS checks structurally rather
// than bivariantly, so a bare `InteractionSpec` (Response=unknown) rejects the
// heterogeneous assignment. `lookupInteraction` narrows back to the safe
// Response=unknown contract at the boundary, so callers never see `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
/** The wrong bar is corrected by pointing at the passage itself — the score on
 *  paper, captioned with the bar that actually held it (rules 1/2/5). */
function findTheBarCorrectAnswerView(instance: ExerciseInstance) {
  const music = instance.stimulus.music;
  const bar = optionLabel(instance.answer.canonical);
  return music ? (
    <NotationCard music={music} caption={`Bar ${bar}`} testID="answer-notation" />
  ) : (
    <Text testID="answer-label" style={styles.answerLabel}>{`Bar ${bar}`}</Text>
  );
}

const findTheBarSpec: InteractionSpec<FindTheBarResponse> = {
  Component: FindTheBar,
  emptyResponse: () => null,
  canCheck: (response) => response !== null,
  grade: (instance, response) => gradeMcq(instance, response),
  submits: true,
  correctAnswerView: findTheBarCorrectAnswerView,
  // Design 4c: tapping a bar in the score is the same answer as tapping the strip,
  // and the chosen bar is tinted in the notation.
  onSurfaceTap: (bar) => bar,
  surfaceHighlight: (response) => response,
};

export const INTERACTIONS: Partial<Record<InteractionType, InteractionSpec<any>>> = {
  mcq: mcqSpec,
  text_input: textInputSpec,
  true_false: trueFalseSpec,
  flashcard: flashcardSpec,
  stave_input: staveInputSpec,
  find_the_bar: findTheBarSpec,
};

/** Fail-loud lookup — an unregistered/unsupported interaction.type throws rather
 *  than silently falling back to a default component (AD1). */
export function lookupInteraction(type: InteractionType): InteractionSpec {
  const spec = INTERACTIONS[type];
  if (!spec) {
    throw new Error(
      `No interaction registered for type "${type}" — supported: ${Object.keys(INTERACTIONS).join(', ')}`,
    );
  }
  return spec;
}

const styles = StyleSheet.create({
  answerLabel: { ...typo.title, color: colors.text },
  trueFalseAnswer: { flexDirection: 'row', flexWrap: 'wrap', gap: shape.spaceInline },
  trueFalseAnswerBar: { ...typo.label },
});
