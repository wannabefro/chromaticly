import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProgressProvider } from '../learn/ProgressContext';
import { sqliteStorage } from '../platform/sqlite-storage';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ProgressProvider storage={sqliteStorage}>
        <Stack screenOptions={{ headerShown: false }} />
      </ProgressProvider>
    </SafeAreaProvider>
  );
}
