// U3/U4: MCQ option card (design/components/core/AnswerOption.prompt.md). Selected
// uses the current strand hue; correct/incorrect swap the letter badge for ✓/×.
// For notation answers (e.g. key signatures) pass `music` — rendered as a mini,
// play-disabled static stave (StaticNotation) in place of the text label (rule 9: play
// is omitted only inside answer options). `children` remains available as a raw override.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Music, OrnamentKind } from '../../music/types';
import { ACCENT, colors, shape, strandDef, type, type Strand } from '../theme';
import { OrnamentSign } from './OrnamentSign';
import { StaticNotation } from './StaticNotation';

export type AnswerOptionState = 'default' | 'selected' | 'correct' | 'incorrect';

export interface AnswerOptionProps {
  letter: string;
  label: string;
  state?: AnswerOptionState;
  strand?: Strand;
  meta?: string;
  /** A notation-answer's rendered stave (AD5). Takes precedence over `label`
   *  when set; play is disabled (rule 9 — play omitted inside options). */
  music?: Music;
  /** G5-5: an ornament sign drawn (via OrnamentSign) beside the label text —
   *  the label stays for accessibility, the sign is the visible answer. */
  sign?: OrnamentKind;
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
  music,
  sign,
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
    // The position badge (A/B/C) and note label render as separate Text nodes, but
    // Pressable is accessible-by-default and would merge them into one "A B" label —
    // announcing scaffolding over meaning, and colliding with the A–G note names.
    // Pin the accessibility label to the answer itself so it's announced (and E2E-
    // matched) by what it means, not its position.
    <Pressable testID={testID} accessibilityLabel={label || letter} onPress={onPress} style={containerStyle}>
      <View style={badgeStyle}>
        <Text style={badgeTextStyle}>{badgeContent}</Text>
      </View>
      <View style={styles.body}>
        {children ?? (sign ? (
          <OrnamentSign kind={sign} color={colors.text} testID={testID ? `${testID}-sign` : undefined} />
        ) : music ? (
          <StaticNotation music={music} height={100} testID={testID ? `${testID}-notation` : undefined} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        ))}
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
