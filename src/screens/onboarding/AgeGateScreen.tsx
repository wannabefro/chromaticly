// Age gate (design screen 6b): asked once, right after Welcome (R2). Birth-year
// only (KTD4/A11 — a product-accepted approximation, see age.ts). 13+ persists
// the profile and hands off to the caller; under-13 renders a soft-block with
// no forward path — never a partial "try again" affordance.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isUnderThirteen } from '../../learn/age';
import { useProgressContext } from '../../learn/ProgressContext';
import { Button } from '../../ui/components/Button';
import { ACCENT, colors, shape, type } from '../../ui/theme';

export interface AgeGateScreenProps {
  onOnboarded: () => void;
  currentYear?: number;
}

const YEAR_RANGE = 90;

export function AgeGateScreen({ onOnboarded, currentYear = new Date().getFullYear() }: AgeGateScreenProps) {
  const { completeOnboarding } = useProgressContext();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);

  const years = useMemo(
    () => Array.from({ length: YEAR_RANGE + 1 }, (_, i) => currentYear - i),
    [currentYear],
  );

  async function handleContinue() {
    if (selectedYear === null) return;
    if (isUnderThirteen(selectedYear, currentYear)) {
      setBlocked(true);
      return;
    }
    // Parked screen (U1/KTD4): the primary onboarding path no longer runs the age
    // gate — it moves to account creation (6b), where it will attach birthYear to an
    // already-graded profile. Until then this compiles against the grade-based
    // completeOnboarding with the only built grade; birthYear capture is deferred.
    await completeOnboarding(1, new Date().toISOString());
    onOnboarded();
  }

  if (blocked) {
    return (
      <View style={styles.container} testID="under13-block">
        <Text style={styles.title}>Chromaticly isn&apos;t quite ready for under-13s yet</Text>
        <Text style={styles.subhead}>
          We&apos;re working on a version built just for younger learners. Come back and visit us again soon.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="age-gate-screen">
      <Text style={styles.title}>When were you born?</Text>
      <Text style={styles.subhead}>
        We ask once, to set up the right kind of account. It&apos;s never shown to anyone.
      </Text>

      <ScrollView style={styles.yearList} contentContainerStyle={styles.yearListContent}>
        {years.map((year) => {
          const selected = year === selectedYear;
          return (
            <Pressable
              key={year}
              testID={`year-${year}`}
              onPress={() => setSelectedYear(year)}
              style={[styles.yearRow, selected && styles.yearRowSelected]}
            >
              <Text style={[styles.yearLabel, selected && styles.yearLabelSelected]}>{year}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Button
        label="Continue"
        onPress={handleContinue}
        disabled={selectedYear === null}
        testID="age-continue"
      />
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
  title: {
    fontFamily: type.title.fontFamily,
    fontSize: type.title.fontSize,
    lineHeight: type.title.lineHeight,
    color: colors.text,
  },
  subhead: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.textMuted,
  },
  yearList: {
    flex: 1,
    borderRadius: shape.radiusCard,
    backgroundColor: colors.surfaceCard,
  },
  yearListContent: {
    padding: shape.spaceInline,
    gap: shape.spaceTight,
  },
  yearRow: {
    paddingVertical: shape.spaceInline,
    paddingHorizontal: shape.spaceInline,
    borderRadius: shape.radiusControl,
    minHeight: shape.tapMin,
    justifyContent: 'center',
  },
  yearRowSelected: {
    backgroundColor: colors.surfaceCardSunken,
    borderWidth: shape.borderWActive,
    borderColor: ACCENT,
  },
  yearLabel: {
    fontFamily: type.option.fontFamily,
    fontSize: type.option.fontSize,
    lineHeight: type.option.lineHeight,
    color: colors.textMuted,
  },
  yearLabelSelected: {
    color: colors.text,
  },
});
