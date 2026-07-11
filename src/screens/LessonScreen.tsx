// Route target for /lesson/[id]: resolves the lesson from content and hands
// it to the Lesson runner. "Back to lessons" pops back to the learn map.

import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { lessonById } from '../content/lessons';
import { Lesson } from '../ui/Lesson';
import { Screen } from '../ui/Screen';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = lessonById(id);

  if (!lesson) {
    return (
      <Screen style={styles.container} testID="lesson-not-found">
        <Text>Lesson not found.</Text>
      </Screen>
    );
  }

  return (
    <Screen testID="lesson-screen">
      <Lesson lesson={lesson} onDone={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
