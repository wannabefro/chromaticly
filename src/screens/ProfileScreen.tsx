// Profile (design 5c): who you are, how ready you are for the paper, what you've
// collected, and your grade.
//
// Two parts of 5c are NOT here, deliberately:
//
//  - The XP total and day-streak in the header. Neither exists: the store tracks
//    per-atom mastery streaks (a different thing entirely) and no XP at all. Inventing
//    numbers on the one screen whose job is telling the learner where they stand would
//    be the worst place in the app to fake something. Filed (302.35).
//  - The settings block is PARTIAL. Only the two settings with real, wired effects
//    ship: notation size (re-scales the score) and left-hand stave input (mirrors the
//    input controls). Terminology (UK/US), colour-vision palette, and feedback audio
//    are omitted — each needs a large refactor, new design tokens, or an audio
//    dependency, and a toggle that flips and changes nothing is a lie. Filed as
//    follow-ups off 302.36.
//
// Grade switching is here, but only Grade 1 has content, so 2-5 read as locked —
// the same rule GradeSelectScreen applies during onboarding, not a second one.

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LESSONS, lessonById } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { examReadiness, strandMastery } from '../learn/mastery-rollup';
import { useProgressContext } from '../learn/ProgressContext';
import { Screen } from '../ui/Screen';
import { SettingsBlock } from '../ui/components/SettingsBlock';
import { StrandRadar } from '../ui/components/StrandRadar';
import { colors, shape, strandDef, type as typo, type Strand } from '../ui/theme';

export interface ProfileScreenProps {
  /** "Exam readiness ›" takes the learner to the paper it is talking about. */
  onOpenExams?: () => void;
  /** A tap on the mastery radar drills into a strand (design 6d) — the shell routes
   *  it to the level map where that strand's next lesson lives. */
  onDrillStrand?: (strand: Strand) => void;
}

export default function ProfileScreen({ onOpenExams, onDrillStrand }: ProfileScreenProps = {}) {
  const { ready, store, revision, grade } = useProgressContext();

  const level = LEVELS.find((l) => l.unlocked) ?? LEVELS[0];

  const readiness = useMemo(() => {
    if (!store) return null;
    return examReadiness(
      level.unitIds,
      store,
      (id) => {
        const lesson = lessonById(id);
        return lesson ? { atoms: lesson.atoms, strand: lesson.strand } : undefined;
      },
      level.examGate.unlockAtStars,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6), not read directly above
  }, [store, revision, level]);

  const collected = useMemo(() => {
    if (!store) return 0;
    return LESSONS.filter((lesson) => store.isFactCollected(lesson.id)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6)
  }, [store, revision]);

  const mastery = useMemo(() => {
    if (!store) return {};
    return strandMastery(LESSONS, store);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6)
  }, [store, revision]);

  if (!ready || !store || !readiness) {
    return (
      <Screen testID="profile-loading">
        <Text style={styles.muted}>Loading…</Text>
      </Screen>
    );
  }

  const percent = Math.round(readiness.fraction * 100);
  const weakestLabel = readiness.weakest
    .slice(0, 2)
    .map((strand) => strandDef(strand as Strand).label)
    .join(' & ');

  return (
    <Screen style={styles.screen} testID="profile-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>G</Text>
          </View>
          <View>
            <Text style={styles.name}>Guest</Text>
            <Text style={styles.sub}>Grade {grade ?? 1}</Text>
          </View>
        </View>

        {/* Readiness is stars-earned over stars-available — the same signal the exam
            gate uses, so it can never disagree with whether the paper is open. */}
        <Pressable style={styles.card} testID="profile-readiness" onPress={onOpenExams}>
          <View style={styles.rowBetween}>
            <Text testID="readiness-percent" style={styles.percent}>
              {percent}%
            </Text>
            <Text style={styles.chevron}>›</Text>
          </View>
          <Text style={styles.cardTitle}>Exam readiness · Level {level.grade}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.cardNote} testID="readiness-note">
            {readiness.gateOpen
              ? 'The practice paper is open.'
              : weakestLabel !== ''
                ? `${weakestLabel} hold you back.`
                : 'Keep going to open the practice paper.'}
          </Text>
        </Pressable>

        <StrandRadar mastery={mastery} onDrill={onDrillStrand} />

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Fact-card collection</Text>
            <Text style={styles.value} testID="profile-facts">
              {collected} of {LESSONS.length}
            </Text>
          </View>
          <Text style={styles.cardNote}>One to find in every lesson’s teach phase.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Grade</Text>
          <Text style={styles.cardNote}>You can switch grade at any time.</Text>
          <View style={styles.grades}>
            {LEVELS.map((lvl) => {
              const isCurrent = (grade ?? 1) === lvl.grade;
              return (
                <View
                  key={lvl.id}
                  testID={`profile-grade-${lvl.grade}`}
                  style={[styles.gradePill, isCurrent && styles.gradePillCurrent, !lvl.unlocked && styles.gradePillLocked]}
                >
                  <Text style={[styles.gradeLabel, isCurrent && styles.gradeLabelCurrent]}>{lvl.grade}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.cardNote} testID="profile-grade-note">
            Only Grade 1 has content so far — Grades 2–5 are coming.
          </Text>
        </View>

        <SettingsBlock />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: shape.spaceScreenX, gap: shape.spaceCard },
  muted: { ...typo.body, color: colors.textMuted, padding: shape.spaceScreenX },

  head: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { ...typo.title, color: colors.text },
  name: { ...typo.title, color: colors.text },
  sub: { ...typo.label, color: colors.textMuted },

  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    padding: shape.spaceCard,
    gap: shape.spaceInline,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...typo.cardTitle, color: colors.text },
  cardNote: { ...typo.body, color: colors.textMuted },
  value: { ...typo.label, color: colors.text },
  percent: { ...typo.title, color: colors.text },
  chevron: { ...typo.title, color: colors.textFaint },

  track: { height: 6, borderRadius: shape.radiusChip, backgroundColor: colors.surfaceCardSunken, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: shape.radiusChip, backgroundColor: colors.correct },

  grades: { flexDirection: 'row', gap: shape.spaceInline },
  gradePill: {
    flex: 1,
    minHeight: shape.tapMin,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradePillCurrent: { borderColor: colors.correct, backgroundColor: colors.correctSurface },
  gradePillLocked: { opacity: 0.4 },
  gradeLabel: { ...typo.cardTitle, color: colors.textMuted },
  gradeLabelCurrent: { color: colors.text },
});
