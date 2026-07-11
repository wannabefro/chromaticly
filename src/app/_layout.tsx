import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProgressProvider } from '../learn/ProgressContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ProgressProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ProgressProvider>
    </SafeAreaProvider>
  );
}
