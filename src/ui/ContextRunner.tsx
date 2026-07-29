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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ContextPassage } from '../engine/generators/context-passage';
import type { SurfaceEvent } from '../music-surface/bridge';
import { Button } from './components/Button';
import { FeedbackSheet } from './components/FeedbackSheet';
import { NotationCard, type NotationCardHandle } from './components/NotationCard';
import { StrandChip } from './components/StrandChip';
import { type AttemptResult, toResult } from './grading';
import { lookupInteraction } from './interactions/registry';
import { colors, fonts, shape, strandDef, type as typo, type Strand } from './theme';

export interface ContextRunnerProps {
  passage: ContextPassage;
  /** Fired once per sub-question, at Continue — each is its own mark and its own atom. */
  onSubResult: (result: AttemptResult) => void;
  /** Fired when the last sub-question is done; the passage is one item in the set. */
  onDone: (results: AttemptResult[]) => void;
  /** The warm-up item (chromaticly-inr). A passage is one item of the set like
   *  any other, so the first passage of a set is the try. Only the caption is
   *  carried across — the sub-questions keep their own hints, because a passage
   *  already asks four graded things and pre-opening one tip would speak for
   *  only one of them. */
  warmUp?: boolean;
}

export function ContextRunner({ passage, onSubResult, onDone, warmUp = false }: ContextRunnerProps) {
  const [qIndex, setQIndex] = useState(0);
  const instance = passage.questions[qIndex];
  const spec = useMemo(() => lookupInteraction(instance.interaction.type), [instance.interaction.type]);
  const [response, setResponse] = useState<unknown>(() => spec.emptyResponse(instance));
  const [graded, setGraded] = useState<boolean | null>(null);
  const resultsRef = useRef<AttemptResult[]>([]);
  const surfaceRef = useRef<NotationCardHandle>(null);
  const strand = instance.strand as Strand;
  const hue = strandDef(strand).hue;

  // Each sub-question starts clean — an earlier answer's selection must not carry over
  // into the next question about the same passage (8d: highlights clear between
  // questions). The score itself is untouched, so it never remounts.
  const [prev, setPrev] = useState(instance);
  if (instance !== prev) {
    setPrev(instance);
    setResponse(spec.emptyResponse(instance));
    setGraded(null);
  }

  // Design 4c's signature interaction: tap a bar IN the pinned score. The passage runner
  // owns the score (not ExerciseLoop), so the score-tap must be wired here — a tap on a
  // find-the-bar sub-question becomes the answer, and the chosen bar is tinted.
  const handleSurfaceEvent = useCallback(
    (ev: SurfaceEvent) => {
      if (ev.type === 'barTapped' && graded === null && spec.onSurfaceTap) {
        setResponse((r: unknown) => spec.onSurfaceTap!(ev.bar, r));
      }
    },
    [spec, graded],
  );

  useEffect(() => {
    surfaceRef.current?.highlightBar(spec.surfaceHighlight?.(response) ?? null, hue);
  }, [spec, response, hue]);

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
          {warmUp && (
            <Text style={styles.warmUpCaption} testID="warmup-caption">
              this one doesn&apos;t count
            </Text>
          )}
        </View>
        <View testID="stimulus-music">
          <NotationCard ref={surfaceRef} music={passage.music} onEvent={handleSurfaceEvent} />
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
  warmUpCaption: { ...typo.label, fontFamily: fonts.mono, color: colors.textGhost },
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
