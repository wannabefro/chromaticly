import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { NotoMusic_400Regular } from '@expo-google-fonts/noto-music';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProgressProvider } from '../learn/ProgressContext';
import { sqliteStorage } from '../platform/sqlite-storage';
import { colors } from '../ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    NotoMusic_400Regular,
  });

  // Proceed once fonts load OR fail (A6: a font error must fall back to system
  // fonts, never leave a blank app). Hiding the splash reveals the first screen.
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ProgressProvider storage={sqliteStorage}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
      </ProgressProvider>
    </SafeAreaProvider>
  );
}
