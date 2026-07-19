// The exam-gate seal node capping a level on the map (design 3a, KD5). Locked and
// display-only until the level's units are mastered; once unlocked it becomes a
// tappable entry to the practice exam (302.2) — pass `onPress` to enable it.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shape, type as typo } from '../theme';

export interface ExamGateNodeProps {
  levelGrade: number;
  /** Number of Level 1 units that must reach 3★ to unlock the exam (R3's
   *  "unlocks at N units ★" copy — N is a unit count, not a raw star total). */
  unitsRequired: number;
  /** False when the grade has no exam paper yet (D8) — the seal stays sealed and
   *  press-disabled no matter how many stars are earned, and the subtitle reads
   *  "Coming soon" rather than promising a star threshold that would never open
   *  onto a real paper. Defaults true (every level had a paper before D8). */
  hasPaper?: boolean;
  /** Provided only when unlocked — makes the gate a tappable exam entry. Absent →
   *  the node stays inert (locked display). */
  onPress?: () => void;
  testID?: string;
}

export function ExamGateNode({ levelGrade, unitsRequired, hasPaper = true, onPress, testID }: ExamGateNodeProps) {
  const unlocked = onPress != null;
  const accent = unlocked ? colors.correct : colors.hint;
  const unitsLabel = unitsRequired === 1 ? 'unit' : 'units';
  const subtitle = unlocked
    ? 'Ready — tap to start the practice paper'
    : hasPaper
      ? `Practice paper · unlocks at ${unitsRequired} ${unitsLabel} ★`
      : 'Coming soon';
  const content = (
    <>
      <View style={[styles.seal, { borderColor: accent }]} testID={testID ? `${testID}-seal` : undefined}>
        <Text style={[styles.sealText, { color: accent }]}>L{levelGrade}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: accent }]}>Level {levelGrade} Exam Paper</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.lock}>{unlocked ? '›' : '🔒'}</Text>
    </>
  );

  if (unlocked) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        style={[styles.container, { borderStyle: 'solid', borderColor: `${colors.correct}66` }]}
      >
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
