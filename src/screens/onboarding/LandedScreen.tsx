// Landed (design screen 6, "step 6 · landed"): the reward is knowledge + visible
// progress (the first Rhythm point), not confetti (R6). Continue picks up the full
// lesson; both CTAs mark the guest onboarded (wired in RootRouter).
//
// Design-divergence (plan Open Question 1): the design's literal CTA reads
// "Continue · Lesson 1 Note values", but the shipped Grade 1 chain roots at
// treble-notes, so Continue lands on the grade home (level map) where the real
// first unit sits — the copy here stays honest about that.

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../ui/components/Button';
import { MasteryGems, type GemState } from '../../ui/components/MasteryGems';
import { colors, shape, strandDef, type, type Strand } from '../../ui/theme';

export interface LandedScreenProps {
  onContinue: () => void;
  onExplore: () => void;
  /** One gem per warm-up item, from CoachedWarmUp — the point the copy names. */
  gems: GemState[];
}

const RHYTHM_HUE = strandDef('rhythm' as Strand).hue;

export function LandedScreen({ onContinue, onExplore, gems }: LandedScreenProps) {
  return (
    <View style={styles.container} testID="landed-screen">
      <View style={styles.head}>
        <Text style={styles.overline}>Warm-up complete</Text>
        <Text style={styles.title}>You&apos;re in. 3 for 3.</Text>
        <Text style={styles.body}>
          Your first{' '}
          {/* Strand colour is always paired with its text label (never-violate rule 3). */}
          <Text style={[styles.strandLabel, { color: RHYTHM_HUE }]}>Rhythm</Text> point is on the board.
          The full lesson picks up right here.
        </Text>
        {/* The copy named a point and nothing showed it. One gem per warm-up item. */}
        <MasteryGems items={gems} hue={RHYTHM_HUE} testID="landed-gems" />
      </View>

      <View style={styles.footer}>
        <Button label="Continue" onPress={onContinue} testID="landed-continue" />
        <Button label="Explore the app" onPress={onExplore} variant="secondary" testID="landed-explore" />
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
    justifyContent: 'space-between',
  },
  // Centred in the space above the footer. Top-aligned, this screen was 55% empty.
  head: { flex: 1, gap: 12, justifyContent: 'center' },
  overline: {
    fontFamily: type.overline.fontFamily,
    fontSize: type.overline.fontSize,
    lineHeight: type.overline.lineHeight,
    letterSpacing: type.overline.letterSpacing,
    textTransform: type.overline.textTransform,
    color: colors.textFaint,
  },
  title: {
    fontFamily: type.hero.fontFamily,
    fontSize: type.hero.fontSize,
    lineHeight: type.hero.lineHeight,
    color: colors.text,
  },
  body: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.textMuted,
  },
  strandLabel: { fontFamily: type.option.fontFamily },
  footer: { gap: shape.spaceInline },
});
