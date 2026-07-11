// MCQ interaction (U10): renders the answer + distractors from the grading
// core's assembleOptions as pressable buttons. Grading itself stays in
// grading.ts — this component only reports which value was picked.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ExerciseInstance } from '../../engine/schema';
import { assembleOptions } from '../grading';

export interface McqProps {
  instance: ExerciseInstance;
  onSelect: (value: unknown) => void;
}

export function Mcq({ instance, onSelect }: McqProps) {
  const options = assembleOptions(instance);
  return (
    <View style={styles.container} testID="mcq">
      {options.map((option, index) => (
        <Pressable
          key={index}
          testID={`option-${index}`}
          style={styles.option}
          onPress={() => onSelect(option.value)}
        >
          <Text>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  option: { padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
});
