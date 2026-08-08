// AccountNudgeSheet (design 6c): the once-only save-progress nudge, shown over the
// dimmed "Lesson mastered" screen after three lessons of real investment. Presentational
// — the shell/host owns when to show it and where the buttons go (KTD8: onCreate/onDismiss
// are callbacks, this never navigates itself).
//
// Honest by construction: the account is a local named identity, so there is NO "save"/
// "sync now" promise and NO committed future-sync claim (R2), and the stat card shows only
// real, backed numbers — never XP, which does not exist. Structural shell copied from
// FeedbackSheet (overlay + dimmed backdrop + bottom-pinned card, elevation.sheet).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, elevation, shape, type } from '../theme';

export interface AccountNudgeSheetProps {
  /** Real, backed stats only (KTD4) — lessons completed, mastery stars, terms due for review. */
  lessons: number;
  stars: number;
  dueCount: number;
  /** Primary CTA — the host routes this to the account-creation screen. */
  onCreate: () => void;
  /** Secondary CTA — dismiss for now (host marks the nudge seen). */
  onDismiss: () => void;
  testID?: string;
}

export function AccountNudgeSheet({ lessons, stars, dueCount, onCreate, onDismiss, testID = 'account-nudge-sheet' }: AccountNudgeSheetProps) {
  const accent = colors.correct;
  const rows = [
    `${lessons} ${lessons === 1 ? 'lesson' : 'lessons'} complete`,
    `${stars}★ mastery earned`,
    `${dueCount} ${dueCount === 1 ? 'term' : 'terms'} in your review queue`,
  ];

  return (
    <View style={styles.overlay} testID={testID}>
      <View style={styles.backdrop} />
      <View style={[styles.sheet, { borderTopColor: accent }]}>
        <Text style={styles.title}>Three lessons in — nice work!</Text>
        <Text style={styles.message}>
          Your progress lives on this device. Give your account a name so it&rsquo;s yours to keep.
        </Text>

        <View style={styles.stats} testID={`${testID}-stats`}>
          {rows.map((row) => (
            <View key={row} style={styles.statRow}>
              <Text style={[styles.tick, { color: accent }]}>✓</Text>
              <Text style={styles.statText}>{row}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.primary, { backgroundColor: accent }, pressed && styles.pressed]}
          onPress={onCreate}
          testID={`${testID}-create`}
        >
          <Text style={styles.primaryLabel}>Name my account</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onDismiss} testID={`${testID}-dismiss`}>
          <Text style={styles.secondaryLabel}>Maybe later</Text>
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
  title: { ...type.title, color: colors.text },
  message: { ...type.body, color: colors.textMuted },
  stats: {
    backgroundColor: colors.surfaceCardSunken,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    padding: shape.spaceCard,
    gap: shape.spaceInline,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline },
  tick: { ...type.body },
  statText: { ...type.body, color: colors.text },
  primary: {
    borderRadius: shape.radiusButton,
    paddingVertical: shape.spaceCard,
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: shape.tapMin,
    justifyContent: 'center',
  },
  primaryLabel: { ...type.option, color: colors.bg },
  secondary: { alignItems: 'center', paddingVertical: shape.spaceSnug, minHeight: shape.tapMin, justifyContent: 'center' },
  secondaryLabel: { ...type.option, color: colors.textMuted },
  pressed: { transform: [{ scale: 0.98 }] },
});
