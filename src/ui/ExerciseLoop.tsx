// Exercise item shell (U6 reskin, design 2b/2c/2e): StrandChip + prompt + notation
// (NotationCard) + the interaction's own input UI, a Check button (disabled until
// canCheck), Hints, and the FeedbackSheet on grade. Flow is respond → Check →
// FeedbackSheet → Continue; onResult fires at Continue (once per item — SetRunner
// records the atom there, A2). Which component renders, how the response grades,
// and the correct-answer view are all looked up from the interaction registry
// (U3/AD1) keyed on `interaction.type` — no more a hardcoded isMcq boolean.
// Grading/labelling logic stays in grading.ts. The NotationCard (persistent WebView)
// stays mounted across items — item state resets without a remount (perf refactor).

import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ExerciseInstance } from '../engine/schema';
import { FeedbackSheet } from './components/FeedbackSheet';
import { NotationCard, type NotationCardHandle } from './components/NotationCard';
import { StrandChip } from './components/StrandChip';
import { Button } from './components/Button';
import { type AttemptResult, toResult } from './grading';
import { Hints } from './Hints';
import { lookupInteraction } from './interactions/registry';
import { colors, shape, type as typo, type Strand } from './theme';

export interface ExerciseLoopProps {
  instance: ExerciseInstance;
  /** Fired once, when the learner presses Continue on the FeedbackSheet. The parent
   *  records the atom (A2) and advances to the next item. */
  onResult: (result: AttemptResult) => void;
}

export function ExerciseLoop({ instance, onResult }: ExerciseLoopProps) {
  const spec = useMemo(() => lookupInteraction(instance.interaction.type), [instance.interaction.type]);
  const [response, setResponse] = useState<unknown>(() => spec.emptyResponse(instance));
  const [graded, setGraded] = useState<boolean | null>(null);
  const hintsUsedRef = useRef(0);
  const surfaceRef = useRef<NotationCardHandle>(null);

  // Reset item state when the instance changes — without remounting, so the
  // NotationCard's WebView (warm abcjs/synth) persists across items.
  const [prev, setPrev] = useState(instance);
  if (instance !== prev) {
    setPrev(instance);
    setResponse(spec.emptyResponse(instance));
    setGraded(null);
    hintsUsedRef.current = 0;
  }

  const strand = instance.strand as Strand;
  const canCheck = spec.canCheck(response);

  const check = useCallback(() => {
    setGraded(Boolean(spec.grade(instance, response)));
  }, [spec, instance, response]);

  const handleContinue = useCallback(() => {
    onResult(toResult(instance, graded ?? false, hintsUsedRef.current));
  }, [onResult, instance, graded]);

  const handleHintUsed = useCallback((count: number) => {
    hintsUsedRef.current = count;
  }, []);

  const music = instance.stimulus.music;

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

      <spec.Component instance={instance} response={response} graded={graded} strand={strand} onResponseChange={setResponse} />

      <Hints hints={instance.hints} onHintUsed={handleHintUsed} />

      {graded === null && spec.submits && (
        <Button label="Check" strand={strand} disabled={!canCheck} onPress={check} testID="check" />
      )}

      {graded !== null && (
        <FeedbackSheet
          kind={graded ? 'correct' : 'incorrect'}
          message={graded ? instance.feedback.correct : instance.feedback.incorrect}
          correctAnswer={graded ? undefined : spec.correctAnswerView(instance)}
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
});
