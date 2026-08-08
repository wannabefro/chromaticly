// Full-width CTA button (design/components/core/Button.prompt.md). Primary fills
// with the strand hue (or the near-white text token when no strand is given);
// secondary is text-only. `disabled` is the pre-selection state of "Check" in the
// exercise loop — dimmed, non-pressable.

import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, shape, strandDef, type, type Strand } from '../theme';

export interface ButtonProps {
  label: string;
  strand?: Strand;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function Button({ label, strand, variant = 'primary', disabled = false, onPress, testID }: ButtonProps) {
  const hue = strand ? strandDef(strand).hue : undefined;

  if (variant === 'secondary') {
    const labelColor = hue ?? colors.textMuted;
    return (
      <Pressable
        testID={testID}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.base,
          styles.secondary,
          { opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] },
        ]}
      >
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      </Pressable>
    );
  }

  const background = hue ?? colors.text;
  const textColor = hue ? 'rgba(0,0,0,0.82)' : colors.bg;
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        { backgroundColor: background, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] },
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    borderRadius: shape.radiusButton,
    paddingVertical: shape.spaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {},
  secondary: {
    backgroundColor: 'transparent',
  },
  label: {
    fontFamily: type.option.fontFamily,
    fontSize: type.option.fontSize,
    lineHeight: type.option.lineHeight,
    fontWeight: '700',
  },
});
