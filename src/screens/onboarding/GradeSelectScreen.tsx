// "I know my grade" (design 5a) — the fork's second door.
//
// R1 removed the rungs: placement measures depths, not a grade. That holds for
// measurement, not for a claim.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../ui/components/Button';
import { ACCENT, colors, shape, type } from '../../ui/theme';

export type StartGrade = 0 | 1 | 2 | 3 | 4 | 5;

export interface GradeSelectScreenProps {
  /** 0 for First steps; 1-5 seed the whole vector at that rung. */
  onSelectGrade: (grade: StartGrade) => void;
  /** Back to the placement pass. */
  onBack?: () => void;
}

interface StartPoint {
  grade: StartGrade;
  title: string;
  descriptor: string;
}

/** Descriptors verbatim from design 5a. */
const FIRST_STEPS: StartPoint = {
  grade: 0,
  title: 'First steps',
  descriptor: 'New to reading music — pulse, letters, the stave. No exam.',
};

const RUNGS: StartPoint[] = [
  { grade: 1, title: 'Grade 1', descriptor: 'the basics — note values, simple time' },
  { grade: 2, title: 'Grade 2', descriptor: 'new keys, triplets, more intervals' },
  { grade: 3, title: 'Grade 3', descriptor: 'compound time, melodic minor' },
  { grade: 4, title: 'Grade 4', descriptor: 'chromatic scales, alto clef' },
  { grade: 5, title: 'Grade 5', descriptor: 'the gateway exam — harmony, tenor clef' },
];

const START_POINTS: StartPoint[] = [FIRST_STEPS, ...RUNGS];

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

export function GradeSelectScreen({ onSelectGrade, onBack }: GradeSelectScreenProps) {
  // Grade 1, never First steps: dropping every tap-through learner into the
  // beginner level costs more than missing a beginner.
  const [selected, setSelected] = useState<StartGrade>(1);
  const chosen = START_POINTS.find((p) => p.grade === selected) ?? RUNGS[0];

  const renderPoint = (point: StartPoint) => {
    const isSelected = point.grade === selected;
    const lead = point.grade === 0;
    return (
      <Pressable
        key={point.grade}
        testID={`start-point-${point.grade}`}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        onPress={() => setSelected(point.grade)}
        style={[styles.pill, lead ? styles.pillLead : styles.pillRung, isSelected && styles.pillSelected]}
      >
        {lead && <StaffLines />}
        {/* The numeral names the rung; the accent states the selection. */}
        {!lead && (
          <View style={styles.badge}>
            <Text
              testID={`start-point-${point.grade}-numeral`}
              style={[styles.badgeNumeral, isSelected && styles.badgeNumeralSelected]}
            >
              {point.grade}
            </Text>
          </View>
        )}
        <View style={styles.pillTextBlock}>
          <Text style={[styles.pillGrade, isSelected && styles.pillGradeSelected]}>{point.title}</Text>
          <Text style={styles.pillDescriptor}>{point.descriptor}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container} testID="grade-select-screen">
      <View style={styles.head}>
        <Text style={styles.overline}>No test — your call</Text>
        <Text style={styles.title}>Where should we start?</Text>
      </View>

      <ScrollView contentContainerStyle={styles.pills}>
        {renderPoint(FIRST_STEPS)}
        {/* One mono group label carries the whole distinction — no second heading,
            no segmented control. */}
        <Text style={styles.groupLabel}>or pick your grade</Text>
        {RUNGS.map(renderPoint)}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.reassurance}>Every grade stays one tap away. Nothing here locks.</Text>
        {/* The title, never the number — "Start Grade 0" would print the words the
            naming decision forbids. */}
        <Button label={`Start ${chosen.title}`} onPress={() => onSelectGrade(selected)} testID="start-grade" />
        {onBack && (
          <Pressable testID="grade-select-back" onPress={onBack} style={styles.back}>
            <Text style={styles.backLabel}>Back — I&rsquo;ll take the questions</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceScreenTop,
    paddingBottom: shape.spaceScreenBottom,
    gap: shape.spaceStack,
  },
  head: { gap: shape.spaceSnug },
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
  pills: { gap: shape.spaceSnug, paddingVertical: shape.spaceTight },
  groupLabel: {
    fontFamily: type.overline.fontFamily,
    fontSize: type.overline.fontSize,
    lineHeight: type.overline.lineHeight,
    letterSpacing: type.overline.letterSpacing,
    textTransform: type.overline.textTransform,
    color: colors.textFaint,
    marginTop: shape.spaceSnug,
    marginBottom: shape.spaceTight,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    borderWidth: shape.borderW,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
    paddingVertical: shape.spaceInline,
    paddingHorizontal: shape.spaceCard,
    minHeight: shape.tapMin,
    overflow: 'hidden',
  },
  // Set apart by treatment, so the accent is not spent here.
  pillLead: { borderRadius: shape.radiusCardLg, paddingVertical: shape.spaceCard },
  pillRung: { borderRadius: shape.radiusCard },
  badge: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceCardSunken,
  },
  badgeNumeral: {
    fontFamily: type.cardTitle.fontFamily,
    fontSize: type.cardTitle.fontSize,
    lineHeight: type.cardTitle.lineHeight,
    color: colors.textFaint,
  },
  badgeNumeralSelected: { color: colors.textMuted },
  pillSelected: {
    borderWidth: shape.borderWActive,
    borderColor: ACCENT,
    backgroundColor: colors.surfaceCardSunken,
  },
  pillTextBlock: { flex: 1, gap: shape.spaceHairline },
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
  staffLines: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    gap: shape.spaceInline,
    opacity: 0.035,
  },
  staffLine: { height: 1, backgroundColor: colors.text },
  footer: { gap: shape.spaceInline },
  reassurance: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.textMuted,
    textAlign: 'center',
  },
  back: { alignItems: 'center', minHeight: shape.tapMin, justifyContent: 'center' },
  backLabel: {
    fontFamily: type.label.fontFamily,
    fontSize: type.label.fontSize,
    lineHeight: type.label.lineHeight,
    color: colors.textFaint,
  },
});
