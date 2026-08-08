// FeedbackSheet (U4): the designed bottom sheet shown after Check — never a toast
// (rule 4). Correct shows a ✓ and reinforcement; incorrect names the misconception
// (the instance's feedback.incorrect copy, A4) and shows the correct answer rendered
// with its own play (A5, passed as `correctAnswer`). Content behind dims to 0.55.
//
// U3 (Grade 3 octave transposition, deviation 3): `partial` is the amber register
// between correct/incorrect — some-but-not-all notes right (9b). It reuses the
// existing `colors.hint` amber (no new token) and is purely additive: correct/
// incorrect callers pass neither `badgeLabel`/`title`/`secondaryAction` nor
// `kind: 'partial'`, so their render is byte-identical to before this unit.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, elevation, shape, type } from '../theme';
import { RichText } from './RichText';

export interface FeedbackSheetProps {
  kind: 'correct' | 'incorrect' | 'partial';
  message: ReactNode;
  /** The correct answer rendered on paper with play (incorrect only). */
  correctAnswer?: ReactNode;
  onContinue: () => void;
  testID?: string;
  /** Overrides the badge glyph (✓/!) — the partial register shows "k/n" instead. */
  badgeLabel?: string;
  /** Overrides the heading — defaults keep today's "Correct!"/"Not quite" copy. */
  title?: string;
  /** An outline action above Continue (9b's "Fix note 3") — absent when not provided. */
  secondaryAction?: { label: string; onPress: () => void };
}

export function FeedbackSheet({
  kind,
  message,
  correctAnswer,
  onContinue,
  testID = 'feedback-sheet',
  badgeLabel,
  title,
  secondaryAction,
}: FeedbackSheetProps) {
  const correct = kind === 'correct';
  const partial = kind === 'partial';
  const accent = correct ? colors.correct : partial ? colors.hint : colors.incorrect;
  const defaultTitle = correct ? 'Correct!' : partial ? 'So close!' : 'Not quite';

  return (
    <View style={styles.overlay} testID={testID}>
      <View style={styles.backdrop} />
      <View style={[styles.sheet, { borderTopColor: accent }]} testID={`${testID}-${kind}`}>
        <View style={styles.headerRow}>
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Text style={styles.badgeGlyph}>{badgeLabel ?? (correct ? '✓' : '!')}</Text>
          </View>
          <Text style={[styles.title, { color: accent }]}>{title ?? defaultTitle}</Text>
        </View>

        {typeof message === 'string' ? <RichText style={styles.message}>{message}</RichText> : message}

        {correctAnswer != null && <View style={styles.answer}>{correctAnswer}</View>}

        {secondaryAction != null && (
          <Pressable
            style={({ pressed }) => [styles.secondary, { borderColor: accent }, pressed && styles.pressed]}
            onPress={secondaryAction.onPress}
            testID={`${testID}-secondary`}
          >
            <Text style={[styles.secondaryLabel, { color: accent }]}>{secondaryAction.label}</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.continue, { backgroundColor: accent }, pressed && styles.pressed]}
          onPress={onContinue}
          testID={`${testID}-continue`}
        >
          <Text style={styles.continueLabel}>{correct ? 'Continue' : 'Got it'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, opacity: 0.55 },
  sheet: {
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: shape.radiusCardLg,
    borderTopRightRadius: shape.radiusCardLg,
    borderTopWidth: shape.borderWActive,
    padding: shape.spaceScreenX,
    gap: shape.spaceCard,
    ...elevation.sheet,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline },
  badge: { minWidth: 32, height: 32, paddingHorizontal: shape.spaceSnug, borderRadius: shape.radiusChip, alignItems: 'center', justifyContent: 'center' },
  badgeGlyph: { ...type.cardTitle, color: colors.paper },
  title: { ...type.title },
  message: { ...type.body, color: colors.text },
  answer: { marginTop: shape.spaceTight },
  secondary: {
    borderRadius: shape.radiusButton,
    borderWidth: shape.borderWActive,
    paddingVertical: shape.spaceCard,
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: shape.tapMin,
    justifyContent: 'center',
  },
  secondaryLabel: { ...type.option },
  continue: {
    borderRadius: shape.radiusButton,
    paddingVertical: shape.spaceCard,
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: shape.tapMin,
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.98 }] },
  continueLabel: { ...type.option, color: colors.bg },
});
