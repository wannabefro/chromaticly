// U2: one unit row on the level map (design 3a), and since G6 U7 on the lane
// detail (7b) too. Strand colour is always paired with a glyph/label (rule 3), so
// the strand is a StrandChip overline, not a bare colour dot — suppressed with
// `showStrand={false}` on the lane detail, where the whole screen is one strand
// and a chip per row would repeat it seven times. Since G6 U3 there is no locked
// variant — nothing is hard-locked (R2), so every row is enterable and none
// carries a 🔒 or a "finish X to unlock" note. The advisory prerequisite chip that
// replaces it is PrereqChip. The exam-gate node is a separate component
// (ExamGateNode).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shape, strandDef, type as typo, type Strand } from '../theme';
import { StarRating } from './StarRating';
import { StrandChip } from './StrandChip';

/** The row's own status, owned here rather than by `mastery-rollup` (G6 U7).
 *
 *  It used to be `mastery-rollup`'s `UnitState`, which U12 deletes with the level
 *  map — so a row state that outlives that derivation has to live with the
 *  component that renders it.
 *
 *  `'active'` is TRANSITIONAL: only `unitStates` emits it, only `LevelMapScreen`
 *  passes it, and U12 removes it with both. `LaneScreen` emits `'current'`. The
 *  two mean the same thing; they are not merged yet because narrowing the union
 *  now would fail the typecheck at the moment this lands. */
export type UnitState = 'active' | 'current' | 'started' | 'done';

export interface UnitRowProps {
  strand: Strand;
  title: string;
  stars: 0 | 1 | 2 | 3;
  state: UnitState;
  /** The strand overline. False on a single-strand screen (the lane detail). */
  showStrand?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function UnitRow({ strand, title, stars, state, showStrand = true, onPress, testID }: UnitRowProps) {
  const hue = strandDef(strand).hue;
  // Only the frontier row is emphasised. A 0-star row further down is untouched
  // work, not work in progress, so it neither glows nor says "continue".
  const emphasized = state === 'active' || state === 'current' || (state === 'started' && stars > 0);
  // Derived from `stars`, not from `state`: a row can be the frontier with no
  // progress ("start") or with some ("continue"), and the state alone cannot tell.
  const cue = state === 'done' ? undefined : stars === 0 ? 'start ›' : 'continue ›';

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.row, emphasized && { backgroundColor: `${hue}1a`, borderColor: hue }]}
    >
      <View style={styles.body}>
        {showStrand ? <StrandChip strand={strand} showGlyph testID={testID ? `${testID}-strand` : undefined} /> : null}
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
    paddingVertical: shape.spaceInline,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: 'transparent',
  },
  body: {
    flex: 1,
    gap: shape.spaceTight,
  },
  title: {
    ...typo.cardTitle,
    fontSize: typo.body.fontSize,
    color: colors.text,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: shape.spaceTight,
  },
  cue: {
    ...typo.label,
  },
});
