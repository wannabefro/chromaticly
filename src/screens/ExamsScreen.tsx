// Exams tab (design 2a's tab bar → the paper in 3b). The level map already carries an
// exam gate inline; this is the same gate reached directly, so a learner who wants the
// paper does not have to scroll the whole map to find it.
//
// Free grade access (fyu.3): the gate is advisory, not star-gated — a paper opens any
// time it exists (hasExamPaper), the same rule as the map's inline gate, so a paper is
// never quietly openable from one surface but not the other.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LEVELS } from '../content/levels';
import { hasExamPaper } from '../learn/exam';
import { isLevelUnlocked } from '../learn/mastery-rollup';
import { useProgressContext } from '../learn/ProgressContext';
import { ExamGateNode } from '../ui/components/ExamGateNode';
import { ExamRunner } from '../ui/exam/ExamRunner';
import { Screen } from '../ui/Screen';
import { colors, shape, type as typo } from '../ui/theme';

export interface ExamsScreenProps {
  /** Told when the paper takes over: an exam must not offer a tab out of itself. */
  onImmersive?: (immersive: boolean) => void;
}

export default function ExamsScreen({ onImmersive }: ExamsScreenProps = {}) {
  const { ready, store } = useProgressContext();
  const [examGrade, setExamGrade] = useState<number | null>(null);

  useEffect(() => {
    onImmersive?.(examGrade !== null);
  }, [onImmersive, examGrade]);

  if (!ready || !store) {
    return (
      <Screen testID="exams-loading">
        <Text style={styles.loading}>Loading…</Text>
      </Screen>
    );
  }

  if (examGrade != null) {
    return <ExamRunner grade={examGrade} onExit={() => setExamGrade(null)} />;
  }

  return (
    <Screen style={styles.screen} testID="exams-screen">
      <Text style={styles.title}>Exams</Text>
      <Text style={styles.blurb}>A practice paper under exam conditions — timed, silent, marked at the end.</Text>

      <View style={styles.list}>
        {LEVELS.filter((level) => isLevelUnlocked(level, store)).map((level) => (
          <ExamGateNode
            key={level.id}
            levelGrade={level.grade}
            unitsRequired={level.unitIds.length}
            hasPaper={hasExamPaper(level.grade)}
            onPress={hasExamPaper(level.grade) ? () => setExamGrade(level.grade) : undefined}
            testID={`exam-gate-${level.id}`}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: shape.spaceScreenX, gap: shape.spaceCard },
  title: { ...typo.title, color: colors.text },
  blurb: { ...typo.body, color: colors.textMuted },
  list: { gap: shape.spaceCard },
  loading: { ...typo.body, color: colors.textMuted, padding: shape.spaceScreenX },
});
