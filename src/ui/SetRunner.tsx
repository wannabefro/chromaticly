// SetRunner (U7): drives a fixed 8-item set for a lesson (design 2b header → items
// → 2f). Generates items from the lesson's first template (seeds 0..7), feeds
// ExerciseLoop, and on each Continue records the atom exactly once (A2) and the
// per-item mastery gem. On the 8th it marks the lesson complete once (A2) and shows
// SetComplete. The notation surface persists across items (perf refactor).

import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Lesson } from '../content/lessons';
import { generate } from '../engine/generators';
import { emptySet, gems, isComplete, recordItem, score, segmentStates, SET_SIZE } from '../learn/exercise-set';
import { useProgressContext } from '../learn/ProgressContext';
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
  const { recordAtom, complete } = useProgressContext();
  const [itemIndex, setItemIndex] = useState(0);
  const [setState, setSetState] = useState(emptySet());
  const [done, setDone] = useState(false);
  const tickRef = useRef(0);
  const strand = lesson.strand as Strand;

  const instance = useMemo(
    () => generate(lesson.templates[0], { grade: 1, seed: itemIndex }),
    [lesson, itemIndex],
  );

  const handleResult = useCallback(
    async (result: AttemptResult) => {
      const atom = instance.srs_tags[0];
      await recordAtom(atom, result, tickRef.current++); // A2: record the atom once, here
      const nextState = recordItem(setState, result);
      setSetState(nextState);
      if (isComplete(nextState)) {
        await complete(lesson); // A2: complete the lesson exactly once
        setDone(true);
      } else {
        setItemIndex((i) => i + 1);
      }
    },
    [instance, recordAtom, setState, complete, lesson],
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
      <ExerciseLoop instance={instance} onResult={handleResult} />
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
