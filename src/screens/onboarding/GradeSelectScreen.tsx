// The skip destination (R1, design 7c). Reached only from placement's "Skip —
// start from the beginning", so it asks WHERE to begin, not WHICH grade.
//
// The five numbered pills are gone. Under R1 there is no single current grade to
// pick — placement seeds seven independent depths, and a learner who declines it
// is choosing between two starting points, not five rungs. First steps leads and
// is preselected: "the beginning" is the alphabet and the stave, not Grade 1.
//
// Grade 1 stays as the second choice because a learner who reads music but
// declined to be measured is not a First-steps learner. Continue is always
// enabled, so this screen can never trap anyone.
//
// Nothing here writes. The choice is staged and committed at Landed with
// everything else (KTD6).

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../ui/components/Button';
import { ACCENT, colors, shape, type } from '../../ui/theme';

export interface GradeSelectScreenProps {
  /** 0 for First steps, 1 for the grade ladder's first rung. */
  onSelectGrade: (grade: 0 | 1) => void;
  /** Back to the placement pass. */
  onBack?: () => void;
}

interface StartPoint {
  grade: 0 | 1;
  title: string;
  descriptor: string;
}

/** Verbatim from design 5a, minus the four rungs the ladder no longer lists. */
const START_POINTS: StartPoint[] = [
  { grade: 0, title: 'First steps', descriptor: 'New to reading music — pulse, letters, the stave. No exam.' },
  { grade: 1, title: 'Grade 1', descriptor: 'I read music already — note values, simple time' },
];

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
  const [selected, setSelected] = useState<0 | 1>(0);
  const chosen = START_POINTS.find((p) => p.grade === selected) ?? START_POINTS[0];

  return (
    <View style={styles.container} testID="grade-select-screen">
      <View style={styles.head}>
        <Text style={styles.overline}>No test — your call</Text>
        <Text style={styles.title}>Where should we start?</Text>
      </View>

      <ScrollView contentContainerStyle={styles.pills}>
        {START_POINTS.map((point) => {
          const isSelected = point.grade === selected;
          return (
            <Pressable
              key={point.grade}
              testID={`start-point-${point.grade}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelected(point.grade)}
              style={[styles.pill, isSelected && styles.pillSelected]}
            >
              <StaffLines />
              <View style={styles.pillTextBlock}>
                <Text style={[styles.pillGrade, isSelected && styles.pillGradeSelected]}>{point.title}</Text>
                <Text style={styles.pillDescriptor}>{point.descriptor}</Text>
              </View>
            </Pressable>
          );
        })}
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
  pills: { gap: shape.spaceInline, paddingVertical: shape.spaceTight },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: shape.radiusCardLg,
    borderWidth: shape.borderW,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
    paddingVertical: shape.spaceCard,
    paddingHorizontal: shape.spaceCard,
    minHeight: shape.tapMin,
    overflow: 'hidden',
  },
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
