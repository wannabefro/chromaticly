// U2: the locked exam-gate seal node capping a level on the map (design 3a,
// KD5). Display-only this iteration — it takes no onPress at all, so it is
// inert by construction (AE2: selecting it starts no exam).

import { StyleSheet, Text, View } from 'react-native';

import { colors, shape, type as typo } from '../theme';

export interface ExamGateNodeProps {
  levelGrade: number;
  /** Number of Level 1 units that must reach 3★ to unlock the exam (R3's
   *  "unlocks at N units ★" copy — N is a unit count, not a raw star total). */
  unitsRequired: number;
  testID?: string;
}

export function ExamGateNode({ levelGrade, unitsRequired, testID }: ExamGateNodeProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.seal} testID={testID ? `${testID}-seal` : undefined}>
        <Text style={styles.sealText}>L{levelGrade}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Level {levelGrade} Exam Paper</Text>
        <Text style={styles.subtitle}>Practice paper · unlocks at {unitsRequired} units ★</Text>
      </View>
      <Text style={styles.lock}>🔒</Text>
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
    borderRadius: 21,
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
    gap: 2,
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
  lock: {
    fontSize: 14,
    color: colors.textFaint,
  },
});
