// Coached warm-up (design screens 4–5, "steps 4–5"): a 3-question on-ramp that
// draws the learner's first real mastery point (R4, R5). It reuses
// ExerciseLoop for the item shell but is NOT SetRunner — no 8-item set, no lesson
// completion/unlock (KTD3). Distinct chrome: a 1/3 counter, one play coach mark,
// the "no streaks or timers yet" caption, and zero gamification.
//
// Retry-until-correct (KTD3b): an incorrect answer re-presents the same item
// rather than advancing, so the loop always ends 3/3 and the atom's 3-in-a-row
// mastery (its first Rhythm point) is guaranteed. Every attempt is recorded, so
// the SRS/mastery state is honest; the last three attempts are always correct.
//
// AD6: the current item + progress are real component state (index/attempt), never
// derived in render from the mutable store, so the loop stays reactive on device.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { generate } from '../engine/generators';
import { useProgressContext } from '../learn/ProgressContext';
import { warmUpFor } from '../learn/warm-up';
import { type GemState } from './components/MasteryGems';
import { ExerciseLoop } from './ExerciseLoop';
import { type AttemptResult } from './grading';
import { Screen } from './Screen';
import { colors, shape, strandDef, type, type Strand } from './theme';

const TOTAL = 3;

export interface CoachedWarmUpProps {
  /** One gem per item, in order: clean if it was answered first try, hinted if retried. */
  onComplete: (gems: GemState[]) => void;
  onClose?: () => void;
  /** The level the learner just chose. It selects the atom — a First steps learner
   *  must not be opened with notation they have never been taught to read. */
  grade?: number | null;
}

export function CoachedWarmUp({ onComplete, onClose, grade }: CoachedWarmUpProps) {
  const { recordAtom, clock } = useProgressContext();
  const warmUp = warmUpFor(grade);
  const def = strandDef(warmUp.strand as Strand);
  const [index, setIndex] = useState(0);
  const [gems, setGems] = useState<GemState[]>([]);
  // Bumped on an incorrect answer to regenerate the same-seed item with a fresh
  // object identity, so ExerciseLoop resets and re-presents it (retry, KTD3b).
  const [attempt, setAttempt] = useState(0);

  const instance = useMemo(
    // The generator grade comes from the warm-up definition, not from the learner
    // (D11): it must be a grade whose scope the atom is legal in, which is not
    // always the grade they picked.
    () => generate(warmUp.template, { grade: warmUp.grade, seed: warmUp.seeds[index], atoms: [warmUp.atom] }),
    // attempt is the retry signal — same seed, new identity. eslint-disable-next-line react-hooks/exhaustive-deps
    [index, attempt, warmUp],
  );

  async function handleResult(result: AttemptResult) {
    await recordAtom(warmUp.atom, result, clock.now());
    if (!result.correct) {
      setAttempt((a) => a + 1); // re-present the same question; do not advance
      return;
    }
    // attempt is still 0 here on a first-try answer; it resets only when we advance.
    const next: GemState[] = [...gems, attempt === 0 ? 'clean' : 'hinted'];
    if (index >= TOTAL - 1) {
      onComplete(next);
      return;
    }
    setGems(next);
    setIndex((i) => i + 1);
    setAttempt(0);
  }

  const feedbackMessage = (correct: boolean) =>
    correct ? (
      <View style={styles.feedback}>
        <Text style={styles.feedbackLead}>
          {index === 0 ? 'First one down!' : `Nice — ${index + 1} of ${TOTAL}.`}
        </Text>
        <Text style={styles.feedbackWhy}>{instance.feedback.correct}</Text>
        <Text style={[styles.feedbackPoint, { color: def.hue }]}>
          📈 {index === 0 ? `Your ${def.short} mastery just drew its first point.` : `Your ${def.short} mastery is climbing.`}
        </Text>
      </View>
    ) : undefined;

  return (
    <Screen style={styles.screen} testID="warm-up-screen">
      <View style={styles.header}>
        <Pressable testID="warmup-close" onPress={onClose} hitSlop={12} style={styles.close}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
        <Text testID="warmup-count" style={styles.count}>
          {index + 1}/{TOTAL}
        </Text>
        <View style={styles.close} />
      </View>

      <ExerciseLoop
        instance={instance}
        onResult={handleResult}
        showStrandChip={false}
        showHints={false}
        coachMark={
          // Only on an item that draws a play control. `alphabet_step` has no
          // notation and no audio, so the promise would point at nothing.
          index === 0 && instance.stimulus.music != null ? (
            <Text testID="warmup-coach" style={[styles.coach, { color: def.hue }]}>
              Tap play — you can always hear it
            </Text>
          ) : undefined
        }
        feedbackMessage={feedbackMessage}
      />

      <Text style={styles.reassurance}>no streaks or timers yet — just try it</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceTight,
  },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { ...type.title, color: colors.textMuted },
  count: { ...type.label, color: colors.textMuted },
  coach: {
    ...type.label,
    textAlign: 'center',
  },
  reassurance: {
    ...type.body,
    color: colors.textFaint,
    textAlign: 'center',
    paddingBottom: shape.spaceStack,
  },
  feedback: { gap: shape.spaceSnug },
  feedbackLead: { ...type.cardTitle, color: colors.text },
  feedbackWhy: { ...type.body, color: colors.text },
  feedbackPoint: { ...type.option },
});
