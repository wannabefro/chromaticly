// Learn map (U12): the ordered lesson list with unlock/complete state driven
// by the progress store. Locked lessons render as plain text — nothing to
// press until their prerequisite unlocks them.

import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { LESSONS } from '../content/lessons';
import { useProgressContext } from '../learn/ProgressContext';
import { Screen } from '../ui/Screen';

function statusLabel(complete: boolean, unlocked: boolean): string {
  if (complete) return 'Done';
  if (!unlocked) return 'Locked';
  return 'Open';
}

export default function LearnMapScreen() {
  const { ready, isUnlocked, isLessonComplete } = useProgressContext();

  if (!ready) {
    return (
      <Screen style={styles.container} testID="learn-loading">
        <Text>Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} testID="learn-map">
      {LESSONS.map((lesson) => {
        const unlocked = isUnlocked(lesson.id);
        const complete = isLessonComplete(lesson.id);
        return (
          <View key={lesson.id} style={styles.row}>
            {unlocked ? (
              <Link href={`/lesson/${lesson.id}`} testID={`lesson-link-${lesson.id}`}>
                {lesson.title}
              </Link>
            ) : (
              <Text testID={`lesson-locked-${lesson.id}`}>{lesson.title}</Text>
            )}
            <Text style={styles.status}>{statusLabel(complete, unlocked)}</Text>
          </View>
        );
      })}
      <Link href="/practice" testID="practice-link" style={styles.practiceLink}>
        Free practice
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12, padding: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { opacity: 0.6 },
  practiceLink: { marginTop: 24 },
});
