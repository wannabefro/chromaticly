import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container} testID="home-screen">
      <Text style={styles.title}>Chromaticly</Text>
      <Text style={styles.subtitle}>Grade 1 music theory practice</Text>
      <Link href="/practice" asChild>
        <Pressable style={styles.start} testID="start-practice">
          <Text style={styles.startText}>Start practice</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  start: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    backgroundColor: '#2a6',
  },
  startText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
