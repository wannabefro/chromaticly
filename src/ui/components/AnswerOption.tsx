// U3: MCQ option card (design/components/core/AnswerOption.prompt.md). Selected
// uses the current strand hue; correct/incorrect swap the letter badge for ✓/×.
// For notation answers (e.g. key signatures), pass a mini NotationCard as children.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT, colors, shape, strandDef, type, type Strand } from '../theme';

export type AnswerOptionState = 'default' | 'selected' | 'correct' | 'incorrect';

export interface AnswerOptionProps {
  letter: string;
  label: string;
  state?: AnswerOptionState;
  strand?: Strand;
  meta?: string;
  onPress?: () => void;
  testID?: string;
  children?: ReactNode;
}

// ~12% opacity tint of the strand hue, per design/README.md "selected/interactive:
// 1.5px border in strand hue + 12–16% tint fill". Built from the theme hue at
// runtime (never a literal hex) so it stays clear of the no-raw-hex guard.
const TINT_ALPHA = '1F';

export function AnswerOption({
  letter,
  label,
  state = 'default',
  strand,
  meta,
  onPress,
  testID,
  children,
}: AnswerOptionProps) {
  const hue = strand ? strandDef(strand).hue : ACCENT;

  const containerStyle = [
    styles.container,
    state === 'selected' && { borderColor: hue, borderWidth: shape.borderWActive, backgroundColor: `${hue}${TINT_ALPHA}` },
    state === 'correct' && { borderColor: colors.correct, backgroundColor: colors.correctSurface },
    state === 'incorrect' && { borderColor: colors.incorrect, backgroundColor: colors.incorrectSurface },
  ];

  const badgeStyle = [
    styles.badge,
    state === 'selected' && { borderColor: hue },
    state === 'correct' && { borderColor: colors.correct, backgroundColor: colors.correct },
    state === 'incorrect' && { borderColor: colors.incorrect, backgroundColor: colors.incorrect },
  ];

  const badgeTextStyle = [
    styles.badgeText,
    state === 'selected' && { color: hue },
    (state === 'correct' || state === 'incorrect') && { color: colors.paper },
  ];

  const metaStyle = [
    styles.meta,
    state === 'correct' && { color: colors.correct },
    state === 'incorrect' && { color: colors.incorrect },
  ];

  const badgeContent = state === 'correct' ? '✓' : state === 'incorrect' ? '×' : letter;

  return (
    <Pressable testID={testID} onPress={onPress} style={containerStyle}>
      <View style={badgeStyle}>
        <Text style={badgeTextStyle}>{badgeContent}</Text>
      </View>
      <View style={styles.body}>
        {children ?? <Text style={styles.label}>{label}</Text>}
        {meta ? <Text style={metaStyle}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: shape.spaceCard,
    paddingVertical: 10,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: shape.borderW,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...type.label,
    color: colors.text,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...type.option,
    color: colors.text,
  },
  meta: {
    ...type.overline,
    color: colors.textMuted,
  },
});
