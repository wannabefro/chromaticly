// Exercise item shell (U6 reskin, design 2b/2c/2e): StrandChip + prompt + notation
// (NotationCard) + the interaction's own input UI, a Check button (disabled until
// canCheck), Hints, and the FeedbackSheet on grade. Flow is respond → Check →
// FeedbackSheet → Continue; onResult fires at Continue (once per item — SetRunner
// records the atom there, A2). Which component renders, how the response grades,
// and the correct-answer view are all looked up from the interaction registry
// (U3/AD1) keyed on `interaction.type` — no more a hardcoded isMcq boolean.
// Grading/labelling logic stays in grading.ts. The NotationCard (persistent WebView)
// stays mounted across items — item state resets without a remount (perf refactor).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ExerciseInstance } from '../engine/schema';
import type { SrsGrade } from '../learn/srs';
import type { SurfaceEvent } from '../music-surface/bridge';
import type { Music } from '../music/types';
import { FeedbackSheet } from './components/FeedbackSheet';
import { NotationCard, type NotationCardHandle } from './components/NotationCard';
import { RhythmSumStimulus } from './components/RhythmSumStimulus';
import { OrnamentCard } from './components/OrnamentCard';
import { StrandChip } from './components/StrandChip';
import { Button } from './components/Button';
import { type AttemptResult, toResult } from './grading';
import { Hints } from './Hints';
import { lookupInteraction } from './interactions/registry';
import { colors, shape, strandDef, type as typo, type Strand } from './theme';

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
  // D6 no-grade-laundering: once any check on this item has failed, the item's
  // eventual result is `correct: false` even if a later fix-mode re-check passes
  // (mastery/SRS must not credit a repaired attempt as a clean pass).
  const [everFailed, setEverFailed] = useState(false);
  const hintsUsedRef = useRef(0);
  const surfaceRef = useRef<NotationCardHandle>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Reset item state when the instance changes — without remounting, so the
  // NotationCard's WebView (warm abcjs/synth) persists across items.
  const [prev, setPrev] = useState(instance);
  if (instance !== prev) {
    setPrev(instance);
    setResponse(spec.emptyResponse(instance));
    setGraded(null);
    setEverFailed(false);
    hintsUsedRef.current = 0;
  }

  // Nothing remounts between items, so the scroll offset would otherwise carry
  // over and open the next item half-way down, prompt and notation off-screen.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [instance]);

  const strand = instance.strand as Strand;
  const hue = strandDef(strand).hue;
  const canCheck = spec.canCheck(response);

  // Design 4c: a tap on a bar IN the score is the same answer as the bar strip, and the
  // chosen bar is tinted. The loop stays interaction-agnostic — only an interaction that
  // implements onSurfaceTap/surfaceHighlight (find-the-bar) participates.
  const handleSurfaceEvent = useCallback(
    (ev: SurfaceEvent) => {
      if (ev.type === 'barTapped' && graded === null && spec.onSurfaceTap) {
        setResponse((prev: unknown) => spec.onSurfaceTap!(ev.bar, prev));
      }
    },
    [spec, graded],
  );

  useEffect(() => {
    surfaceRef.current?.highlightBar(spec.surfaceHighlight?.(response) ?? null, hue);
  }, [spec, response, hue]);

  // D9 "hear yours": an answer card (e.g. transposition_input) builds its own
  // Music and plays it through the persistent STIMULUS surface — no second
  // WebView. Only handed down when a stimulus surface is actually mounted.
  const handlePlayMusic = useCallback((responseMusic: Music) => {
    surfaceRef.current?.playMusic(responseMusic);
  }, []);

  const check = useCallback(() => {
    const verdict = Boolean(spec.grade(instance, response));
    if (!verdict) setEverFailed(true);
    setGraded(verdict);
  }, [spec, instance, response]);

  const handleFix = useCallback(() => {
    if (!spec.beginFix) return;
    setResponse(spec.beginFix(instance, response));
    setGraded(null);
  }, [spec, instance, response]);

  const handleContinue = useCallback(() => {
    onResult(toResult(instance, graded === true && !everFailed, hintsUsedRef.current));
  }, [onResult, instance, graded, everFailed]);

  const handleHintUsed = useCallback((count: number) => {
    hintsUsedRef.current = count;
  }, []);

  const music = instance.stimulus.music;
  // Musical sums render the operands as rhythm glyphs with +/= operators
  // (chromaticly-f9k), not a single stave — a dedicated worksheet stimulus.
  const sumOperands = instance.interaction.config?.sum_operands as Music[] | undefined;
  // An ornament stimulus carries `interaction.config.ornament` (the kind) and
  // renders the split enlarged-symbol card (design 10b) instead of the plain
  // NotationCard — its sign needs the hero + in-context presentation.
  const isOrnament = instance.interaction.config?.ornament != null;
  // The amber partial sheet is only for some-right-some-wrong (D5) — an all-wrong
  // attempt still routes to the plain incorrect sheet below.
  const partialSummary = graded === false ? (spec.partialFeedback?.(instance, response) ?? null) : null;

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.body}>
        {showStrandChip && <StrandChip strand={strand} showGlyph />}
        <Text testID="prompt" style={styles.prompt}>
          {instance.prompt}
        </Text>

        {sumOperands ? (
          <View testID="stimulus-music">
            <RhythmSumStimulus operands={sumOperands} strand={strand} label={instance.stimulus.text ?? undefined} />
          </View>
        ) : music ? (
          <View testID="stimulus-music">
            {isOrnament ? (
              <OrnamentCard ref={surfaceRef} music={music} onEvent={handleSurfaceEvent} />
            ) : (
              <NotationCard ref={surfaceRef} music={music} onEvent={handleSurfaceEvent} />
            )}
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
          onPlayMusic={music ? handlePlayMusic : undefined}
        />

        {showHints && <Hints hints={instance.hints} onHintUsed={handleHintUsed} />}
      </ScrollView>

      {/* Sticky, so it stays reachable however tall the options grow (notation
          answers are full staves and overflow the screen). */}
      {graded === null && spec.submits && (
        <View style={styles.footer}>
          <Button
            label={spec.checkLabel?.(instance, response) ?? 'Check'}
            strand={strand}
            disabled={!canCheck}
            onPress={check}
            testID="check"
          />
        </View>
      )}

      {graded !== null && partialSummary != null ? (
        <FeedbackSheet
          kind="partial"
          badgeLabel={`${partialSummary.correct}/${partialSummary.total}`}
          message={partialSummary.message}
          secondaryAction={spec.beginFix ? { label: partialSummary.fixLabel, onPress: handleFix } : undefined}
          onContinue={handleContinue}
        />
      ) : (
        graded !== null && (
          <FeedbackSheet
            kind={graded ? 'correct' : 'incorrect'}
            message={feedbackMessage?.(graded) ?? (graded ? instance.feedback.correct : instance.feedback.incorrect)}
            correctAnswer={graded ? undefined : spec.correctAnswerView(instance, response)}
            onContinue={handleContinue}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { gap: shape.spaceCard, paddingHorizontal: shape.spaceScreenX, paddingVertical: shape.spaceCard },
  footer: {
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceInline,
    paddingBottom: shape.spaceCard,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  prompt: { ...typo.prompt, color: colors.text },
  stimulusText: { ...typo.title, color: colors.text, textAlign: 'center' },
});
