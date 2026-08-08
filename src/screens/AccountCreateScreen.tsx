// Account creation (design 6b, scoped to name-only per the plan's product decision).
// The learner claims a display name; the profile upgrades Guest → named. Deliberately
// NO age, NO email, NO OAuth, and NO sync promise — a local identity only, the honest
// minimum a "no-backend" app can offer (see the plan). The age gate (AgeGateScreen/
// age.ts) stays parked for a future real-account gate.

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useProgressContext } from '../learn/ProgressContext';
import { Button } from '../ui/components/Button';
import { Screen } from '../ui/Screen';
import { colors, shape, type as typo } from '../ui/theme';

const MAX_NAME = 40;

export interface AccountCreateScreenProps {
  /** Called after the account is created and persisted. */
  onCreated: () => void;
  /** Called if the learner backs out without creating — no account, nudge stays eligible. */
  onCancel: () => void;
}

export function AccountCreateScreen({ onCreated, onCancel }: AccountCreateScreenProps) {
  const { createAccount } = useProgressContext();
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;

  async function submit() {
    if (!canSubmit) return;
    await createAccount(trimmed); // awaited → persisted before we leave (KTD7)
    onCreated();
  }

  return (
    <Screen style={styles.screen} testID="account-create-screen">
      <View style={styles.head}>
        <Text testID="account-create-back" style={styles.back} onPress={onCancel}>
          ‹
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Name your account</Text>
        <Text style={styles.subtitle}>
          Your progress is saved on this device. Give your account a name so it&rsquo;s yours to keep.
        </Text>
        <TextInput
          testID="account-name-input"
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.textFaint}
          maxLength={MAX_NAME}
          autoFocus
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      <View style={styles.footer}>
        <Button label="Continue" disabled={!canSubmit} onPress={submit} testID="account-create-submit" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { paddingHorizontal: shape.spaceScreenX, paddingTop: shape.spaceInline },
  back: { ...typo.title, color: colors.textMuted },
  body: { flex: 1, paddingHorizontal: shape.spaceScreenX, gap: shape.spaceCard, paddingTop: shape.spaceCard },
  title: { ...typo.title, color: colors.text },
  subtitle: { ...typo.body, color: colors.textMuted },
  input: {
    borderWidth: shape.borderWActive,
    borderColor: colors.border,
    borderRadius: shape.radiusControl,
    paddingHorizontal: shape.spaceCard,
    paddingVertical: shape.spaceCard,
    color: colors.text,
    backgroundColor: colors.surfaceCard,
    ...typo.body,
  },
  footer: { padding: shape.spaceScreenX },
});
