// Exams tab (design 2a's tab bar → the paper in 3b, readiness in 7d).
//
// Under the seven-lane model this is the ONLY place a paper is reached — the level
// map's inline gate goes with the map (U12). The screen leads with readiness read off
// the whole depth vector rather than a list of locked and unlocked levels: nothing is
// locked (R2), so a filtered list was drawing a distinction that no longer exists.
//
// The paper is startable at any depth (R6). Readiness only says what it will cost, and
// a short strand is one tap from the lane that repairs it.

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LEVELS } from '../content/levels';
import { EXAM_PAPER_GRADE, GRADE1_EXAM_SECTIONS, hasExamPaper, QUESTIONS_PER_SECTION } from '../learn/exam';
import { laneDepths } from '../learn/lane-depth';
import { examReadiness } from '../learn/mastery-rollup';
import { useProgressContext } from '../learn/ProgressContext';
import { ExamGateNode } from '../ui/components/ExamGateNode';
import { ReadinessCard } from '../ui/components/ReadinessCard';
import { ExamRunner } from '../ui/exam/ExamRunner';
import { Screen } from '../ui/Screen';
import { colors, shape, type as typo, type Strand } from '../ui/theme';

export interface ExamsScreenProps {
  /** Told when the paper takes over: an exam must not offer a tab out of itself. */
  onImmersive?: (immersive: boolean) => void;
  /** Tapping a short strand crosses to Learn's detail for that lane — the shell
   *  carries the target through the tab change (G6 U8). */
  onOpenLane?: (strand: Strand) => void;
}

export default function ExamsScreen({ onImmersive, onOpenLane }: ExamsScreenProps = {}) {
  const { ready, store, revision, clock } = useProgressContext();
  const [examGrade, setExamGrade] = useState<number | null>(null);

  const readiness = useMemo(() => {
    if (!store) return null;
    return examReadiness(EXAM_PAPER_GRADE, GRADE1_EXAM_SECTIONS, laneDepths(store, clock.now()), QUESTIONS_PER_SECTION);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6), not read directly above
  }, [store, revision, clock]);

  useEffect(() => {
    onImmersive?.(examGrade !== null);
  }, [onImmersive, examGrade]);

  if (!ready || !store || !readiness) {
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

      <ReadinessCard
        readiness={readiness}
        onOpenLane={onOpenLane}
        onSit={hasExamPaper(EXAM_PAPER_GRADE) ? () => setExamGrade(EXAM_PAPER_GRADE) : undefined}
      />

      {/* Every level, unfiltered: nothing is locked (R2), so the list is the whole
          set and a grade with no paper yet says so on its own node. */}
      <View style={styles.list}>
        {LEVELS.map((level) => (
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
