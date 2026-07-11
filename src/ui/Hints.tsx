// Hint reveal control (U10): shows instance.hints one at a time, behind a
// "Show hint" press, and reports the running reveal count upward so the
// loop can carry hintsUsed into the emitted AttemptResult (a hint-assisted
// correct must not read as unaided mastery — KTD10).

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface HintsProps {
  hints: string[];
  onHintUsed?: (count: number) => void;
}

export function Hints({ hints, onHintUsed }: HintsProps) {
  const [revealed, setRevealed] = useState(0);

  if (hints.length === 0) return null;

  const showNext = () => {
    const next = Math.min(revealed + 1, hints.length);
    setRevealed(next);
    onHintUsed?.(next);
  };

  return (
    <View style={styles.container} testID="hints">
      {hints.slice(0, revealed).map((hint, index) => (
        <Text key={index} testID={`hint-${index}`}>
          {hint}
        </Text>
      ))}
      {revealed < hints.length && (
        <Pressable testID="show-hint" onPress={showNext}>
          <Text>Show hint</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
});
