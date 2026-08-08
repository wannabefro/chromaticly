// The musical-sum worksheet (chromaticly-f9k): operand note-glyphs laid in a row with
// "+" between them and "= ?" at the end, on one light paper card (rule 1: notation never
// inverts). Replaces the old word string ("minim + crotchet = ?") so reading the note
// values is part of the task. Glyphs render through the shared offscreen surface
// (NotationGlyph), so the whole sum costs no extra WebView.

import { StyleSheet, Text, View } from 'react-native';

import type { Music } from '../../music/types';
import { colors, elevation, glyph, shape, strandDef, type, type Strand } from '../theme';
import { NotationGlyph } from './NotationGlyph';

const GLYPH_HEIGHT = 52;

export interface RhythmSumStimulusProps {
  operands: Music[];
  strand: Strand;
  /** Spoken-word form of the sum for screen-readers / E2E (e.g. "minim + crotchet = ?"). */
  label?: string;
  testID?: string;
}

export function RhythmSumStimulus({ operands, strand, label, testID = 'rhythm-sum-stimulus' }: RhythmSumStimulusProps) {
  const hue = strandDef(strand).hue;
  return (
    <View
      style={styles.card}
      testID={testID}
      accessible
      accessibilityLabel={label ?? undefined}
    >
      <View style={styles.row}>
        {operands.map((operand, i) => (
          <View key={i} style={styles.term}>
            {i > 0 && <Text style={styles.op}>+</Text>}
            <NotationGlyph music={operand} height={GLYPH_HEIGHT} testID={`${testID}-operand-${i}`} />
          </View>
        ))}
        <Text style={styles.op}>=</Text>
        <Text style={[styles.q, { color: hue }]}>?</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: shape.radiusPaper,
    padding: shape.spaceCard,
    minHeight: 96,
    justifyContent: 'center',
    ...elevation.paper,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: shape.spaceInline,
  },
  term: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
  },
  op: {
    ...type.title,
    fontSize: glyph.xl,
    color: colors.paperMuted,
  },
  q: {
    ...type.hero,
    fontSize: glyph.xxl,
  },
});
