// Find-the-bar answer input (302.4, design 4c). The passage itself is rendered
// above by the exercise loop (notation on paper, with play — rules 1/2); this is
// the bar-number strip the learner answers with, mirroring the pick.
//
// The strip reads 1..N in score order — deliberately NOT the shuffled option
// order, because these aren't interchangeable choices: they're positions in the
// music, and shuffling them would make the strip lie about the score.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ExerciseInstance } from '../../engine/schema';
import { colors, shape, strandDef, type as typo } from '../theme';
import type { InteractionComponentProps } from './types';

export type FindTheBarResponse = number | null;

/** Fails loud, like `lookupInteraction`: a missing bar count would otherwise render
 *  a fully-formed exercise with an empty bar strip — unanswerable, with no error
 *  anywhere to say why. */
export function barCount(instance: ExerciseInstance): number {
  const bars = instance.interaction.config?.bars;
  if (typeof bars !== 'number' || !Number.isInteger(bars) || bars < 2) {
    throw new Error(`find_the_bar: interaction.config.bars must be an integer >= 2, got ${String(bars)}`);
  }
  return bars;
}

export function FindTheBar({ instance, response, graded, strand, onResponseChange }: InteractionComponentProps<FindTheBarResponse>) {
  const hue = strandDef(strand).hue;
  const bars = Array.from({ length: barCount(instance) }, (_, i) => i + 1);
  const locked = graded !== null;

  return (
    <View style={styles.container} testID="find-the-bar">
      <View style={styles.hint}>
        <Text style={styles.hintIcon}>👆</Text>
        <Text style={styles.hintText}>
          {response === null ? 'Pick the bar.' : `You picked bar ${response}.`}
        </Text>
      </View>

      <View style={styles.strip}>
        {bars.map((bar) => {
          const selected = response === bar;
          return (
            <Pressable
              key={bar}
              testID={`bar-${bar}`}
              accessibilityLabel={`Bar ${bar}`}
              accessibilityState={{ selected }}
              disabled={locked}
              onPress={() => onResponseChange(bar)}
              style={[styles.bar, selected && { borderColor: hue, backgroundColor: colors.surfaceCardSunken }]}
            >
              <Text style={[styles.barLabel, selected && { color: hue, fontFamily: typo.cardTitle.fontFamily }]}>{bar}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: shape.spaceInline },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceCardSunken,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    borderRadius: shape.radiusControl,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  hintIcon: { fontSize: 15 },
  hintText: { ...typo.body, color: colors.textMuted, flex: 1 },

  strip: { flexDirection: 'row', gap: 9 },
  bar: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
    minHeight: shape.tapMin,
    justifyContent: 'center',
  },
  barLabel: { ...typo.label, fontSize: 13, color: colors.textMuted },
});
