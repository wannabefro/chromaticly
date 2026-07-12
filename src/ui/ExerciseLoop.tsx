// Exercise item shell (U6 reskin, design 2b/2c/2e): StrandChip + prompt + notation
// (NotationCard) + the interaction's own input UI, a Check button (disabled until
// canCheck), Hints, and the FeedbackSheet on grade. Flow is respond → Check →
// FeedbackSheet → Continue; onResult fires at Continue (once per item — SetRunner
// records the atom there, A2). Which component renders, how the response grades,
// and the correct-answer view are all looked up from the interaction registry
// (U3/AD1) keyed on `interaction.type` — no more a hardcoded isMcq boolean.
// Grading/labelling logic stays in grading.ts. The NotationCard (persistent WebView)
// stays mounted across items — item state resets without a remount (perf refactor).

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ExerciseInstance } from '../engine/schema';
import type { SrsGrade } from '../learn/srs';
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
   *  records the atom (A2) and advances to the next item. Never fires for a
   *  self-graded interaction (flashcard) — those report through `onSelfGrade`. */
  onResult: (result: AttemptResult) => void;
  /** Fired when a self-graded interaction (flashcard) reports its picked grade
   *  (U7). The shared Check button and correct/incorrect FeedbackSheet never
   *  render for these — `graded` stays null because nothing ever calls `check()`
   *  when `spec.submits` is false. */
  onSelfGrade?: (grade: SrsGrade) => void;
  /** Opt-in chrome suppression for the coached warm-up (U6). All default to the
   *  normal exercise look, so existing callers are unaffected. */
  showStrandChip?: boolean;
  showHints?: boolean;
  /** Rendered directly under the notation stimulus (the warm-up's play coach mark). */
  coachMark?: ReactNode;
  /** Override the FeedbackSheet message per outcome (warm-up coached copy). When a
   *  value is returned it replaces the instance's feedback copy for that outcome. */
  feedbackMessage?: (correct: boolean) => ReactNode;
}

export function ExerciseLoop({
  instance,
  onResult,
  onSelfGrade,
  showStrandChip = true,
  showHints = true,
  coachMark,
  feedbackMessage,
}: ExerciseLoopProps) {
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
      {showStrandChip && <StrandChip strand={strand} showGlyph />}
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

      {coachMark}

      <spec.Component
        instance={instance}
        response={response}
        graded={graded}
        strand={strand}
        onResponseChange={setResponse}
        onSelfGrade={onSelfGrade}
      />

      {showHints && <Hints hints={instance.hints} onHintUsed={handleHintUsed} />}

      {graded === null && spec.submits && (
        <Button label="Check" strand={strand} disabled={!canCheck} onPress={check} testID="check" />
      )}

      {graded !== null && (
        <FeedbackSheet
          kind={graded ? 'correct' : 'incorrect'}
          message={feedbackMessage?.(graded) ?? (graded ? instance.feedback.correct : instance.feedback.incorrect)}
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
