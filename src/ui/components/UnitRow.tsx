// U2: one Level 1 unit row on the level map (design 3a). Strand colour is always
// paired with a glyph/label (rule 3), so the strand is a StrandChip overline, not
// a bare colour dot. Locked units name their prerequisite (R2); the exam-gate
// node and locked levels are separate components (ExamGateNode, LevelNode).

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
  /** The lesson title that must be finished to unlock this unit — shown only
   *  when `state === 'locked'` (R2: locked units name their prerequisite). */
  prerequisiteTitle?: string;
  onPress?: () => void;
  testID?: string;
}

const CUE: Partial<Record<UnitState, string>> = {
  active: 'start ›',
  started: 'continue ›',
};

export function UnitRow({ strand, title, stars, state, prerequisiteTitle, onPress, testID }: UnitRowProps) {
  const hue = strandDef(strand).hue;
  const locked = state === 'locked';
  const emphasized = state === 'active' || state === 'started';
  const cue = CUE[state];

  return (
    <Pressable
      testID={testID}
      onPress={locked ? undefined : onPress}
      disabled={locked}
      style={[styles.row, emphasized && { backgroundColor: `${hue}1a`, borderColor: hue }, locked && styles.locked]}
    >
      <View style={styles.body}>
        <StrandChip strand={strand} showGlyph testID={testID ? `${testID}-strand` : undefined} />
        <Text style={[styles.title, locked && { color: colors.textFaint }]}>{title}</Text>
        {locked && prerequisiteTitle ? (
          <Text style={styles.prereq} testID={testID ? `${testID}-prerequisite` : undefined}>
            Finish {prerequisiteTitle} to unlock
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        <StarRating filled={stars} testID={testID ? `${testID}-stars` : undefined} />
        {locked ? (
          <Text style={styles.lock}>🔒</Text>
        ) : cue ? (
          <Text style={[styles.cue, { color: hue }]}>{cue}</Text>
        ) : null}
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
  locked: {
    opacity: 0.55,
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
  prereq: {
    ...typo.label,
    color: colors.textFaint,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cue: {
    ...typo.label,
  },
  lock: {
    fontSize: 14,
    color: colors.textFaint,
  },
});
