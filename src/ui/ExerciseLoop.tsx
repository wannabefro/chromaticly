// Exercise item shell (U6 reskin, design 2b/2c/2e): StrandChip + prompt + notation
// (NotationCard) + AnswerOption grid, a Check button (disabled until a pick), Hints,
// and the FeedbackSheet on grade. Flow is select → Check → FeedbackSheet → Continue;
// onResult fires at Continue (once per item — SetRunner records the atom there, A2).
// Grading/labelling logic stays in grading.ts. The NotationCard (persistent WebView)
// stays mounted across items — item state resets without a remount (perf refactor).

import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';

import type { ExerciseInstance } from '../engine/schema';
import { FeedbackSheet } from './components/FeedbackSheet';
import { NotationCard, type NotationCardHandle } from './components/NotationCard';
import { StrandChip } from './components/StrandChip';
import { Button } from './components/Button';
import { type AttemptResult, assembleOptions, gradeMcq, gradeText, optionLabel, toResult } from './grading';
import { Hints } from './Hints';
import { Mcq } from './interactions/Mcq';
import { colors, shape, type as typo, type Strand } from './theme';

export interface ExerciseLoopProps {
  instance: ExerciseInstance;
  /** Fired once, when the learner presses Continue on the FeedbackSheet. The parent
   *  records the atom (A2) and advances to the next item. */
  onResult: (result: AttemptResult) => void;
}

export function ExerciseLoop({ instance, onResult }: ExerciseLoopProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [textValue, setTextValue] = useState('');
  const [graded, setGraded] = useState<boolean | null>(null);
  const hintsUsedRef = useRef(0);
  const surfaceRef = useRef<NotationCardHandle>(null);

  // Reset item state when the instance changes — without remounting, so the
  // NotationCard's WebView (warm abcjs/synth) persists across items.
  const [prev, setPrev] = useState(instance);
  if (instance !== prev) {
    setPrev(instance);
    setSelectedIndex(null);
    setTextValue('');
    setGraded(null);
    hintsUsedRef.current = 0;
  }

  const options = useMemo(() => assembleOptions(instance), [instance]);
  const strand = instance.strand as Strand;
  const isMcq = instance.interaction.type !== 'text_input';
  const canCheck = isMcq ? selectedIndex !== null : textValue.trim().length > 0;

  const check = useCallback(() => {
    const correct = isMcq
      ? gradeMcq(instance, options[selectedIndex ?? 0].value)
      : gradeText(instance, textValue);
    setGraded(correct);
  }, [isMcq, instance, options, selectedIndex, textValue]);

  const handleContinue = useCallback(() => {
    onResult(toResult(instance, graded ?? false, hintsUsedRef.current));
  }, [onResult, instance, graded]);

  const handleHintUsed = useCallback((count: number) => {
    hintsUsedRef.current = count;
  }, []);

  const music = instance.stimulus.music;
  const answerLabel = optionLabel(instance.answer.canonical);

  return (
    <View style={styles.container}>
      <StrandChip strand={strand} showGlyph />
      <Text testID="prompt" style={styles.prompt}>
        {instance.prompt}
      </Text>

      {music ? (
        <View testID="stimulus-music">
          <NotationCard ref={surfaceRef} music={music} />
        </View>
      ) : (
        instance.stimulus.text != null && (
          <Text testID="stimulus-text" style={styles.stimulusText}>
            {instance.stimulus.text}
          </Text>
        )
      )}

      {isMcq ? (
        <Mcq options={options} selectedIndex={selectedIndex} graded={graded} strand={strand} onSelectIndex={setSelectedIndex} />
      ) : (
        <RNTextInput
          testID="text-input"
          style={styles.input}
          value={textValue}
          onChangeText={setTextValue}
          editable={graded === null}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Type your answer"
          placeholderTextColor={colors.textFaint}
        />
      )}

      <Hints hints={instance.hints} onHintUsed={handleHintUsed} />

      {graded === null && (
        <Button label="Check" strand={strand} disabled={!canCheck} onPress={check} testID="check" />
      )}

      {graded !== null && (
        <FeedbackSheet
          kind={graded ? 'correct' : 'incorrect'}
          message={graded ? instance.feedback.correct : instance.feedback.incorrect}
          correctAnswer={
            graded ? undefined : music ? (
              <NotationCard music={music} caption={answerLabel} testID="answer-notation" />
            ) : (
              <Text testID="answer-label" style={styles.answerLabel}>
                {answerLabel}
              </Text>
            )
          }
          onContinue={handleContinue}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: shape.spaceCard, paddingHorizontal: shape.spaceScreenX, paddingVertical: shape.spaceCard },
  prompt: { ...typo.prompt, color: colors.text },
  stimulusText: { ...typo.title, color: colors.text, textAlign: 'center' },
  input: {
    borderWidth: shape.borderW,
    borderColor: colors.border,
    borderRadius: shape.radiusControl,
    padding: shape.spaceInline,
    color: colors.text,
    ...typo.option,
  },
  answerLabel: { ...typo.title, color: colors.text },
});
