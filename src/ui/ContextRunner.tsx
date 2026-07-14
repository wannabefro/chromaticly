// Music in Context — the passage runner (design 4c/8d).
//
// One passage, several questions. The score is PINNED: it renders once at the top and
// stays there while only the question area swaps beneath it. That is the whole point
// of the screen — the learner reads one piece of music and is asked several things
// about it, rather than being handed four unrelated scores.
//
// Each sub-question is graded separately and worth one mark, with feedback shown
// immediately (this is practice; an exam would defer it — 8d). The passage keeps its
// own Q-counter, so "Q2 · 4" counts sub-questions, not items in the set.

import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ContextPassage } from '../engine/generators/context-passage';
import { Button } from './components/Button';
import { FeedbackSheet } from './components/FeedbackSheet';
import { NotationCard } from './components/NotationCard';
import { StrandChip } from './components/StrandChip';
import { type AttemptResult, toResult } from './grading';
import { lookupInteraction } from './interactions/registry';
import { colors, shape, type as typo, type Strand } from './theme';

export interface ContextRunnerProps {
  passage: ContextPassage;
  /** Fired once per sub-question, at Continue — each is its own mark and its own atom. */
  onSubResult: (result: AttemptResult) => void;
  /** Fired when the last sub-question is done; the passage is one item in the set. */
  onDone: (results: AttemptResult[]) => void;
}

export function ContextRunner({ passage, onSubResult, onDone }: ContextRunnerProps) {
  const [qIndex, setQIndex] = useState(0);
  const instance = passage.questions[qIndex];
  const spec = useMemo(() => lookupInteraction(instance.interaction.type), [instance.interaction.type]);
  const [response, setResponse] = useState<unknown>(() => spec.emptyResponse(instance));
  const [graded, setGraded] = useState<boolean | null>(null);
  const resultsRef = useRef<AttemptResult[]>([]);
  const strand = instance.strand as Strand;

  // Each sub-question starts clean — an earlier answer's selection must not carry over
  // into the next question about the same passage (8d: highlights clear between
  // questions). The score itself is untouched, so it never remounts.
  const [prev, setPrev] = useState(instance);
  if (instance !== prev) {
    setPrev(instance);
    setResponse(spec.emptyResponse(instance));
    setGraded(null);
  }

  const check = useCallback(() => {
    setGraded(Boolean(spec.grade(instance, response)));
  }, [spec, instance, response]);

  const handleContinue = useCallback(() => {
    const result = toResult(instance, graded ?? false, 0);
    resultsRef.current.push(result);
    onSubResult(result);

    const isLast = qIndex === passage.questions.length - 1;
    if (isLast) onDone(resultsRef.current);
    else setQIndex((i) => i + 1);
  }, [instance, graded, onSubResult, onDone, qIndex, passage.questions.length]);

  return (
    <View style={styles.container} testID="context-runner">
      {/* Pinned: the score does not scroll away, and does not remount between
          sub-questions — the same passage is what every question is about. */}
      <View style={styles.score}>
        <View style={styles.scoreHead}>
          <StrandChip strand={strand} showGlyph />
          <Text testID="context-count" style={styles.count}>
            Q{qIndex + 1} · {passage.questions.length}
          </Text>
        </View>
        <View testID="stimulus-music">
          <NotationCard music={passage.music} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.question}>
        <Text testID="prompt" style={styles.prompt}>
          {instance.prompt}
        </Text>

        <spec.Component
          instance={instance}
          response={response}
          graded={graded}
          strand={strand}
          onResponseChange={setResponse}
        />
      </ScrollView>

      {graded === null && spec.submits && (
        <View style={styles.footer}>
          <Button
            label="Check"
            strand={strand}
            disabled={!spec.canCheck(response)}
            onPress={check}
            testID="check"
          />
        </View>
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
  container: { flex: 1 },
  score: { paddingHorizontal: shape.spaceScreenX, paddingTop: shape.spaceInline, gap: shape.spaceInline },
  scoreHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { ...typo.label, color: colors.textMuted },
  question: { padding: shape.spaceScreenX, gap: shape.spaceCard },
  prompt: { ...typo.prompt, color: colors.text },
  footer: {
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceInline,
    paddingBottom: shape.spaceCard,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
