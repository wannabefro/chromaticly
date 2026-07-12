// SetRunner (U7): drives a fixed 8-item set for a lesson (design 2b header → items
// → 2f). Generates items from the lesson's first template (seeds 0..7), feeds
// ExerciseLoop, and on each Continue records the atom exactly once (A2) and the
// per-item mastery gem. On the 8th it marks the lesson complete once (A2) and shows
// SetComplete. The notation surface persists across items (perf refactor).

import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Lesson } from '../content/lessons';
import { generate } from '../engine/generators';
import { emptySet, gems, isComplete, recordItem, score, segmentStates, SET_SIZE, type ExerciseSetState } from '../learn/exercise-set';
import { useProgressContext } from '../learn/ProgressContext';
import type { SrsGrade } from '../learn/srs';
import { ExerciseLoop } from './ExerciseLoop';
import { ProgressSegments } from './components/ProgressSegments';
import { SetComplete } from './SetComplete';
import type { AttemptResult } from './grading';
import { Screen } from './Screen';
import { colors, shape, type as typo, type Strand } from './theme';

export interface SetRunnerProps {
  lesson: Lesson;
  onDone?: () => void;
}

export function SetRunner({ lesson, onDone }: SetRunnerProps) {
  const { recordAtom, recordFlashcardGrade, complete } = useProgressContext();
  const [itemIndex, setItemIndex] = useState(0);
  const [setState, setSetState] = useState(emptySet());
  const [done, setDone] = useState(false);
  const tickRef = useRef(0);
  const strand = lesson.strand as Strand;

  const instance = useMemo(
    () => generate(lesson.templates[0], { grade: 1, seed: itemIndex }),
    [lesson, itemIndex],
  );

  // Shared by both the checked (handleResult) and self-graded (handleSelfGrade)
  // paths: fold one item's gem into the set and either advance or complete the
  // lesson exactly once (A2) — the only thing that differs between them is how
  // the atom itself gets recorded (recordAtom vs recordFlashcardGrade, AD4b).
  const advance = useCallback(
    async (nextState: ExerciseSetState) => {
      setSetState(nextState);
      if (isComplete(nextState)) {
        await complete(lesson); // A2: complete the lesson exactly once
        setDone(true);
      } else {
        setItemIndex((i) => i + 1);
      }
    },
    [complete, lesson],
  );

  const handleResult = useCallback(
    async (result: AttemptResult) => {
      const atom = instance.srs_tags[0];
      await recordAtom(atom, result, tickRef.current++); // A2: record the atom once, here
      await advance(recordItem(setState, result));
    },
    [instance, recordAtom, setState, advance],
  );

  // U7/AD4b: a flashcard has no correct/incorrect verdict, so it never reaches
  // handleResult — Good/Easy count as a clean gem, Hard as hinted, Again as
  // missed, mirroring the same mapping recordFlashcardGrade applies to mastery.
  const handleSelfGrade = useCallback(
    async (grade: SrsGrade) => {
      const atom = instance.srs_tags[0];
      await recordFlashcardGrade(atom, grade, tickRef.current++);
      await advance(recordItem(setState, { correct: grade !== 'again', hintsUsed: grade === 'hard' ? 1 : 0 }));
    },
    [instance, recordFlashcardGrade, setState, advance],
  );

  if (done) {
    return (
      <Screen>
        <SetComplete gems={gems(setState)} score={score(setState)} total={SET_SIZE} strand={strand} onNext={() => onDone?.()} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen} testID="set-runner">
      <View style={styles.header}>
        <Pressable testID="set-close" onPress={() => onDone?.()} hitSlop={12}>
          <Text style={styles.close}>×</Text>
        </Pressable>
        <View style={styles.segments}>
          <ProgressSegments states={segmentStates(setState)} strand={strand} />
        </View>
        <Text style={styles.count} testID="set-count">
          {itemIndex + 1}/{SET_SIZE}
        </Text>
      </View>
      <ExerciseLoop instance={instance} onResult={handleResult} onSelfGrade={handleSelfGrade} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceInline,
  },
  close: { ...typo.title, color: colors.textMuted },
  segments: { flex: 1 },
  count: { ...typo.label, color: colors.textMuted },
});
