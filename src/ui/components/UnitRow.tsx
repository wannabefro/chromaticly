// U2: one unit row on the level map (design 3a). Strand colour is always paired
// with a glyph/label (rule 3), so the strand is a StrandChip overline, not a bare
// colour dot. Since G6 U3 there is no locked variant — nothing is hard-locked
// (R2), so every row is enterable and none carries a 🔒 or a "finish X to unlock"
// note. The advisory prerequisite chip that replaces it is PrereqChip (U7). The
// exam-gate node is a separate component (ExamGateNode).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { UnitState } from '../../learn/mastery-rollup';
import { colors, shape, strandDef, type as typo, type Strand } from '../theme';
import { StarRating } from './StarRating';
import { StrandChip } from './StrandChip';

export interface UnitRowProps {
  strand: Strand;
  title: string;
  stars: 0 | 1 | 2 | 3;
  state: UnitState;
  onPress?: () => void;
  testID?: string;
}

const CUE: Partial<Record<UnitState, string>> = {
  active: 'start ›',
  started: 'continue ›',
};

export function UnitRow({ strand, title, stars, state, onPress, testID }: UnitRowProps) {
  const hue = strandDef(strand).hue;
  const emphasized = state === 'active' || state === 'started';
  const cue = CUE[state];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.row, emphasized && { backgroundColor: `${hue}1a`, borderColor: hue }]}
    >
      <View style={styles.body}>
        <StrandChip strand={strand} showGlyph testID={testID ? `${testID}-strand` : undefined} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.trailing}>
        <StarRating filled={stars} testID={testID ? `${testID}-stars` : undefined} />
        {cue ? <Text style={[styles.cue, { color: hue }]}>{cue}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    paddingHorizontal: shape.spaceInline,
    paddingVertical: 11,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: 'transparent',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...typo.cardTitle,
    fontSize: 14,
    color: colors.text,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cue: {
    ...typo.label,
  },
});
