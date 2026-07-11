// FeedbackSheet (U4): the designed bottom sheet shown after Check — never a toast
// (rule 4). Correct shows a ✓ and reinforcement; incorrect names the misconception
// (the instance's feedback.incorrect copy, A4) and shows the correct answer rendered
// with its own play (A5, passed as `correctAnswer`). Content behind dims to 0.55.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, elevation, shape, type } from '../theme';

export interface FeedbackSheetProps {
  kind: 'correct' | 'incorrect';
  message: ReactNode;
  /** The correct answer rendered on paper with play (incorrect only). */
  correctAnswer?: ReactNode;
  onContinue: () => void;
  testID?: string;
}

export function FeedbackSheet({ kind, message, correctAnswer, onContinue, testID = 'feedback-sheet' }: FeedbackSheetProps) {
  const correct = kind === 'correct';
  const accent = correct ? colors.correct : colors.incorrect;

  return (
    <View style={styles.overlay} testID={testID}>
      <View style={styles.backdrop} />
      <View style={[styles.sheet, { borderTopColor: accent }]} testID={`${testID}-${kind}`}>
        <View style={styles.headerRow}>
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Text style={styles.badgeGlyph}>{correct ? '✓' : '!'}</Text>
          </View>
          <Text style={[styles.title, { color: accent }]}>{correct ? 'Correct!' : 'Not quite'}</Text>
        </View>

        {typeof message === 'string' ? <Text style={styles.message}>{message}</Text> : message}

        {correctAnswer != null && <View style={styles.answer}>{correctAnswer}</View>}

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
  badge: { width: 32, height: 32, borderRadius: shape.radiusChip, alignItems: 'center', justifyContent: 'center' },
  badgeGlyph: { ...type.cardTitle, color: colors.paper },
  title: { ...type.title },
  message: { ...type.body, color: colors.text },
  answer: { marginTop: 4 },
  continue: {
    borderRadius: shape.radiusButton,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: shape.tapMin,
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.98 }] },
  continueLabel: { ...type.option, color: colors.bg },
});
