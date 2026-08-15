// Landed (design screen 6, "step 6 · landed"): the reward is knowledge + visible
// progress (the first mastery point), not confetti (R6). Continue picks up the full
// lesson; both CTAs mark the guest onboarded (wired in RootRouter).
//
// Design-divergence (plan Open Question 1): the design's CTA names Lesson 1.
// The Grade 1 chain roots at treble-notes, so Continue lands on the grade home.

import { StyleSheet, Text, View } from 'react-native';

import { STRAND_ORDER } from '../../learn/lane-depth';
import type { SeededDepth } from '../../learn/store';
import { usePreviewDepths } from '../../learn/usePreviewDepths';
import { warmUpFor } from '../../learn/warm-up';
import { Button } from '../../ui/components/Button';
import { LaneRow } from '../../ui/components/LaneRow';
import { MasteryGems, type GemState } from '../../ui/components/MasteryGems';
import { colors, shape, strandDef, type, type Strand } from '../../ui/theme';

/** Matches the placement result's stagger — the same board, moving the same way. */
const REVEAL_STAGGER_MS = 70;

export interface LandedScreenProps {
  onContinue: () => void;
  onExplore: () => void;
  /** Set when the commit rejected. Both CTAs stay live, so the copy says retry. */
  saveFailed?: boolean;
  /** One gem per warm-up item, from CoachedWarmUp — the point the copy names. */
  gems: GemState[];
  /** The chosen level, so this screen names the strand the warm-up actually drilled. */
  grade?: number | null;
  /** What the commit is about to write. Empty on the First-steps route: an
   *  all-zero board is not a landing. */
  staged?: Record<string, SeededDepth>;
}

export function LandedScreen({ onContinue, onExplore, gems, grade, staged = {}, saveFailed = false }: LandedScreenProps) {
  const warmUpStrand = warmUpFor(grade).strand as Strand;
  const def = strandDef(warmUpStrand);
  const depths = usePreviewDepths(staged);
  const board = Object.keys(staged).length > 0;
  // The warm-up's own attempt currently discards its strand's seed
  // (chromaticly-h3e), so the lane the copy points at can read 0. Say nothing
  // the board does not show.
  const pointVisible = board && depths[warmUpStrand].depth > 0;

  return (
    <View style={styles.container} testID="landed-screen">
      <View style={[styles.head, board && styles.headTop]}>
        <Text style={styles.overline}>Warm-up complete</Text>
        <Text style={styles.title}>You&apos;re in. 3 for 3.</Text>
        <Text style={styles.body}>
          Your first{' '}
          {/* Strand colour is always paired with its text label (never-violate rule 3). */}
          <Text style={[styles.strandLabel, { color: def.hue }]}>{def.short}</Text> point is on the board.
          {pointVisible ? ' Here it is.' : ' The full lesson picks up right here.'}
        </Text>
        {/* The copy named a point and nothing showed it. One gem per warm-up item. */}
        <MasteryGems items={gems} hue={def.hue} testID="landed-gems" />

        {/* The board the copy names, drawn by the component the Learn tab uses —
            so this screen and the next cannot disagree (R3). */}
        {board && (
          <View style={styles.rows} testID="landed-board">
            {STRAND_ORDER.map((strand, i) => (
              <LaneRow
                key={strand}
                strand={strand}
                depth={depths[strand]}
                note={pointVisible && strand === warmUpStrand ? 'first point' : undefined}
                revealDelay={i * REVEAL_STAGGER_MS}
                testID={`landed-row-${strand}`}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {saveFailed ? (
          <Text style={styles.notice} testID="landed-save-failed">
            We could not save your progress. Tap again to retry.
          </Text>
        ) : null}
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
    paddingTop: shape.spaceScreenTop,
    paddingBottom: shape.spaceScreenBottom,
    justifyContent: 'space-between',
  },
  // Amber, not the red marking pair: a failed save needs attention, and
  // `incorrect` would read as a wrong answer.
  notice: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.hint,
    backgroundColor: colors.hintSurface,
    borderRadius: shape.radiusControl,
    paddingVertical: shape.spaceSnug,
    paddingHorizontal: shape.spaceInline,
  },
  // Centred in the space above the footer. Top-aligned, this screen was 55% empty.
  head: { flex: 1, gap: shape.spaceInline, justifyContent: 'center' },
  // With the board there is no space left to centre in.
  headTop: { justifyContent: 'flex-start', paddingTop: shape.spaceStack },
  rows: { gap: shape.spaceHairline, marginTop: shape.spaceSnug },
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
