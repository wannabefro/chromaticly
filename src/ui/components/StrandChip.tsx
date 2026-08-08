// Strand overline (design/components/core/StrandChip.prompt.md). Identifies the
// current strand at the top of exercises, lessons, and unit rows — a strand's
// colour is always paired with its glyph/label (never-violate rule 3), never
// colour alone.

import { StyleSheet, Text, View } from 'react-native';

import { fonts, shape, strandDef, type, type Strand } from '../theme';

export interface StrandChipProps {
  strand: Strand;
  showGlyph?: boolean;
  testID?: string;
}

export function StrandChip({ strand, showGlyph = false, testID }: StrandChipProps) {
  const def = strandDef(strand);
  return (
    <View testID={testID} style={styles.container}>
      {showGlyph && <Text style={[styles.glyph, { color: def.hue }]}>{def.glyph}</Text>}
      <Text style={[styles.label, { color: def.hue }]}>{def.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceSnug,
  },
  glyph: {
    fontFamily: fonts.music,
    fontSize: 13,
  },
  label: {
    fontFamily: type.overline.fontFamily,
    fontSize: type.overline.fontSize,
    lineHeight: type.overline.lineHeight,
    letterSpacing: type.overline.letterSpacing,
    textTransform: type.overline.textTransform,
  },
});
