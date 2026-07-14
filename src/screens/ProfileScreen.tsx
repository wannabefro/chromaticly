// Profile tab — DELIBERATELY A STUB.
//
// The tab bar (design 2a) has four tabs, so the shell must have four destinations.
// The real Profile is design 5c — grade switching, exam readiness, the collected
// facts, the mastery radar — and is its own piece of work (bd 302.8, which this shell
// unblocks).
//
// It shows what the app already knows (grade, facts collected) and says plainly that
// the rest is not built. An honest gap beats a screen that reads as finished: the one
// thing worse than a missing Profile is a fake one.

import { StyleSheet, Text, View } from 'react-native';

import { LESSONS } from '../content/lessons';
import { useProgressContext } from '../learn/ProgressContext';
import { Screen } from '../ui/Screen';
import { colors, shape, type as typo } from '../ui/theme';

export default function ProfileScreen() {
  const { grade, store, revision } = useProgressContext();
  const collected = LESSONS.filter((lesson) => store?.isFactCollected(lesson.id)).length;
  void revision; // mastery/facts are read off the mutable store — see AD6

  return (
    <Screen style={styles.screen} testID="profile-screen">
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.key}>Grade</Text>
          <Text style={styles.value}>{grade ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Facts collected</Text>
          <Text style={styles.value}>
            {collected}/{LESSONS.length}
          </Text>
        </View>
      </View>

      <Text style={styles.note} testID="profile-unbuilt">
        Grade switching, exam readiness and your mastery radar live here — not built yet.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: shape.spaceScreenX, gap: shape.spaceCard },
  title: { ...typo.title, color: colors.text },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    padding: shape.spaceCard,
    gap: shape.spaceInline,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  key: { ...typo.body, color: colors.textMuted },
  value: { ...typo.label, color: colors.text },
  note: { ...typo.body, color: colors.textFaint },
});
