// Grade select (design screen 5a): the ONLY setup question (R2). Grade pills are
// the fast path; the placement quiz is a deferred branch (shown disabled). A grade
// is selectable once levels.ts gives it units, so onboarding never persists an
// ungenerated grade. The reassurance line ("switch any time") kills choice anxiety
// per the design annotation.
//
// First steps leads the list as a set-apart lead-in card, never as a sixth rung —
// design/README.md, "First steps sits above the grade ladder, not inside it".

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isStartableGrade, LEVELS } from '../../content/levels';
import { placeableStrands } from '../../learn/placement';
import { Button } from '../../ui/components/Button';
import { ACCENT, colors, shape, type } from '../../ui/theme';

export interface GradeSelectScreenProps {
  onSelectGrade: (grade: number) => void;
}

/** Verbatim from design 5a for grades 1-5. Each names content that exists —
 *  melodic-minor-3, chromatic-scale-4, alto-reading-4, tenor-reading-5,
 *  cadences-5, satb-voice-5. Grade 0 names its own, and states "no exam", which
 *  is the structural fact separating it from the five. */
const GRADE_DESCRIPTORS: Record<number, string> = {
  0: 'New to reading music — pulse, letters, the stave. No exam.',
  1: 'The basics — note values, simple time',
  2: 'New keys, triplets, more intervals',
  3: 'Compound time, melodic minor',
  4: 'Chromatic scales, alto clef',
  5: 'The gateway exam — harmony, tenor clef',
};

const STARTER_LEVELS = LEVELS.filter((l) => l.grade < 1);
const GRADED_LEVELS = LEVELS.filter((l) => l.grade >= 1);

/** Grade 1, not First steps. A default that drops every tap-through learner into
 *  the beginner level is worse than one that misses a beginner (design ruling). */
const DEFAULT_GRADE = GRADED_LEVELS.find((l) => isStartableGrade(l.grade))?.grade ?? 1;

/** The system's signature staff-line motif, drawn rather than tiled — RN has no
 *  repeating-linear-gradient. Decorative only, so it stays out of the a11y tree. */
function StaffLines() {
  return (
    <View style={styles.staffLines} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.staffLine} />
      ))}
    </View>
  );
}

export function GradeSelectScreen({ onSelectGrade }: GradeSelectScreenProps) {
  // Default-select so the primary CTA is immediately actionable (keeps the <90s
  // path fast); locked grades can't become selected.
  const [selectedGrade, setSelectedGrade] = useState<number>(DEFAULT_GRADE);
  const selectedLevel = LEVELS.find((l) => l.grade === selectedGrade);

  return (
    <View style={styles.container} testID="grade-select-screen">
      <View style={styles.head}>
        <Text style={styles.overline}>1 of 1 — that&apos;s the whole setup</Text>
        <Text style={styles.title}>Where should we start?</Text>
      </View>

      <ScrollView contentContainerStyle={styles.pills}>
        {STARTER_LEVELS.map((level) => {
          const selected = level.grade === selectedGrade;
          return (
            <Pressable
              key={level.id}
              testID={`grade-pill-${level.grade}`}
              onPress={() => setSelectedGrade(level.grade)}
              style={[styles.pill, styles.starter, selected && styles.pillSelected]}
            >
              <StaffLines />
              <View style={styles.pillTextBlock}>
                <Text style={[styles.pillGrade, styles.pillGradeSelected]}>{level.title}</Text>
                <Text style={styles.pillDescriptor}>{GRADE_DESCRIPTORS[level.grade]}</Text>
              </View>
            </Pressable>
          );
        })}

        {STARTER_LEVELS.length > 0 && <Text style={styles.groupLabel}>or pick your grade</Text>}

        {GRADED_LEVELS.map((level) => {
          const selectable = isStartableGrade(level.grade);
          const selected = selectable && level.grade === selectedGrade;
          return (
            <Pressable
              key={level.id}
              testID={`grade-pill-${level.grade}`}
              disabled={!selectable}
              onPress={() => setSelectedGrade(level.grade)}
              style={[styles.pill, selected && styles.pillSelected, !selectable && styles.pillLocked]}
            >
              <View style={styles.pillTextBlock}>
                <Text style={[styles.pillGrade, selected && styles.pillGradeSelected]}>{level.title}</Text>
                <Text style={styles.pillDescriptor}>{GRADE_DESCRIPTORS[level.grade]}</Text>
              </View>
              {!selectable && <Text style={styles.comingSoon}>Coming soon</Text>}
            </Pressable>
          );
        })}

        <Pressable testID="placement-quiz" disabled style={styles.quiz}>
          <Text style={styles.quizLabel}>Not sure? Take the placement quiz</Text>
          {/* Derived, per the 7c ruling — it stays true when a strand gains a lesson. */}
          <Text style={styles.quizMeta}>
            {placeableStrands().length} questions · ~3 min · recommends a grade · coming soon
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.reassurance}>You can switch any time in Profile.</Text>
        {/* The title, never the number — "Start Grade 0" would print the words the
            naming decision forbids. */}
        <Button
          label={`Start ${selectedLevel?.title ?? `Grade ${selectedGrade}`}`}
          onPress={() => onSelectGrade(selectedGrade)}
          testID="start-grade"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: 48,
    paddingBottom: 24,
    gap: shape.spaceStack,
  },
  head: { gap: 8 },
  overline: {
    fontFamily: type.overline.fontFamily,
    fontSize: type.overline.fontSize,
    lineHeight: type.overline.lineHeight,
    letterSpacing: type.overline.letterSpacing,
    textTransform: type.overline.textTransform,
    color: colors.textFaint,
  },
  title: {
    fontFamily: type.title.fontFamily,
    fontSize: type.title.fontSize,
    lineHeight: type.title.lineHeight,
    color: colors.text,
  },
  pills: { gap: shape.spaceInline, paddingVertical: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
    paddingVertical: 14,
    paddingHorizontal: shape.spaceCard,
    minHeight: shape.tapMin,
  },
  pillSelected: {
    borderWidth: shape.borderWActive,
    borderColor: ACCENT,
    backgroundColor: colors.surfaceCardSunken,
  },
  pillLocked: { opacity: 0.4 },
  pillTextBlock: { flex: 1, gap: 2 },
  pillGrade: {
    fontFamily: type.option.fontFamily,
    fontSize: type.option.fontSize,
    lineHeight: type.option.lineHeight,
    color: colors.textMuted,
  },
  pillGradeSelected: { color: colors.text },
  pillDescriptor: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.textFaint,
  },
  // Set apart by treatment, never by the accent — the accent means "selected" here.
  starter: {
    borderRadius: shape.radiusCardLg,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  staffLines: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    gap: 11,
    opacity: 0.035,
  },
  staffLine: { height: 1, backgroundColor: colors.text },
  groupLabel: {
    fontFamily: type.overline.fontFamily,
    fontSize: type.overline.fontSize,
    lineHeight: type.overline.lineHeight,
    letterSpacing: type.overline.letterSpacing,
    textTransform: type.overline.textTransform,
    color: colors.textGhost,
    marginTop: 4,
  },
  comingSoon: {
    fontFamily: type.label.fontFamily,
    fontSize: type.label.fontSize,
    lineHeight: type.label.lineHeight,
    color: colors.textFaint,
    marginLeft: shape.spaceInline,
  },
  quiz: {
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingVertical: 14,
    paddingHorizontal: shape.spaceCard,
    gap: 2,
    opacity: 0.5,
  },
  quizLabel: {
    fontFamily: type.option.fontFamily,
    fontSize: type.option.fontSize,
    lineHeight: type.option.lineHeight,
    color: colors.textMuted,
  },
  quizMeta: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.textFaint,
  },
  footer: { gap: shape.spaceInline },
  reassurance: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
