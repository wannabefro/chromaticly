// Welcome (design screen 6a): the cold-launch first screen. Guest "Start
// learning" is the only path (R1) — no account needed. The Apple/Google/Email
// sign-in block is gone: nothing in the app syncs, so it promised a capability
// that does not exist (approved 2026-08-06, recorded in design/README.md).

import { Image, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../ui/components/Button';
import { colors, shape, type } from '../../ui/theme';

// The iOS dark variant, not the shipped icon: it is transparent with light ink,
// so it sits on this screen's canvas instead of on a white tile.
const BRAND_MARK = require('../../../assets/images/icon-dark.png');

export interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <View style={styles.container} testID="welcome-screen">
      <View style={styles.brandBlock}>
        <Image source={BRAND_MARK} style={styles.brandMark} resizeMode="contain" testID="brand-mark" />
        <Text style={styles.wordmark}>Chromaticly</Text>
        <Text style={styles.tagline}>Music theory that you can hear. Grades 1–5, free.</Text>
      </View>

      <View style={styles.ctaBlock}>
        <Button label="Start learning" onPress={onStart} testID="start-learning" />
        <Text style={styles.ctaSubtext}>
          No account needed. Everything stays on this device.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'space-between',
    paddingHorizontal: shape.spaceScreenX,
    paddingVertical: 48,
  },
  // The sign-in block used to fill the lower half. With it gone the brand centres
  // in the space instead of sitting under a screen of empty canvas.
  brandBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  brandMark: {
    width: 132,
    height: 132,
  },
  wordmark: {
    fontFamily: type.hero.fontFamily,
    fontSize: type.hero.fontSize,
    lineHeight: type.hero.lineHeight,
    color: colors.text,
  },
  tagline: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.textMuted,
  },
  ctaBlock: {
    gap: shape.spaceStack,
  },
  ctaSubtext: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
