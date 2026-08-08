// The universal "everything sounds" play affordance (design/components/core/
// PlayButton.prompt.md, never-violate rule 2): a solid right-pointing triangle in
// a circle. `onPaper` renders as a filled disc with a light triangle for use on
// the notation paper card; otherwise a translucent ring tinted in the strand hue.
// Built with a View border-triangle (no react-native-svg dependency).

import { Pressable, StyleSheet, View } from 'react-native';

import { colors, shape, strandDef, type Strand } from '../theme';

export interface PlayButtonProps {
  onPaper?: boolean;
  strand?: Strand;
  size?: number;
  /** Dimmed, non-pressable — same visual language as Button's `disabled`
   *  (D9: the transposition answer card's play is disabled until ≥1 note
   *  is placed, since there is nothing yet to hear). */
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}

/** Applies alpha to a `#rrggbb` theme hue for the untinted ring background. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function PlayButton({ onPaper = false, strand, size = 40, disabled = false, onPress, testID }: PlayButtonProps) {
  const hue = strand ? strandDef(strand).hue : undefined;

  const background = onPaper
    ? hue ?? colors.paperInk
    : hue
      ? withAlpha(hue, 0.14)
      : 'rgba(255,255,255,0.1)';
  const border = !onPaper && hue ? { borderWidth: shape.borderWActive, borderColor: hue } : null;
  const triangleColor = onPaper ? colors.paper : hue ?? colors.text;

  const hitSlopValue = Math.max(0, (shape.tapMin - size) / 2);
  const triangleSize = size * 0.32;

  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={hitSlopValue}
      style={({ pressed }) => [
        styles.circle,
        border,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.triangle,
          {
            borderTopWidth: triangleSize * 0.58,
            borderBottomWidth: triangleSize * 0.58,
            borderLeftWidth: triangleSize,
            borderLeftColor: triangleColor,
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: shape.spaceHairline,
  },
});
