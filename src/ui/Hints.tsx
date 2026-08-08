// Hint reveal control (U10): shows instance.hints one at a time, behind a
// "Show hint" press, and reports the running reveal count upward so the
// loop can carry hintsUsed into the emitted AttemptResult (a hint-assisted
// correct must not read as unaided mastery — KTD10).
//
// A revealed hint wears the design's smart-tip register (💡 on the amber hint
// surface) — the SAME card the teach phase shows, because it is the same idea
// arriving later. It was unstyled body text until chromaticly-inr made the
// warm-up open one by default, at which point the first thing a learner sees in
// a lesson was an unlabelled paragraph under the options.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, glyph, shape, type as typo } from './theme';

export interface HintsProps {
  hints: string[];
  /** The warm-up item (chromaticly-inr) opens the first hint before the learner
   *  presses anything — the method is shown, not withheld. It is still counted
   *  as a reveal, so the attempt stays hint-assisted. */
  revealFirst?: boolean;
  onHintUsed?: (count: number) => void;
}

export function Hints({ hints, revealFirst = false, onHintUsed }: HintsProps) {
  const [revealed, setRevealed] = useState(revealFirst ? 1 : 0);

  if (hints.length === 0) return null;

  const showNext = () => {
    const next = Math.min(revealed + 1, hints.length);
    setRevealed(next);
    onHintUsed?.(next);
  };

  return (
    <View style={styles.container} testID="hints">
      {hints.slice(0, revealed).map((hint, index) => (
        <View key={index} style={styles.tip}>
          <Text style={styles.tipIcon}>💡</Text>
          <View style={styles.tipBody}>
            <Text style={styles.tipLabel}>SMART TIP</Text>
            <Text style={styles.tipText} testID={`hint-${index}`}>
              {hint}
            </Text>
          </View>
        </View>
      ))}
      {revealed < hints.length && (
        <Pressable testID="show-hint" onPress={showNext} style={styles.showHint}>
          <Text style={styles.showHintLabel}>Show hint</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: shape.spaceInline },
  tip: {
    flexDirection: 'row',
    gap: shape.spaceInline,
    alignItems: 'flex-start',
    backgroundColor: colors.hintSurface,
    borderWidth: shape.borderW,
    borderColor: colors.hint,
    borderRadius: shape.radiusControl,
    padding: shape.spaceCard,
  },
  tipIcon: { fontSize: glyph.md },
  tipBody: { flex: 1, gap: shape.spaceTight },
  tipLabel: { ...typo.label, color: colors.hint, letterSpacing: 0.6 },
  tipText: { ...typo.body, color: colors.text },
  showHint: {
    alignSelf: 'flex-start',
    paddingVertical: shape.spaceSnug,
    paddingHorizontal: shape.spaceHairline,
    minHeight: shape.tapMin,
    justifyContent: 'center',
  },
  showHintLabel: { ...typo.body, color: colors.hint },
});
