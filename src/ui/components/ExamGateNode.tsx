// The exam-gate seal node capping a level on the map (design 3a). Free grade access
// (fyu.3): the paper is advisory, never a lock — "take it any time" — so this node
// carries no locked/unlocked visual split and never shows a 🔒. `hasPaper` is the
// only thing that can withhold the tap, for grades whose paper doesn't exist yet
// (D8) — even then it reads as "coming soon", not sealed shut.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shape, type as typo } from '../theme';

export interface ExamGateNodeProps {
  levelGrade: number;
  /** Number of the level's units — the design's "best after N units ★" is a
   *  readiness hint, not a requirement (a unit count, not a raw star total). */
  unitsRequired: number;
  /** False when the grade has no exam paper yet (D8) — the node reads "Coming
   *  soon" and stays inert no matter how many stars are earned, so it never
   *  promises a paper that doesn't exist. Defaults true. */
  hasPaper?: boolean;
  /** Provided only when there is a real paper to open. */
  onPress?: () => void;
  testID?: string;
}

export function ExamGateNode({ levelGrade, unitsRequired, hasPaper = true, onPress, testID }: ExamGateNodeProps) {
  const unitsLabel = unitsRequired === 1 ? 'unit' : 'units';
  const subtitle = hasPaper ? `take it any time · best after ${unitsRequired} ${unitsLabel} ★` : 'Coming soon';
  // D8 hardening: even if a caller mistakenly passes onPress for a paperless grade,
  // the node itself refuses to open onto nothing — never a broken tap.
  const tappable = hasPaper && onPress != null;

  const content = (
    <>
      <View style={styles.seal} testID={testID ? `${testID}-seal` : undefined}>
        <Text style={styles.sealText}>L{levelGrade}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Level {levelGrade} Exam Paper</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {tappable ? <Text style={styles.chevron}>›</Text> : null}
    </>
  );

  if (tappable) {
    return (
      <Pressable onPress={onPress} testID={testID} style={styles.container}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: shape.spaceInline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    padding: shape.spaceInline,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderWActive,
    borderStyle: 'dashed',
    borderColor: `${colors.hint}66`,
    backgroundColor: colors.surfaceCardSunken,
  },
  seal: {
    width: 42,
    height: 42,
    borderRadius: shape.radiusCardLg,
    borderWidth: shape.borderWActive,
    borderColor: colors.hint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealText: {
    ...typo.overline,
    color: colors.hint,
  },
  body: {
    flex: 1,
    gap: shape.spaceHairline,
  },
  title: {
    ...typo.cardTitle,
    fontSize: 13.5,
    color: colors.hint,
  },
  subtitle: {
    ...typo.label,
    color: colors.textFaint,
  },
  chevron: {
    fontSize: 14,
    color: colors.textFaint,
  },
});
