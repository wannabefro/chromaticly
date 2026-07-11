// Shared screen container. The app runs with headerShown:false, so screens must
// inset their own top edge or content collides with the status bar / notch
// (found dogfooding the learn map — the only tappable lesson sat under the clock).

import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

export function Screen({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={['top']} testID={testID}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
