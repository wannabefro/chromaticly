// text_input interaction (U10): a controlled RN text field + submit button.
// Grading (case/space-insensitivity, accepted alternatives) lives in
// grading.ts's gradeText — this component only reports the raw input.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';

export interface TextInputInteractionProps {
  onSubmit: (text: string) => void;
}

export function TextInputInteraction({ onSubmit }: TextInputInteractionProps) {
  const [value, setValue] = useState('');

  return (
    <View style={styles.container} testID="text-input-interaction">
      <RNTextInput
        testID="text-input"
        style={styles.input}
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable testID="submit" style={styles.submit} onPress={() => onSubmit(value)}>
        <Text>Submit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8 },
  submit: { padding: 12, alignSelf: 'flex-start' },
});
