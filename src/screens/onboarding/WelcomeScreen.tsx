// Welcome (design screen 6a): the cold-launch first screen. Guest "Start
// learning" is the only path (R1) — no account needed. The Apple/Google/Email
// sign-in block is gone: nothing in the app syncs, so it promised a capability
// that does not exist (approved 2026-08-06, recorded in design/README.md).

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAbcPlayer } from '../../music-surface/abc-player';
import { Button } from '../../ui/components/Button';
import { PlayButton } from '../../ui/components/PlayButton';
import { colors, shape, type } from '../../ui/theme';

// The iOS dark variant, not the shipped icon: it is transparent with light ink,
// so it sits on this screen's canvas instead of on a white tile.
const BRAND_MARK = require('../../../assets/images/icon-dark.png');

/** A C major arpeggio, up and back. The tagline claims audio; the first four
 *  screens were silent. */
const CHIME = 'X:1\nK:C\nL:1/8\nQ:1/4=200\nCEGc GEC4|]';

export interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const playAbc = useAbcPlayer();

  return (
    <View style={styles.container} testID="welcome-screen">
      <View style={styles.brandBlock}>
        <Pressable
          onPress={() => playAbc?.(CHIME)}
          accessibilityRole="button"
          accessibilityLabel="Hear a C major arpeggio"
          testID="brand-play"
          style={styles.markBlock}
        >
          <Image source={BRAND_MARK} style={styles.brandMark} resizeMode="contain" testID="brand-mark" />
          <View style={styles.markPlay} pointerEvents="none">
            <PlayButton testID="brand-play-glyph" />
          </View>
        </Pressable>
        <Text style={styles.wordmark}>Chromaticly</Text>
        <Text style={styles.tagline}>Music theory that you can hear. Grades 1–5, free.</Text>
        <Text style={styles.hearIt}>tap to hear it</Text>
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
    paddingVertical: shape.spaceScreenTop,
  },
  // The sign-in block used to fill the lower half. With it gone the brand centres
  // in the space instead of sitting under a screen of empty canvas.
  brandBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: shape.spaceInline,
  },
  markBlock: { alignItems: 'center', justifyContent: 'center' },
  brandMark: {
    width: 132,
    height: 132,
  },
  markPlay: { position: 'absolute' },
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
  hearIt: {
    fontFamily: type.label.fontFamily,
    fontSize: type.label.fontSize,
    lineHeight: type.label.lineHeight,
    color: colors.textFaint,
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
