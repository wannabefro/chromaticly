// text_input interaction (U3 registry): a controlled RN text field wired to the
// shared Check button via the interaction protocol's response/onResponseChange —
// moved verbatim out of ExerciseLoop's old inline RNTextInput so behavior is
// unchanged. Grading (case/space-insensitivity, accepted alternatives) lives in
// grading.ts's gradeText (see registry.ts); this component only reports raw input.

import { StyleSheet, TextInput as RNTextInput } from 'react-native';

import { colors, shape, type as typo } from '../theme';
import type { InteractionComponentProps } from './types';

export function TextInputField({ response, graded, onResponseChange }: InteractionComponentProps<string>) {
  return (
    <RNTextInput
      testID="text-input"
      style={styles.input}
      value={response}
      onChangeText={onResponseChange}
      editable={graded === null}
      autoCapitalize="none"
      autoCorrect={false}
      placeholder="Type your answer"
      placeholderTextColor={colors.textFaint}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: shape.borderW,
    borderColor: colors.border,
    borderRadius: shape.radiusControl,
    padding: shape.spaceInline,
    color: colors.text,
    ...typo.option,
  },
});
