// First steps — the Learn tab for a learner whose working grade is 0.
//
// It is NOT a lane, and that is the whole design. The seven-lane model (7a)
// answers "which of my skills is shallow?", which a learner who has never read
// music has no way to hold. First steps is one linear chain of five lessons with
// no exam, no depth and no strand story, so it gets a linear screen.
//
// This also keeps `LANE_FLOOR_GRADE` a single guard at a single map. Lowering it
// to make grade 0 navigable would have split the readiness firewall across the
// three derivations that read that map — the fragility G6 U2 existed to remove.
//
// AD6: star derivation reads the mutable ProgressStore, so it is recomputed in a
// useMemo keyed explicitly on `revision`, whose identity does change.

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type Lesson, lessonById, LESSONS_BY_GRADE } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { unitStates } from '../learn/mastery-rollup';
import { useProgressContext } from '../learn/ProgressContext';
import { Button } from '../ui/components/Button';
import { UnitRow } from '../ui/components/UnitRow';
import { Screen } from '../ui/Screen';
import { colors, shape, type as typo, type Strand } from '../ui/theme';

/** The grade this screen serves. Named rather than inlined, because every read of
 *  it is the same claim: the level below the ladder. */
export const FIRST_STEPS_GRADE = 0;

/** Where a learner goes when this level ends, or when they decide it is too easy. */
export const NEXT_GRADE = 1;

export interface FirstStepsScreenProps {
  /** The shell owns the runner, exactly as it does for the lane detail. */
  onOpenLesson: (lesson: Lesson) => void;
  /** Leave for Grade 1 — on completion, or by choice. */
  onAdvance: () => void;
}

function levelTitle(grade: number): string {
  return LEVELS.find((l) => l.grade === grade)?.title ?? `Grade ${grade}`;
}

export function FirstStepsScreen({ onOpenLesson, onAdvance }: FirstStepsScreenProps) {
  const { ready, store, revision } = useProgressContext();

  const lessons = LESSONS_BY_GRADE[FIRST_STEPS_GRADE] ?? [];

  const rows = useMemo(() => {
    if (!store) return [];
    return unitStates(
      lessons.map((l) => l.id),
      store,
      (id) => lessonById(id)?.atoms ?? [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6)
  }, [lessons, store, revision]);

  if (!ready || !store) {
    return (
      <Screen testID="first-steps-loading">
        <Text style={styles.muted}>Loading…</Text>
      </Screen>
    );
  }

  const done = rows.filter((r) => r.state === 'done').length;
  const allDone = rows.length > 0 && done === rows.length;

  return (
    <Screen testID="first-steps-screen">
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {/* A count, not a depth bar. Depth is the lane model's reading and this
              level is deliberately outside it. */}
          <Text style={styles.overline} testID="first-steps-progress">
            {done} of {rows.length} done · no exam
          </Text>
          <Text style={styles.title}>{levelTitle(FIRST_STEPS_GRADE)}</Text>
          <Text style={styles.lead}>
            Five short lessons, in order. Each one is what the grades assume you already know.
          </Text>
        </View>

        <View style={styles.list}>
          {rows.map((row) => {
            const lesson = lessonById(row.unitId);
            if (!lesson) return null;
            return (
              <UnitRow
                key={row.unitId}
                strand={lesson.strand as Strand}
                title={lesson.title}
                stars={row.stars}
                state={row.state}
                onPress={() => onOpenLesson(lesson)}
                testID={`first-steps-unit-${row.unitId}`}
              />
            );
          })}
        </View>

        {allDone ? (
          <View style={styles.handoff} testID="first-steps-complete">
            <Text style={styles.handoffTitle}>That is the whole level.</Text>
            <Text style={styles.handoffBody}>
              {levelTitle(NEXT_GRADE)} picks up right where these leave off — the stave, the clef, and reading notes
              off it.
            </Text>
            <Button label={`Start ${levelTitle(NEXT_GRADE)}`} onPress={onAdvance} testID="first-steps-advance" />
          </View>
        ) : (
          // Never withdraw entry (R2). A learner who over-estimated how little they
          // knew must be able to leave without finishing, and without being asked why.
          <Pressable
            testID="first-steps-skip"
            onPress={onAdvance}
            accessibilityRole="button"
            style={styles.skip}
          >
            <Text style={styles.skipLabel}>Already know this? Go straight to {levelTitle(NEXT_GRADE)}</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: shape.spaceStack,
    // `Screen` insets the top edge only, so the screen gutter is the scroll
    // content's own job — the same note LaneScreen carries, and the same defect:
    // jest's layout-free renderer finds every row either way, and on device the
    // rows ran to the bezel.
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceStack,
    paddingBottom: shape.spaceScreenBottom,
  },
  muted: { ...typo.body, color: colors.textMuted },
  header: { gap: shape.spaceSnug },
  overline: { ...typo.overline, color: colors.textFaint },
  title: { ...typo.title, color: colors.text },
  lead: { ...typo.body, color: colors.textMuted },
  list: { gap: shape.spaceInline },
  handoff: {
    gap: shape.spaceInline,
    borderRadius: shape.radiusCardLg,
    borderWidth: shape.borderW,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
    padding: shape.spaceCard,
  },
  handoffTitle: { ...typo.cardTitle, color: colors.text },
  handoffBody: { ...typo.body, color: colors.textMuted },
  skip: { paddingVertical: shape.spaceInline, alignItems: 'center' },
  skipLabel: { ...typo.body, color: colors.textFaint },
});
