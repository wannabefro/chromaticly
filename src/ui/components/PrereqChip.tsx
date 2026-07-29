// The advisory cross-lane prerequisite (design 7b, G6 U7 — R10).
//
// This is what replaced the padlock. The old rule refused entry; this one names
// what the unit leans on, says how deep the learner currently is in that lane, and
// taps straight there. The unit stays enterable either way — a chip is a signpost,
// never a gate (R2), so this component has no disabled state and never wraps the
// row it describes.
//
// Colour is the REQUIRED strand's hue, not the current screen's: the chip is the
// one place a second strand legitimately appears, and its whole job is to point at
// that other lane. Rule 3 still holds — the hue always rides with that strand's
// glyph and its full name.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, shape, strandDef, type as typo, type Strand } from '../theme';

export interface PrereqChipProps {
  /** The lane this unit leans on — the chip's hue, glyph and destination. */
  strand: Strand;
  /** The learner's current depth in that lane. 0 is a real value (R7). */
  depth: number;
  /** The authored reason, a clause completing "leans on <strand> — <why>". */
  why: string;
  onPress?: () => void;
  testID?: string;
}

/** Depth stated the way the lane list states it, so the two never disagree (R3).
 *  Depth 0 is "not started", never "grade 0" and never a floor at 1. */
function depthPhrase(depth: number): string {
  return depth === 0 ? "you haven't started it" : `you're at grade ${depth}`;
}

export function PrereqChip({ strand, depth, why, onPress, testID }: PrereqChipProps) {
  const def = strandDef(strand);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Leans on ${def.label}. ${why}. ${depthPhrase(depth)}.`}
      style={[styles.chip, { borderColor: `${def.hue}66`, backgroundColor: `${def.hue}14` }]}
    >
      <Text style={[styles.glyph, { color: def.hue }]}>{def.glyph}</Text>
      <View style={styles.body}>
        <Text style={[styles.lead, { color: def.hue }]}>leans on {def.label} ›</Text>
        <Text style={styles.why}>
          {why} · {depthPhrase(depth)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderW,
    minHeight: shape.tapMin,
  },
  glyph: {
    fontFamily: fonts.music,
    fontSize: 15,
    lineHeight: 18,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  lead: {
    ...typo.label,
  },
  why: {
    ...typo.label,
    color: colors.textFaint,
  },
});
