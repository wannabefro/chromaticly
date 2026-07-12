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
import { StyleSheet, Text } from 'react-native';

import type { ExerciseInstance, InteractionType } from '../../engine/schema';
import { NotationCard } from '../components/NotationCard';
import { assembleOptions, gradeMcq, gradeText, optionLabel } from '../grading';
import { colors, type as typo } from '../theme';
import { Mcq } from './Mcq';
import { TextInputField } from './TextInputField';
import type { InteractionComponentProps, InteractionSpec } from './types';

/** The correct-answer render shared by mcq/text_input today: the canonical
 *  answer's label, or — when the stimulus carries notation — that notation on
 *  paper with the label as caption (rule 1/2). Lifted verbatim from the old
 *  ExerciseLoop FeedbackSheet branch (`:110-125`). */
function defaultCorrectAnswerView(instance: ExerciseInstance) {
  const music = instance.stimulus.music;
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

// Stored as InteractionSpec<any> — each entry's Response type differs (a selected
// index, raw text, later a boolean[] or a self-grade enum), and Response appears
// nested inside Component's props object, which TS checks structurally rather
// than bivariantly, so a bare `InteractionSpec` (Response=unknown) rejects the
// heterogeneous assignment. `lookupInteraction` narrows back to the safe
// Response=unknown contract at the boundary, so callers never see `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const INTERACTIONS: Partial<Record<InteractionType, InteractionSpec<any>>> = {
  mcq: mcqSpec,
  text_input: textInputSpec,
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
});
