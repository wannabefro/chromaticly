// Welcome (design screen 6a): the cold-launch first screen. Guest "Start
// learning" is the primary path (R1) — no account needed. Apple/Google/Email
// sign-in are shown for later but non-functional this slice ("coming soon").

import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../ui/components/Button';
import { brandGradient, colors, shape, type } from '../../ui/theme';

export interface WelcomeScreenProps {
  onStart: () => void;
}

const SIGN_IN_OPTIONS = [
  { testID: 'signin-apple', label: 'Continue with Apple' },
  { testID: 'signin-google', label: 'Continue with Google' },
  { testID: 'signin-email', label: 'Continue with email' },
] as const;

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <View style={styles.container} testID="welcome-screen">
      <View style={styles.brandBlock}>
        <LinearGradient
          colors={brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandMark}
        />
        <Text style={styles.wordmark}>Chromaticly</Text>
        <Text style={styles.tagline}>Music theory that you can hear.</Text>
      </View>

      <View style={styles.ctaBlock}>
        <Button label="Start learning" onPress={onStart} testID="start-learning" />
        <Text style={styles.ctaSubtext}>No account needed — jump straight in.</Text>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>Or sign in to sync</Text>
          <View style={styles.dividerLine} />
        </View>

        {SIGN_IN_OPTIONS.map(({ testID, label }) => (
          <Pressable key={testID} testID={testID} disabled style={styles.signInButton}>
            <Text style={styles.signInLabel}>{label}</Text>
          </Pressable>
        ))}
        <Text style={styles.comingSoon}>Coming soon</Text>
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
  brandBlock: {
    alignItems: 'center',
    gap: 12,
    marginTop: 48,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: shape.radiusCardLg,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    marginTop: shape.spaceStack,
  },
  dividerLine: {
    flex: 1,
    height: shape.borderW,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    fontFamily: type.overline.fontFamily,
    fontSize: type.overline.fontSize,
    lineHeight: type.overline.lineHeight,
    letterSpacing: type.overline.letterSpacing,
    textTransform: type.overline.textTransform,
    color: colors.textFaint,
  },
  signInButton: {
    alignSelf: 'stretch',
    borderRadius: shape.radiusButton,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
  },
  signInLabel: {
    fontFamily: type.option.fontFamily,
    fontSize: type.option.fontSize,
    lineHeight: type.option.lineHeight,
    color: colors.textMuted,
  },
  comingSoon: {
    fontFamily: type.label.fontFamily,
    fontSize: type.label.fontSize,
    lineHeight: type.label.lineHeight,
    color: colors.textFaint,
    textAlign: 'center',
  },
});
