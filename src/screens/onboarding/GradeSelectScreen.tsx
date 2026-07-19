// Grade select (design screen 2, "step 2 · one question"): the ONLY setup
// question (R2). Grade pills are the fast path; the placement quiz is a deferred
// branch (shown disabled). Only Grade 1 has content (levels.ts) — Grades 2–5
// render locked "coming soon" and can't be selected, so onboarding never persists
// an ungenerated grade. The reassurance line ("switch any time") kills choice
// anxiety per the design annotation.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isStartableGrade, LEVELS } from '../../content/levels';
import { Button } from '../../ui/components/Button';
import { ACCENT, colors, shape, type } from '../../ui/theme';

export interface GradeSelectScreenProps {
  onSelectGrade: (grade: number) => void;
}

/** Short, plain-language "what this grade covers" line per pill. Grade 3's is
 *  taken verbatim from the design; the rest are faithful one-liners. */
const GRADE_DESCRIPTORS: Record<number, string> = {
  1: 'The basics — notes, rhythm, simple keys',
  2: 'Ledger lines, more keys, triads',
  3: 'Compound time, minor keys',
  4: 'Clefs, keys to five sharps and flats',
  5: 'Advanced rhythm, transposition',
};

const FIRST_STARTABLE_GRADE = LEVELS.find((l) => isStartableGrade(l.grade))?.grade ?? 1;

export function GradeSelectScreen({ onSelectGrade }: GradeSelectScreenProps) {
  // Default-select the first available grade so the primary CTA is immediately
  // actionable (keeps the <90s path fast); locked grades can't become selected.
  const [selectedGrade, setSelectedGrade] = useState<number>(FIRST_STARTABLE_GRADE);

  return (
    <View style={styles.container} testID="grade-select-screen">
      <View style={styles.head}>
        <Text style={styles.overline}>1 of 1 — that&apos;s the whole setup</Text>
        <Text style={styles.title}>Do you know your grade?</Text>
      </View>

      <ScrollView contentContainerStyle={styles.pills}>
        {LEVELS.map((level) => {
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
                <Text style={[styles.pillGrade, selected && styles.pillGradeSelected]}>Grade {level.grade}</Text>
                <Text style={styles.pillDescriptor}>{GRADE_DESCRIPTORS[level.grade]}</Text>
              </View>
              {!selectable && <Text style={styles.comingSoon}>Coming soon</Text>}
            </Pressable>
          );
        })}

        <Pressable testID="placement-quiz" disabled style={styles.quiz}>
          <Text style={styles.quizLabel}>Not sure? Take the placement quiz</Text>
          <Text style={styles.quizMeta}>8 questions · ~3 min · recommends a grade · coming soon</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.reassurance}>You can switch grades any time in Profile.</Text>
        <Button
          label={`Start Grade ${selectedGrade}`}
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
